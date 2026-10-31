import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, addMonths, diffDays, today } from "@/lib/dates";

export type DashboardFilters = {
  from: Date;
  to: Date;
  planId?: string;
};

export type ChartPoint = {
  month: string;
  title: string;
  invoiced: number;
  collected: number;
};

export type OverdueRow = {
  id: string;
  number: string;
  customerName: string;
  dueDate: Date;
  daysOverdue: number;
  amountDue: number;
};

export type PaymentRow = {
  id: string;
  date: Date;
  method: string;
  amount: number;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
};

export type DashboardData = {
  kpis: {
    activeSubscriptions: number;
    mrr: number;
    collected: number;
    collectedCount: number;
    outstanding: number;
    outstandingCount: number;
    overdue: number;
    overdueCount: number;
    newSubscriptions: number;
  };
  chart: ChartPoint[];
  overdueInvoices: OverdueRow[];
  recentPayments: PaymentRow[];
  plans: { id: string; name: string }[];
};

/** Postgres BigInt and numeric results come back as bigint or number. Normalize to number. */
const toNum = (v: bigint | number | string | null | undefined): number => (v == null ? 0 : Number(v));

const MONTH_FMT = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });
const MONTH_YEAR_FMT = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

function monthKey(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

/**
 * Everything the finance dashboard shows, fetched in one Promise.all.
 * `now` is today (UTC midnight). The date range applies to collections and new subscriptions;
 * the plan filter applies wherever it makes sense (subscriptions, MRR, invoices, payments).
 */
export async function getDashboardData(filters: DashboardFilters): Promise<DashboardData> {
  const { from, to, planId } = filters;
  const now = today();
  const toExclusive = addDays(to, 1);

  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const chartStart = addMonths(thisMonth, -11);
  const chartEnd = addMonths(thisMonth, 1); // exclusive

  const subPlanWhere: Prisma.SubscriptionWhereInput = planId ? { planId } : {};
  const invoicePlanWhere: Prisma.InvoiceWhereInput = planId ? { subscription: { planId } } : {};
  const paymentPlanWhere: Prisma.PaymentWhereInput = planId ? { invoice: { subscription: { planId } } } : {};

  const subPlanSql = planId ? Prisma.sql`AND s."planId" = ${planId}` : Prisma.empty;
  const invoicePlanSql = planId
    ? Prisma.sql`AND i."subscriptionId" IN (SELECT s."id" FROM "Subscription" s WHERE s."planId" = ${planId})`
    : Prisma.empty;
  const paymentPlanSql = planId
    ? Prisma.sql`AND p."invoiceId" IN (SELECT i."id" FROM "Invoice" i JOIN "Subscription" s ON s."id" = i."subscriptionId" WHERE s."planId" = ${planId})`
    : Prisma.empty;

  const [
    activeSubscriptions,
    mrrRows,
    collectedAgg,
    receivableRows,
    newSubscriptions,
    invoicedRows,
    collectedRows,
    overdueRows,
    recentPaymentRows,
    plans,
  ] = await Promise.all([
    prisma.subscription.count({ where: { status: "ACTIVE", ...subPlanWhere } }),

    // PLAN §9: normalize every active subscription to a monthly amount in one statement.
    prisma.$queryRaw<{ mrr: bigint | number | null }[]>`
      SELECT COALESCE(SUM(CASE p."billingPeriod"
        WHEN 'DAILY' THEN s."recurringTotal" * 30
        WHEN 'WEEKLY' THEN s."recurringTotal" * 52 / 12
        WHEN 'MONTHLY' THEN s."recurringTotal"
        WHEN 'YEARLY' THEN s."recurringTotal" / 12 END), 0)::bigint AS mrr
      FROM "Subscription" s
      JOIN "Plan" p ON p.id = s."planId"
      WHERE s.status = 'ACTIVE' ${subPlanSql}`,

    prisma.payment.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { date: { gte: from, lte: to }, ...paymentPlanWhere },
    }),

    // Outstanding = unpaid balance on CONFIRMED invoices. Overdue = the part whose due date has passed.
    prisma.$queryRaw<
      {
        outstanding: bigint | number | null;
        outstandingCount: bigint | number | null;
        overdue: bigint | number | null;
        overdueCount: bigint | number | null;
      }[]
    >`
      SELECT
        COALESCE(SUM(i."total" - i."amountPaid"), 0)::bigint AS outstanding,
        COUNT(*)::bigint AS "outstandingCount",
        COALESCE(SUM(CASE WHEN i."dueDate" < ${now}::date THEN i."total" - i."amountPaid" ELSE 0 END), 0)::bigint AS overdue,
        COUNT(*) FILTER (WHERE i."dueDate" < ${now}::date)::bigint AS "overdueCount"
      FROM "Invoice" i
      WHERE i.status = 'CONFIRMED' AND (i."total" - i."amountPaid") > 0 ${invoicePlanSql}`,

    prisma.subscription.count({
      where: { createdAt: { gte: from, lt: toExclusive }, ...subPlanWhere },
    }),

    // 12-month series: invoices by issue month, excluding cancelled ones.
    prisma.$queryRaw<{ m: Date | string; v: bigint | number | null }[]>`
      SELECT date_trunc('month', i."issueDate"::timestamp)::date AS m,
             COALESCE(SUM(i."total"), 0)::bigint AS v
      FROM "Invoice" i
      WHERE i.status <> 'CANCELLED'
        AND i."issueDate" >= ${chartStart}::date
        AND i."issueDate" < ${chartEnd}::date ${invoicePlanSql}
      GROUP BY 1 ORDER BY 1`,

    // 12-month series: payments by payment month.
    prisma.$queryRaw<{ m: Date | string; v: bigint | number | null }[]>`
      SELECT date_trunc('month', p."date"::timestamp)::date AS m,
             COALESCE(SUM(p."amount"), 0)::bigint AS v
      FROM "Payment" p
      WHERE p."date" >= ${chartStart}::date
        AND p."date" < ${chartEnd}::date ${paymentPlanSql}
      GROUP BY 1 ORDER BY 1`,

    prisma.invoice.findMany({
      where: { status: "CONFIRMED", dueDate: { lt: now }, ...invoicePlanWhere },
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
      take: 10,
      select: {
        id: true,
        number: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        customer: { select: { name: true } },
      },
    }),

    prisma.payment.findMany({
      where: paymentPlanWhere,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        date: true,
        method: true,
        amount: true,
        invoice: {
          select: { id: true, number: true, customer: { select: { name: true } } },
        },
      },
    }),

    prisma.plan.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const receivable = receivableRows[0];

  // Build the 12 month buckets, oldest first, then fill them from the grouped rows.
  const invoicedByMonth = new Map<string, number>();
  for (const r of invoicedRows) invoicedByMonth.set(monthKey(r.m), toNum(r.v));
  const collectedByMonth = new Map<string, number>();
  for (const r of collectedRows) collectedByMonth.set(monthKey(r.m), toNum(r.v));

  const chart: ChartPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const d = addMonths(chartStart, i);
    const key = monthKey(d);
    chart.push({
      month: MONTH_FMT.format(d),
      title: MONTH_YEAR_FMT.format(d),
      invoiced: invoicedByMonth.get(key) ?? 0,
      collected: collectedByMonth.get(key) ?? 0,
    });
  }

  return {
    kpis: {
      activeSubscriptions,
      mrr: toNum(mrrRows[0]?.mrr),
      collected: toNum(collectedAgg._sum.amount),
      collectedCount: collectedAgg._count._all,
      outstanding: toNum(receivable?.outstanding),
      outstandingCount: toNum(receivable?.outstandingCount),
      overdue: toNum(receivable?.overdue),
      overdueCount: toNum(receivable?.overdueCount),
      newSubscriptions,
    },
    chart,
    overdueInvoices: overdueRows.map((r) => ({
      id: r.id,
      number: r.number,
      customerName: r.customer.name,
      dueDate: r.dueDate,
      daysOverdue: diffDays(now, r.dueDate),
      amountDue: r.total - r.amountPaid,
    })),
    recentPayments: recentPaymentRows.map((p) => ({
      id: p.id,
      date: p.date,
      method: p.method,
      amount: p.amount,
      invoiceId: p.invoice.id,
      invoiceNumber: p.invoice.number,
      customerName: p.invoice.customer.name,
    })),
    plans,
  };
}
