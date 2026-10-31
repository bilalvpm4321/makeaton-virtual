import type { Prisma, PrismaClient } from "@prisma/client";

/** Atomically returns the next number for `key` (1, 2, 3, ...). Call inside the caller's transaction. */
export async function nextNumber(
  tx: Prisma.TransactionClient | PrismaClient,
  key: string,
): Promise<number> {
  const rows = await tx.$queryRaw<{ n: bigint | number }[]>`INSERT INTO "Sequence"("key","next") VALUES (${key}, 2) ON CONFLICT ("key") DO UPDATE SET "next" = "Sequence"."next" + 1 RETURNING "next" - 1 AS n`;
  return Number(rows[0].n);
}

/** "SUB/00001" */
export async function nextSubscriptionNumber(tx: Prisma.TransactionClient | PrismaClient): Promise<string> {
  const n = await nextNumber(tx, "SUB");
  return `SUB/${String(n).padStart(5, "0")}`;
}

/** "INV/2026/00001" (sequence is per year, keyed INV-2026). */
export async function nextInvoiceNumber(
  tx: Prisma.TransactionClient | PrismaClient,
  date: Date,
): Promise<string> {
  const year = date.getUTCFullYear();
  const n = await nextNumber(tx, `INV-${year}`);
  return `INV/${year}/${String(n).padStart(5, "0")}`;
}
