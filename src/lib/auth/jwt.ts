// Edge-safe: only imports jose. Used by middleware.ts and session.ts.
import { jwtVerify, SignJWT } from "jose";

export type Role = "ADMIN" | "STAFF" | "CUSTOMER";

export const SESSION_COOKIE = "bl_session";

const MIN_SECRET_LENGTH = 32;
// Development only. Production refuses to start without a real SESSION_SECRET.
const DEV_SECRET = "dev-only-secret-change-me-please-32chars";
let warnedAboutDevSecret = false;

function getSecret(): Uint8Array {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= MIN_SECRET_LENGTH) {
    return new TextEncoder().encode(configured);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
  }
  if (!warnedAboutDevSecret) {
    warnedAboutDevSecret = true;
    console.warn(
      configured
        ? `SESSION_SECRET is shorter than ${MIN_SECRET_LENGTH} characters. Using the development secret.`
        : "SESSION_SECRET is not set. Using the development secret.",
    );
  }
  return new TextEncoder().encode(DEV_SECRET);
}

export async function signSession({ userId, role }: { userId: string; role: Role }): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<{ userId: string; role: Role } | null> {
  // Resolved outside the try so a missing production secret surfaces as an error instead of a silent logout.
  const key = getSecret();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const role = payload.role;
    if (typeof payload.sub !== "string") return null;
    if (role !== "ADMIN" && role !== "STAFF" && role !== "CUSTOMER") return null;
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}
