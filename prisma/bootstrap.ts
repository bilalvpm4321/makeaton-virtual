/**
 * Production bootstrap. Idempotent and non-destructive: it never deletes or overwrites business data.
 *  - Creates the admin account from ADMIN_EMAIL and ADMIN_PASSWORD, or promotes an existing account to ADMIN.
 *    An existing password changes only when BOOTSTRAP_RESET_PASSWORD=true.
 *  - Seeds the default taxes and payment terms, only into a table that is empty.
 *  - Creates the SUB and INV-<year> sequences when missing. Existing counters are never lowered.
 *
 * Usage: npm run db:bootstrap   (run with the production DATABASE_URL and the ADMIN_* variables set)
 */
import { PrismaClient } from "@prisma/client";
import {
  hashPassword,
  normalizeEmail,
  PASSWORD_RULE,
  PASSWORD_RULE_MESSAGE,
} from "../src/lib/auth/password";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the environment as given.
}

const prisma = new PrismaClient();

const DEFAULT_TAXES = [
  { name: "GST 18%", rateBps: 1800 },
  { name: "GST 5%", rateBps: 500 },
  { name: "Zero-rated", rateBps: 0 },
];

const DEFAULT_PAYMENT_TERMS = [
  { name: "Immediate", dueDays: 0 },
  { name: "15 days", dueDays: 15 },
  { name: "30 days", dueDays: 30 },
];

type Counts = { created: number; kept: number };

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Validates the admin settings before the database is touched. */
function readAdminSettings(): { email: string; password: string; name: string } {
  const email = normalizeEmail(process.env.ADMIN_EMAIL ?? "");
  if (!email.includes("@")) fail("ADMIN_EMAIL is required and must be an email address.");
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) fail("ADMIN_PASSWORD is required.");
  if (!PASSWORD_RULE.test(password)) fail(`ADMIN_PASSWORD does not meet the rules. ${PASSWORD_RULE_MESSAGE}`);
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";
  return { email, password, name };
}

/** Creates the admin, or promotes an existing account. The password is never printed. */
async function ensureAdmin(email: string, password: string, name: string): Promise<string> {
  const resetPassword = process.env.BOOTSTRAP_RESET_PASSWORD === "true";
  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true, isActive: true } });
  if (existing?.role === "ADMIN" && existing.isActive && !resetPassword) return "kept";

  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "ADMIN" },
    update: { role: "ADMIN", isActive: true, ...(resetPassword ? { passwordHash } : {}) },
  });
  if (!existing) return "created";
  return resetPassword ? "updated, password reset" : "updated";
}

async function ensureTaxes(): Promise<Counts> {
  const existing = await prisma.tax.count();
  if (existing > 0) return { created: 0, kept: existing };
  await prisma.tax.createMany({ data: DEFAULT_TAXES });
  return { created: DEFAULT_TAXES.length, kept: 0 };
}

async function ensurePaymentTerms(): Promise<Counts> {
  const existing = await prisma.paymentTerm.count();
  if (existing > 0) return { created: 0, kept: existing };
  await prisma.paymentTerm.createMany({ data: DEFAULT_PAYMENT_TERMS });
  return { created: DEFAULT_PAYMENT_TERMS.length, kept: 0 };
}

/** Same keys as lib/sequence.ts: "SUB" and "INV-<year>" (UTC year). */
async function ensureSequences(): Promise<Counts> {
  const year = new Date().getUTCFullYear();
  const counts: Counts = { created: 0, kept: 0 };
  for (const key of ["SUB", `INV-${year}`]) {
    const exists = await prisma.sequence.findUnique({ where: { key }, select: { key: true } });
    // update: {} leaves an existing counter untouched, so it is never lowered.
    await prisma.sequence.upsert({ where: { key }, update: {}, create: { key, next: 1 } });
    if (exists) counts.kept += 1;
    else counts.created += 1;
  }
  return counts;
}

async function main(): Promise<void> {
  const admin = readAdminSettings();
  const adminResult = await ensureAdmin(admin.email, admin.password, admin.name);
  const taxes = await ensureTaxes();
  const terms = await ensurePaymentTerms();
  const sequences = await ensureSequences();

  console.log("Bootstrap complete (nothing was deleted).");
  console.log(`Admin: ${admin.email} (${adminResult})`);
  console.log(`Taxes: ${taxes.created} created, ${taxes.kept} kept`);
  console.log(`Payment terms: ${terms.created} created, ${terms.kept} kept`);
  console.log(`Sequences: ${sequences.created} created, ${sequences.kept} kept`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
