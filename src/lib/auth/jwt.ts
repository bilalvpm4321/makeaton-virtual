// Edge-safe: only imports jose. Used by middleware.ts and session.ts.
import { jwtVerify, SignJWT } from "jose";

export type Role = "ADMIN" | "STAFF" | "CUSTOMER";

export const SESSION_COOKIE = "bl_session";

const DEV_SECRET = "dev-only-secret-change-me-please-32chars";

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? DEV_SECRET);
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
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const role = payload.role;
    if (typeof payload.sub !== "string") return null;
    if (role !== "ADMIN" && role !== "STAFF" && role !== "CUSTOMER") return null;
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}
