import { randomBytes } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { verifyFirebaseIdToken, type FirebaseIdentity } from "@/lib/auth/firebase";
import type { Role } from "@/lib/auth/jwt";
import { hashPassword, normalizeEmail } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { welcomeEmail } from "@/lib/email/templates";
import { sendMail } from "@/lib/mail";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_15_MIN_S = 15 * 60;
const SIGN_IN_LIMIT_PER_IP = 20;

const bodySchema = z.object({
  idToken: z.string().min(1).max(4096),
  next: z.string().max(2048).optional(),
});

const ACCOUNT_SELECT = {
  id: true,
  role: true,
  isActive: true,
  firebaseUid: true,
  avatarUrl: true,
} as const;

type AccountOutcome =
  | { status: "ok"; userId: string; role: Role; created: boolean }
  | { status: "disabled" }
  | { status: "conflict" };

/** Browsers send Origin on cross-site POSTs. Only this app's own host (APP_URL or the request host) may call the route. */
function isSameAppOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const allowed = [new URL(req.url).host];
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      allowed.push(new URL(appUrl).host);
    } catch {
      // A malformed APP_URL only narrows the allow list; the request host still applies.
    }
  }
  return allowed.includes(originHost);
}

/**
 * Same-site relative paths only. Also rejects backslashes and whitespace or control characters, because
 * browsers strip tabs and newlines from URLs, so "/\t/host" would otherwise become a protocol-relative redirect.
 */
function safeNext(value: string | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\\\s\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Finds or creates the Brightloop account for a verified Google identity, inside one transaction.
 * 1. The account already linked to this Firebase uid.
 * 2. Else the account with the same email, linked when it has no other Google identity.
 * 3. Else a new CUSTOMER with a Customer record (an unlinked Customer with the same email is reused).
 */
async function resolveAccount(identity: FirebaseIdentity, email: string, name: string): Promise<AccountOutcome> {
  return prisma.$transaction(async (tx): Promise<AccountOutcome> => {
    let account = await tx.user.findUnique({ where: { firebaseUid: identity.uid }, select: ACCOUNT_SELECT });
    let created = false;

    if (!account) {
      const byEmail = await tx.user.findUnique({ where: { email }, select: ACCOUNT_SELECT });

      if (byEmail) {
        // Linked to a different Google account already: never re-point it silently.
        if (byEmail.firebaseUid) return { status: "conflict" };
        // Disabled accounts are not linked; the caller answers 403.
        if (!byEmail.isActive) return { status: "disabled" };
        account = await tx.user.update({
          where: { id: byEmail.id },
          data: {
            firebaseUid: identity.uid,
            ...(!byEmail.avatarUrl && identity.picture ? { avatarUrl: identity.picture } : {}),
          },
          select: ACCOUNT_SELECT,
        });
      } else {
        const customer = await tx.customer.findUnique({ where: { email }, select: { id: true, userId: true } });
        // The Customer with this email belongs to some other user: do not take it over.
        if (customer?.userId) return { status: "conflict" };

        const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
        account = await tx.user.create({
          data: {
            email,
            name,
            role: "CUSTOMER",
            firebaseUid: identity.uid,
            avatarUrl: identity.picture,
            passwordHash,
          },
          select: ACCOUNT_SELECT,
        });
        if (customer) {
          await tx.customer.update({ where: { id: customer.id }, data: { userId: account.id } });
        } else {
          await tx.customer.create({ data: { name, email, userId: account.id } });
        }
        created = true;
      }
    }

    if (!account.isActive) return { status: "disabled" };
    return { status: "ok", userId: account.id, role: account.role, created };
  });
}

/** Completes "Continue with Google": verifies the Firebase ID token, signs the user in and returns where to go next. */
export async function POST(req: NextRequest) {
  if (!isSameAppOrigin(req)) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }

  const limit = await rateLimit(`firebase:ip:${await clientIp()}`, SIGN_IN_LIMIT_PER_IP, WINDOW_15_MIN_S);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let identity: FirebaseIdentity;
  try {
    identity = await verifyFirebaseIdToken(parsed.data.idToken);
  } catch (err) {
    console.error("Firebase sign-in rejected:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Google sign-in failed." }, { status: 401 });
  }

  const email = normalizeEmail(identity.email);
  const name = (identity.name?.trim() || email.split("@")[0]).slice(0, 100);

  let outcome: AccountOutcome;
  try {
    outcome = await resolveAccount(identity, email, name);
  } catch (err) {
    // Two first-time requests for the same person raced. The retry finds the account the other one created.
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "Google sign-in could not complete. Please try again." }, { status: 409 });
    }
    throw err;
  }

  if (outcome.status === "disabled") {
    return NextResponse.json({ error: "This account is disabled." }, { status: 403 });
  }
  if (outcome.status === "conflict") {
    return NextResponse.json(
      { error: "This email is already linked to a different sign-in." },
      { status: 409 },
    );
  }

  await createSession({ id: outcome.userId, role: outcome.role });

  if (outcome.created) {
    const base = (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/+$/, "");
    const welcome = welcomeEmail({ name, loginUrl: `${base}/login` });
    // After the response, so a slow or failing mail provider never delays or fails sign-up.
    after(() => sendMail({ to: email, ...welcome }));
  }

  const redirect = safeNext(parsed.data.next) ?? (outcome.role === "CUSTOMER" ? "/portal" : "/dashboard");
  return NextResponse.json({ redirect });
}
