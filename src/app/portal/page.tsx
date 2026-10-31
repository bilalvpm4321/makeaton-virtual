import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCustomer } from "@/lib/auth/guards";
import { diffDays, formatDate, PERIOD_SHORT, today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/db";
import { amountDue, displayStatus, isOverdue } from "./_lib/invoice-view";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const { user, customerId } = await requireCustomer();
  const now = today();

  const [activeCount, pendingQuote, nextInvoice, receivable, subscriptions, invoices] = await Promise.all([
    prisma.subscription.count({ where: { customerId, status: "ACTIVE" } }),

    prisma.subscription.findFirst({
      where: { customerId, status: "QUOTATION" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),

    prisma.subscription.findFirst({
      where: { customerId, status: "ACTIVE", nextInvoiceDate: { gte: now } },
      orderBy: { nextInvoiceDate: "asc" },
      select: { nextInvoiceDate: true },
    }),

    prisma.$queryRaw<{ due: bigint | number | null; overdueCount: bigint | number | null }[]>`
      SELECT COALESCE(SUM("total" - "amountPaid"), 0)::bigint AS due,
             COUNT(*) FILTER (WHERE "dueDate" < ${now}::date)::bigint AS "overdueCount"
      FROM "Invoice"
      WHERE "customerId" = ${customerId}
        AND status = 'CONFIRMED'
        AND ("total" - "amountPaid") > 0`,

    prisma.subscription.findMany({
      where: { customerId, status: { not: "DRAFT" } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 25,
      select: {
        id: true,
        number: true,
        status: true,
        validUntil: true,
        nextInvoiceDate: true,
        recurringTotal: true,
        plan: { select: { name: true, billingPeriod: true } },
      },
    }),

    prisma.invoice.findMany({
      where: { customerId, status: { not: "DRAFT" } },
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
      take: 25,
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
      },
    }),
  ]);

  const due = Number(receivable[0]?.due ?? 0);
  const overdueCount = Number(receivable[0]?.overdueCount ?? 0);
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's where your subscriptions and bills stand."
      />

      {pendingQuote ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-amber-900">You have a quotation waiting for review.</p>
          <Link href={`/portal/subscriptions/${pendingQuote.id}`} className={buttonVariants({ size: "sm" })}>
            Review quote
            <ArrowRight />
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Active subscriptions" value={activeCount} hint="Currently running" />
        <KpiCard
          label="Amount due"
          value={formatMoney(due)}
          tone={overdueCount > 0 ? "danger" : "default"}
          hint={overdueCount > 0 ? `${overdueCount} overdue` : "Nothing overdue"}
        />
        <KpiCard
          label="Next invoice"
          value={nextInvoice ? formatDate(nextInvoice.nextInvoiceDate) : "—"}
          hint={nextInvoice ? "Billed in advance" : "No upcoming invoice"}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>My subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {subscriptions.length === 0 ? (
            <EmptyState
              title="No subscriptions yet"
              description="Browse our plans to get started."
              action={
                <Link href="/portal/plans" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Browse plans
                </Link>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Next invoice</TableHead>
                  <TableHead className="text-right">Recurring</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => {
                  const expiredQuote = sub.status === "QUOTATION" && sub.validUntil !== null && sub.validUntil < now;
                  return (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <Link
                          href={`/portal/subscriptions/${sub.id}`}
                          className="font-mono font-medium hover:text-neutral-900 hover:underline"
                        >
                          {sub.number}
                        </Link>
                      </TableCell>
                      <TableCell>{sub.plan.name}</TableCell>
                      <TableCell className="font-mono text-neutral-600">
                        {sub.status === "ACTIVE" ? formatDate(sub.nextInvoiceDate) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatMoney(sub.recurringTotal)}
                        <span className="text-xs text-neutral-500"> / {PERIOD_SHORT[sub.plan.billingPeriod]}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={expiredQuote ? "EXPIRED" : sub.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>My invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" description="Invoices appear here once your billing period starts." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Amount due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const overdue = isOverdue(inv, now);
                  const owed = amountDue(inv);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/portal/invoices/${inv.id}`}
                          className="font-mono font-medium hover:text-neutral-900 hover:underline"
                        >
                          {inv.number}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-neutral-600">{formatDate(inv.issueDate)}</TableCell>
                      <TableCell className="font-mono">
                        <span className={overdue ? "text-red-700" : "text-neutral-600"}>{formatDate(inv.dueDate)}</span>
                        {overdue ? (
                          <div className="text-xs text-red-700">{diffDays(now, inv.dueDate)} days overdue</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatMoney(inv.total)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {owed > 0 ? formatMoney(owed) : <span className="text-neutral-400">—</span>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={displayStatus(inv, now)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
