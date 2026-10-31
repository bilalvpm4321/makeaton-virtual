"use server";

import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { createSession } from "@/lib/auth/session";
import {
  hashPassword,
  normalizeEmail,
  PASSWORD_RULE,
  PASSWORD_RULE_MESSAGE,
  verifyPassword,
} from "@/lib/auth/password";
import type { Role } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";
import { passwordResetEmail, welcomeEmail } from "@/lib/email/templates";
import { sendMail } from "@/lib/mail";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const DUPLICATE_EMAIL = "An account with this email already exists.";
const INVALID_LOGIN = "Invalid email or password.";
const INVALID_RESET = "This link is invalid or has expired.";
const GENERIC_SENT = "If an account exists, we've sent a reset link.";
const RESET_TTL_MS = 60 * 60 * 1000;
const WINDOW_15_MIN_S = 15 * 60;
const WINDOW_HOUR_S = 60 * 60;

const emailField = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .pipe(z.email("Enter a valid email address."));

const passwordField = z.string().regex(PASSWORD_RULE, PASSWORD_RULE_MESSAGE);

const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(100, "Name is too long."),
    email: emailField,
    password: passwordField,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match.", path: ["confirm"] });

const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address."),
  password: z.string().min(1, "Enter your password."),
});

const forgotSchema = z.object({ email: emailField });

const resetSchema = z
  .object({
    token: z.string(),
    password: passwordField,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match.", path: ["confirm"] });

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

function homeFor(role: Role): string {
  return role === "CUSTOMER" ? "/portal" : "/dashboard";
}

/** Only same-site relative paths. Blocks protocol-relative and absolute URLs (open redirect). */
function safeNext(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

function tooManyAttempts(retryAfterSeconds: number): ActionState {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return { error: `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.` };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** Public sign-up. Always creates a CUSTOMER and links (or creates) the Customer record with the same email. */
export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    confirm: formValue(formData, "confirm"),
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const email = normalizeEmail(parsed.data.email);
  const { name, password } = parsed.data;

  const ipLimit = await rateLimit(`signup:ip:${await clientIp()}`, 5, WINDOW_HOUR_S);
  if (!ipLimit.allowed) return tooManyAttempts(ipLimit.retryAfterSeconds);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: DUPLICATE_EMAIL };

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name, passwordHash, role: "CUSTOMER" },
        select: { id: true, role: true },
      });
      await tx.customer.upsert({
        where: { email },
        create: { name, email, userId: created.id },
        update: { userId: created.id },
      });
      return created;
    });
    await createSession({ id: user.id, role: user.role });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: DUPLICATE_EMAIL };
    throw err;
  }

  // After the response, so a slow or failing mail provider never delays or fails sign-up.
  const welcome = welcomeEmail({ name, loginUrl: `${appUrl()}/login` });
  after(() => sendMail({ to: email, ...welcome }));

  redirect("/portal");
}

/** Login for every role. Generic error for unknown email or wrong password. */
export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });
  if (!parsed.success) {
    return { error: "Enter your email and password.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const email = normalizeEmail(parsed.data.email);

  const ipLimit = await rateLimit(`login:ip:${await clientIp()}`, 10, WINDOW_15_MIN_S);
  if (!ipLimit.allowed) return tooManyAttempts(ipLimit.retryAfterSeconds);
  const emailLimit = await rateLimit(`login:email:${email}`, 5, WINDOW_15_MIN_S);
  if (!emailLimit.allowed) return tooManyAttempts(emailLimit.retryAfterSeconds);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, passwordHash: true, isActive: true },
  });
  const passwordOk = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !passwordOk) return { error: INVALID_LOGIN };
  if (!user.isActive) {
    return { error: "This account is inactive. Ask an administrator to restore access." };
  }

  await createSession({ id: user.id, role: user.role });

  const next = safeNext(formValue(formData, "next"));
  redirect(next ?? homeFor(user.role));
}

/** Always answers with the same message, so account existence is never revealed. */
export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotSchema.safeParse({ email: formValue(formData, "email") });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const email = normalizeEmail(parsed.data.email);

  // Over the limit, answer exactly as a normal request would, so limits never reveal whether an account exists.
  const ipLimit = await rateLimit(`forgot:ip:${await clientIp()}`, 5, WINDOW_HOUR_S);
  if (!ipLimit.allowed) return { success: GENERIC_SENT };
  const emailLimit = await rateLimit(`forgot:email:${email}`, 3, WINDOW_HOUR_S);
  if (!emailLimit.allowed) return { success: GENERIC_SENT };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (user) {
    const raw = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    const reset = passwordResetEmail({ name: user.name, url: `${appUrl()}/reset-password?token=${raw}` });
    await sendMail({ to: user.email, ...reset });
  }

  return { success: GENERIC_SENT };
}

/** Sets a new password from an emailed token. The token is single-use and expires after one hour. */
export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse({
    token: formValue(formData, "token"),
    password: formValue(formData, "password"),
    confirm: formValue(formData, "confirm"),
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const ipLimit = await rateLimit(`reset:ip:${await clientIp()}`, 10, WINDOW_HOUR_S);
  if (!ipLimit.allowed) return tooManyAttempts(ipLimit.retryAfterSeconds);

  if (!parsed.data.token) return { error: INVALID_RESET };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  const now = new Date();
  if (!record || record.usedAt || record.expiresAt <= now) return { error: INVALID_RESET };

  const passwordHash = await hashPassword(parsed.data.password);

  const applied = await prisma.$transaction(async (tx) => {
    // Claim the token first so two concurrent submissions cannot both succeed.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count === 0) return false;
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.deleteMany({
      where: { userId: record.userId, id: { not: record.id } },
    });
    return true;
  });
  if (!applied) return { error: INVALID_RESET };

  redirect("/login?reset=1");
}
