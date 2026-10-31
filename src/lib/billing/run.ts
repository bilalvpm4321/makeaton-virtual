import { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/activity";
import {
  computeInvoiceDraft,
  type ComputeDiscount,
  type ComputeLine,
  type InvoiceDraft,
} from "@/lib/billing/compute";
import { periodEnd, periodStart } from "@/lib/billing/period";
import { prisma } from "@/lib/db";
import { addDays, formatDate, toDateOnly } from "@/lib/dates";
import { nextInvoiceNumber } from "@/lib/sequence";

// PLAN.md §6.7. Billing run: activate, invoice (catch-up), auto-close, log.

const BATCH_SIZE = 200;
const SYSTEM_TRIGGERS = new Set(["cron", "cli"]);

type Tx = Prisma.TransactionClient;
type PeriodOutcome = "billed" | "done";

/** Thrown when the optimistic lock on Subscription.periodsBilled fails. Means another run billed it first. */
class PeriodConflict extends Error {
  constructor() {
    super("Period already billed by another run.");
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Keyset-paginated walk over a query, 200 rows at a time. `fetch` must order by id and honour the cursor. */
async function forEachBatch<T extends { id: string }>(
  fetch: (cursor: string | undefined) => Promise<T[]>,
  handle: (row: T) => Promise<void>,
): Promise<void> {
  let cursor: string | undefined;
  for (;;) {
    const batch = await fetch(cursor);
    if (batch.length === 0) return;
    for (const row of batch) await handle(row);
    cursor = batch[batch.length - 1].id;
    if (batch.length < BATCH_SIZE) return;
  }
}

/**
 * Bills the next due period of one subscription inside the caller's transaction.
 * Re-reads the subscription so the checks are authoritative.
 */
async function billNextPeriod(
  tx: Tx,
  subscriptionId: string,
  runDate: Date,
  actorId: string | null,
): Promise<PeriodOutcome> {
  const sub = await tx.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      number: true,
      status: true,
      customerId: true,
      startDate: true,
      expiryDate: true,
      periodsBilled: true,
      nextInvoiceDate: true,
      plan: { select: { billingPeriod: true } },
      paymentTerm: { select: { dueDays: true } },
      lines: {
        orderBy: { id: "asc" },
        select: {
          productId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          tax: { select: { name: true, rateBps: true } },
        },
      },
      discounts: {
        select: {
          discount: {
            select: {
              id: true,
              name: true,
              type: true,
              value: true,
              scope: true,
              minPurchase: true,
              minQuantity: true,
              startDate: true,
              endDate: true,
              usageLimit: true,
              usageCount: true,
              isActive: true,
              createdAt: true,
              products: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!sub || sub.status !== "ACTIVE" || !sub.nextInvoiceDate) return "done";
  if (sub.nextInvoiceDate > runDate) return "done";
  if (sub.expiryDate && sub.nextInvoiceDate > sub.expiryDate) return "done";

  const k = sub.periodsBilled;
  const period = sub.plan.billingPeriod;
  const ps = periodStart(sub.startDate, period, k);
  const pe = periodEnd(sub.startDate, period, k);
  const nextStart = periodStart(sub.startDate, period, k + 1);
  const dueDate = addDays(runDate, sub.paymentTerm.dueDays);

  const lines: ComputeLine[] = sub.lines.map((l) => ({
    productId: l.productId,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxName: l.tax?.name ?? null,
    taxRateBps: l.tax?.rateBps ?? 0,
  }));
  const discounts: ComputeDiscount[] = sub.discounts.map(({ discount: d }) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    value: d.value,
    scope: d.scope,
    productIds: d.products.map((p) => p.id),
    minPurchase: d.minPurchase,
    minQuantity: d.minQuantity,
    startDate: d.startDate,
    endDate: d.endDate,
    usageLimit: d.usageLimit,
    usageCount: d.usageCount,
    isActive: d.isActive,
    createdAt: d.createdAt,
  }));

  // Atomic usage guard. Prisma cannot compare two columns, so use raw SQL.
  // If a rule ran out between read and write, drop it and recompute the draft.
  let draft: InvoiceDraft = computeInvoiceDraft(lines, discounts, ps);
  const excluded = new Set<string>();
  for (;;) {
    const reserved: string[] = [];
    let exhausted: string | null = null;
    for (const applied of draft.appliedDiscounts) {
      const n = await tx.$executeRaw`UPDATE "DiscountRule" SET "usageCount" = "usageCount" + 1 WHERE "id" = ${applied.discountId} AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")`;
      if (n === 0) {
        exhausted = applied.discountId;
        break;
      }
      reserved.push(applied.discountId);
    }
    if (exhausted === null) break;

    for (const id of reserved) {
      await tx.$executeRaw`UPDATE "DiscountRule" SET "usageCount" = "usageCount" - 1 WHERE "id" = ${id}`;
    }
    excluded.add(exhausted);
    draft = computeInvoiceDraft(
      lines,
      discounts.filter((d) => !excluded.has(d.id)),
      ps,
    );
  }

  const number = await nextInvoiceNumber(tx, runDate);
  const invoice = await tx.invoice.create({
    data: {
      number,
      customerId: sub.customerId,
      subscriptionId,
      periodStart: ps,
      periodEnd: pe,
      issueDate: runDate,
      dueDate,
      status: "DRAFT",
      subtotal: draft.subtotal,
      discountTotal: draft.discountTotal,
      taxTotal: draft.taxTotal,
      total: draft.total,
      lines: {
        create: draft.lines.map((l) => ({
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          subtotal: l.subtotal,
          discountAmount: l.discountAmount,
          taxName: l.taxName,
          taxRateBps: l.taxRateBps,
          taxAmount: l.taxAmount,
          total: l.total,
        })),
      },
      redemptions: {
        create: draft.appliedDiscounts.map((a) => ({ discountId: a.discountId, amount: a.amount })),
      },
    },
    select: { id: true },
  });

  // Optimistic lock: only advance if nobody else moved the counter.
  const advanced = await tx.subscription.updateMany({
    where: { id: subscriptionId, periodsBilled: k },
    data: { periodsBilled: k + 1, nextInvoiceDate: nextStart },
  });
  if (advanced.count === 0) throw new PeriodConflict();

  const label = `${formatDate(ps)} – ${formatDate(pe)}`;
  await logActivity(tx, {
    entityType: "invoice",
    entityId: invoice.id,
    message: `Invoice ${number} created for ${label}`,
    userId: actorId,
  });
  await logActivity(tx, {
    entityType: "subscription",
    entityId: subscriptionId,
    message: `Invoiced ${number} for ${label}`,
    userId: actorId,
  });

  return "billed";
}

/** One period in its own transaction. Returns "conflict" when the period was already billed. */
async function billOnePeriod(
  subscriptionId: string,
  runDate: Date,
  actorId: string | null,
): Promise<PeriodOutcome | "conflict"> {
  try {
    return await prisma.$transaction((tx) => billNextPeriod(tx, subscriptionId, runDate, actorId));
  } catch (err) {
    if (err instanceof PeriodConflict || isUniqueViolation(err)) return "conflict";
    throw err;
  }
}

/**
 * Catch-up billing for one subscription: bills every period that is due on or before `runDate`
 * (and inside the term), one transaction per period. Returns counts for the run.
 */
export async function billSubscription(
  subscriptionId: string,
  runDate: Date,
  actorId: string | null = null,
): Promise<{ invoiced: number; skipped: number }> {
  const day = toDateOnly(runDate);
  let invoiced = 0;
  let skipped = 0;

  for (;;) {
    const outcome = await billOnePeriod(subscriptionId, day, actorId);
    if (outcome === "conflict") {
      skipped += 1;
      break;
    }
    if (outcome === "done") break;
    invoiced += 1;
  }

  return { invoiced, skipped };
}

/**
 * Full billing run (PLAN.md §6.7):
 *  A. CONFIRMED subscriptions with startDate <= day become ACTIVE.
 *  B. ACTIVE subscriptions with nextInvoiceDate <= day get their due invoices (DRAFT).
 *  C. ACTIVE subscriptions on auto-close plans whose term ended become CLOSED.
 *  D. A BillingRun row records the counts. Safe to run twice.
 */
export async function runBilling(runDate: Date, triggeredBy: string | null) {
  const day = toDateOnly(runDate);
  const actorId = triggeredBy && !SYSTEM_TRIGGERS.has(triggeredBy) ? triggeredBy : null;
  const errors: string[] = [];
  let activated = 0;
  let invoiced = 0;
  let closed = 0;
  let skipped = 0;

  // A. Activate
  await forEachBatch(
    (cursor) =>
      prisma.subscription.findMany({
        where: {
          status: "CONFIRMED",
          startDate: { lte: day },
          id: cursor ? { gt: cursor } : undefined,
        },
        select: { id: true, number: true, startDate: true },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
      }),
    async (s) => {
      try {
        const ok = await prisma.$transaction(async (tx) => {
          const res = await tx.subscription.updateMany({
            where: { id: s.id, status: "CONFIRMED" },
            data: { status: "ACTIVE", periodsBilled: 0, nextInvoiceDate: s.startDate },
          });
          if (res.count === 0) return false;
          await logActivity(tx, {
            entityType: "subscription",
            entityId: s.id,
            message: "Status: Confirmed → Active",
            userId: actorId,
          });
          return true;
        });
        if (ok) activated += 1;
      } catch (err) {
        errors.push(`Activate ${s.number}: ${messageOf(err)}`);
      }
    },
  );

  // B. Invoice
  await forEachBatch(
    (cursor) =>
      prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          nextInvoiceDate: { lte: day },
          id: cursor ? { gt: cursor } : undefined,
        },
        select: { id: true, number: true },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
      }),
    async (s) => {
      try {
        const r = await billSubscription(s.id, day, actorId);
        invoiced += r.invoiced;
        skipped += r.skipped;
      } catch (err) {
        errors.push(`Invoice ${s.number}: ${messageOf(err)}`);
      }
    },
  );

  // C. Auto-close ended terms. Only when every due period was billed (nextInvoiceDate past expiry).
  await forEachBatch(
    (cursor) =>
      prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          plan: { autoClose: true },
          expiryDate: { lt: day },
          id: cursor ? { gt: cursor } : undefined,
        },
        select: { id: true, number: true, expiryDate: true, nextInvoiceDate: true },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
      }),
    async (s) => {
      if (!s.expiryDate || !s.nextInvoiceDate || s.nextInvoiceDate <= s.expiryDate) return;
      try {
        const ok = await prisma.$transaction(async (tx) => {
          const res = await tx.subscription.updateMany({
            where: { id: s.id, status: "ACTIVE" },
            data: {
              status: "CLOSED",
              closedAt: new Date(),
              closeReason: "Term ended",
              nextInvoiceDate: null,
            },
          });
          if (res.count === 0) return false;
          await logActivity(tx, {
            entityType: "subscription",
            entityId: s.id,
            message: "Status: Active → Closed (term ended)",
            userId: actorId,
          });
          return true;
        });
        if (ok) closed += 1;
      } catch (err) {
        errors.push(`Close ${s.number}: ${messageOf(err)}`);
      }
    },
  );

  // D. Record the run
  return prisma.billingRun.create({
    data: {
      runDate: day,
      activated,
      invoiced,
      closed,
      skipped,
      errors: errors.length,
      log: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
      triggeredBy,
    },
  });
}
