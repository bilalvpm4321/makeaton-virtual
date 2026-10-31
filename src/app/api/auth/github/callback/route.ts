import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";
import {
  appOrigin,
  exchangeCodeForToken,
  fetchGithubProfile,
  fetchVerifiedEmail,
  GITHUB_STATE_COOKIE,
  GITHUB_STATE_COOKIE_OPTIONS,
  githubCallbackUrl,
  githubCredentials,
  parseStateCookie,
  resolveGithubUser,
  safeNext,
  stateMatches,
} from "@/lib/auth/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every exit clears the one-time state cookie, whether or not sign-in succeeded. */
function redirectTo(base: string, path: string): NextResponse {
  const res = NextResponse.redirect(new URL(path, base));
  res.cookies.set(GITHUB_STATE_COOKIE, "", { ...GITHUB_STATE_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}

function fail(base: string, reason: string): NextResponse {
  console.error(`GitHub sign-in failed: ${reason}`);
  return redirectTo(base, "/login?error=github_failed");
}

/** GitHub redirects here after the user approves. Exchanges the code, signs the user in, and sends them on. */
export async function GET(req: NextRequest) {
  const base = appOrigin(req.url);
  const { searchParams } = req.nextUrl;
  const stored = parseStateCookie(req.cookies.get(GITHUB_STATE_COOKIE)?.value);

  if (!stored || !stateMatches(stored.state, searchParams.get("state"))) {
    return fail(base, "state missing or mismatched");
  }
  const code = searchParams.get("code");
  if (!code) return fail(base, `no authorization code (${searchParams.get("error") ?? "unknown"})`);

  const credentials = githubCredentials();
  if (!credentials) return fail(base, "GitHub credentials are not configured");

  try {
    const token = await exchangeCodeForToken(credentials, code, githubCallbackUrl(req.url));
    const profile = await fetchGithubProfile(token);
    const email = await fetchVerifiedEmail(token);
    if (!email) return redirectTo(base, "/login?error=github_no_email");

    const outcome = await resolveGithubUser(profile, email);
    if (outcome.status === "disabled") return redirectTo(base, "/login?error=account_disabled");
    if (outcome.status === "conflict") return fail(base, "verified email is linked to another GitHub account");

    await createSession({ id: outcome.userId, role: outcome.role });
    const next = safeNext(stored.next);
    return redirectTo(base, next ?? (outcome.role === "CUSTOMER" ? "/portal" : "/dashboard"));
  } catch (err) {
    return fail(base, err instanceof Error ? err.message : "unexpected error");
  }
}
