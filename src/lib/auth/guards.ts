import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { can, type Permission, type Role } from "@/lib/rbac";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  customerId: string | null;
};

/** Re-reads the user from the DB on every call (per request). Returns null when logged out or inactive. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      customer: { select: { id: true } },
    },
  });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    customerId: user.customer?.id ?? null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect(user.role === "CUSTOMER" ? "/portal" : "/dashboard");
  }
  return user;
}

export async function requirePermission(p: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user, p)) throw new Error("You don't have permission to do that.");
  return user;
}

export async function requireCustomer(): Promise<{ user: CurrentUser; customerId: string }> {
  const user = await requireRole("CUSTOMER");
  if (!user.customerId) {
    throw new Error("No customer profile is linked to this account.");
  }
  return { user, customerId: user.customerId };
}
