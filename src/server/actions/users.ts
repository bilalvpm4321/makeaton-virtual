"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { hashPassword, normalizeEmail, PASSWORD_RULE, PASSWORD_RULE_MESSAGE } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

const DUPLICATE_EMAIL = "An account with this email already exists.";
const USERS_PATH = "/settings/users";

const createStaffSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100, "Name is too long."),
  email: z.string().trim().min(1, "Enter an email address.").pipe(z.email("Enter a valid email address.")),
  password: z.string().regex(PASSWORD_RULE, PASSWORD_RULE_MESSAGE),
  role: z.enum(["STAFF", "ADMIN"], "Choose Staff or Admin."),
});

const setActiveSchema = z.object({
  userId: z.string().min(1, "Missing user."),
  active: z.enum(["true", "false"], "Invalid status."),
});

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** Admin only (users.manage): creates a STAFF or ADMIN account with a temporary password. */
export async function createStaffUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("users.manage");

  const parsed = createStaffSchema.safeParse({
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    role: formValue(formData, "role"),
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const email = normalizeEmail(parsed.data.email);
  const { name, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: DUPLICATE_EMAIL, fieldErrors: { email: DUPLICATE_EMAIL } };

  const passwordHash = await hashPassword(password);

  try {
    await prisma.user.create({
      data: { name, email, passwordHash, role, isActive: true },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: DUPLICATE_EMAIL, fieldErrors: { email: DUPLICATE_EMAIL } };
    throw err;
  }

  revalidatePath(USERS_PATH);
  return { success: `${role === "ADMIN" ? "Admin" : "Staff"} account created for ${email}.` };
}

/** Admin only (users.manage): activates or deactivates a user. Nobody can deactivate their own account. */
export async function setUserActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");

  const parsed = setActiveSchema.safeParse({
    userId: formValue(formData, "userId"),
    active: formValue(formData, "active"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const { userId } = parsed.data;
  const nextActive = parsed.data.active === "true";

  if (userId === actor.id && !nextActive) {
    return { error: "You can't deactivate your own account." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, isActive: true },
  });
  if (!target) return { error: "User not found." };

  await prisma.user.update({ where: { id: userId }, data: { isActive: nextActive } });

  revalidatePath(USERS_PATH);
  return { success: `${target.name} ${nextActive ? "reactivated" : "deactivated"}.` };
}
