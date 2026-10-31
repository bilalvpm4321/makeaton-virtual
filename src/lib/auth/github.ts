// GitHub OAuth (authorization-code flow) for "Continue with GitHub".
// Used only by the routes under src/app/api/auth/github, which run on the Node runtime.
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Role } from "@/lib/auth/jwt";
import { hashPassword, normalizeEmail } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

export const GITHUB_STATE_COOKIE = "gh_oauth_state";

/** Lax so the cookie survives the top-level redirect back from GitHub. Expires after 10 minutes. */
export const GITHUB_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 600,
} as const;

const GITHUB_TIMEOUT_MS = 10_000;
const GITHUB_SCOPE = "read:user user:email";

export type GithubStateCookie = { state: string; next: string | null };

export type GithubProfile = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
};

type GithubEmail = { email: string; primary: boolean; verified: boolean };

/** Public origin: APP_URL when set, otherwise the origin of the incoming request. */
export function appOrigin(requestUrl: string): string {
  return (process.env.APP_URL ?? new URL(requestUrl).origin).replace(/\/+$/, "");
}

export function githubCallbackUrl(requestUrl: string): string {
  return `${appOrigin(requestUrl)}/api/auth/github/callback`;
}

export function githubCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Same-site relative paths only. Blocks "//host" and "/\host", which browsers read as absolute URLs (open redirect). */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

export function newOAuthState(): string {
  return randomBytes(32).toString("hex");
}

export function githubAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: GITHUB_SCOPE,
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export function parseStateCookie(raw: string | undefined): GithubStateCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GithubStateCookie>;
    if (typeof parsed.state !== "string") return null;
    return { state: parsed.state, next: typeof parsed.next === "string" ? parsed.next : null };
  } catch {
    return null;
  }
}

/** Constant-time comparison. Lengths are checked first because timingSafeEqual throws on unequal lengths. */
export function stateMatches(expected: string, received: string | null): boolean {
  if (!received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** One call to GitHub. The 10 s budget covers the request and reading the body. Network errors throw. */
async function githubRequest<T>(
  url: string,
  init: { method?: "GET" | "POST"; headers: Record<string, string>; body?: URLSearchParams },
): Promise<{ ok: boolean; body: T | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: { "User-Agent": "Brightloop", ...init.headers },
      body: init.body,
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, body };
  } finally {
    clearTimeout(timer);
  }
}

/** Trades the one-time code for an access token. Errors carry a short reason and never include the token. */
export async function exchangeCodeForToken(
  credentials: { clientId: string; clientSecret: string },
  code: string,
  redirectUri: string,
): Promise<string> {
  const { ok, body } = await githubRequest<{ access_token?: string; error?: string }>(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    },
  );
  if (!ok || !body?.access_token) {
    throw new Error(`token exchange rejected${body?.error ? `: ${body.error}` : ""}`);
  }
  return body.access_token;
}

function apiHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
}

export async function fetchGithubProfile(token: string): Promise<GithubProfile> {
  const { ok, body } = await githubRequest<GithubProfile>("https://api.github.com/user", {
    headers: apiHeaders(token),
  });
  if (!ok || !body || typeof body.id !== "number" || typeof body.login !== "string") {
    throw new Error("could not read GitHub profile");
  }
  return body;
}

/** The primary verified address, else any verified one. Null when GitHub has none. */
export async function fetchVerifiedEmail(token: string): Promise<string | null> {
  const { ok, body } = await githubRequest<GithubEmail[]>("https://api.github.com/user/emails", {
    headers: apiHeaders(token),
  });
  if (!ok || !Array.isArray(body)) throw new Error("could not read GitHub emails");
  const verified = body.filter((entry) => entry.verified);
  const chosen = verified.find((entry) => entry.primary) ?? verified[0];
  return chosen ? normalizeEmail(chosen.email) : null;
}

const ACCOUNT_SELECT = { id: true, role: true, isActive: true, githubId: true } as const;

export type GithubSignInOutcome =
  | { status: "ok"; userId: string; role: Role }
  | { status: "disabled" }
  | { status: "conflict" };

/**
 * Finds or creates the Brightloop user for a GitHub identity.
 * Matched by GitHub id first, then by verified email (linked). Otherwise a new CUSTOMER is created.
 */
export async function resolveGithubUser(profile: GithubProfile, email: string): Promise<GithubSignInOutcome> {
  const githubId = String(profile.id);
  const avatarUrl = profile.avatar_url;
  const name = profile.name?.trim() || profile.login;

  return prisma.$transaction(async (tx) => {
    let account = await tx.user.findUnique({ where: { githubId }, select: ACCOUNT_SELECT });

    if (!account) {
      const byEmail = await tx.user.findUnique({ where: { email }, select: ACCOUNT_SELECT });
      if (byEmail) {
        // Already linked to a different GitHub identity: never re-point it silently.
        if (byEmail.githubId) return { status: "conflict" as const };
        // Disabled accounts are not linked; the caller shows account_disabled.
        if (!byEmail.isActive) return { status: "disabled" as const };
        account = await tx.user.update({
          where: { id: byEmail.id },
          data: { githubId, avatarUrl },
          select: ACCOUNT_SELECT,
        });
      } else {
        const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
        account = await tx.user.create({
          data: { email, name, role: "CUSTOMER", githubId, avatarUrl, passwordHash },
          select: ACCOUNT_SELECT,
        });
        const customer = await tx.customer.findUnique({ where: { email }, select: { id: true, userId: true } });
        if (!customer) {
          await tx.customer.create({ data: { name, email, userId: account.id } });
        } else if (!customer.userId) {
          await tx.customer.update({ where: { id: customer.id }, data: { userId: account.id } });
        }
      }
    }

    if (!account.isActive) return { status: "disabled" as const };
    return { status: "ok" as const, userId: account.id, role: account.role };
  });
}
