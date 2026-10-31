import { cookies } from "next/headers";
import { SESSION_COOKIE, signSession, verifySession, type Role } from "@/lib/auth/jwt";

const SEVEN_DAYS = 60 * 60 * 24 * 7;

export async function createSession(user: { id: string; role: Role }): Promise<void> {
  const token = await signSession({ userId: user.id, role: user.role });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SEVEN_DAYS,
  });
}

export async function getSession(): Promise<{ userId: string; role: Role } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}
