import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { customerActionsFor } from "@/app/portal/_lib/customer-actions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { StatusStepper } from "@/components/status-stepper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCustomer } from "@/lib/auth/guards";
import { computeInvoiceDraft } from "@/lib/billing/compute";
import { formatDate, PERIOD_LABELS, PERIOD_SHORT, today } from "@/lib/dates";
import { formatBps, formatMoney } from "@/lib/money";
import { prisma } from "@/lib/db";
import { SubscriptionActions } from "./_components/subscription-actions";

export const dynamic = "force-dynamic";

export default async function PortalSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { customerId } = await requireCustomer();
  const now = today();

  // Ownership: the id must belong to the logged-in customer. Drafts are internal and never shown.
  const sub = await prisma.subscription.findFirst({
    where: { id, customerId, status: { not: "DRAFT" } },
    select: {
      id: true,
      number: true,
      status: true,
      startDate: true,
      expiryDate: true,
      nextInvoiceDate: true,
      validUntil: true,
      termPeriods: true,
      recurringTotal: true,
      closedAt: true,
      closeReason: true,
      plan: {
        select: {
          name: true,
          billingPeriod: true,
          termLength: true,
          closable: true,
          pausable: true,
          renewable: true,
        },
      },
      paymentTerm: { select: { name: true } },
      lines: {
        select: {
          productId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          tax: { select: { name: true, rateBps: true } },
        },
      },
      _count: { select: { lines: true } },
    },
  });
  if (!sub) notFound();

  // Same engine as billing, without discounts: shows the untaxed and taxed amount per period.
  const draft = computeInvoiceDraft(
    sub.lines.map((l) => ({
      productId: l.productId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxName: l.tax?.name ?? null,
      taxRateBps: l.tax?.rateBps ?? 0,
    })),
    [],
    now,
  );

  const actions = customerActionsFor(
    {
      status: sub.status,
      validUntil: sub.validUntil,
      termPeriods: sub.termPeriods,
      lineCount: sub._count.lines,
    },
    sub.plan,
    now,
  );

  const isQuotation = sub.status === "QUOTATION";
  const quoteExpired = isQuotation && sub.validUntil !== null && sub.validUntil < now;
  const period = PERIOD_SHORT[sub.plan.billingPeriod];
  const termText = sub.termPeriods
    ? `${sub.termPeriods} ${sub.termPeriods === 1 ? PERIOD_SHORT[sub.plan.billingPeriod] : `${PERIOD_SHORT[sub.plan.billingPeriod]}s`}`
    : "Open-ended";

  return (
    <div className="space-y-6">
      <div>
        <nav className="mb-1.5 flex items-center gap-1 text-xs text-neutral-500">
          <Link href="/portal" className="hover:text-neutral-900 hover:underline">
            My subscriptions
          </Link>
          <ChevronRight className="size-3" />
          <span className="font-mono">{sub.number}</span>
        </nav>
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-3">
              <span className="font-mono">{sub.number}</span>
              <StatusBadge status={quoteExpired ? "EXPIRED" : sub.status} />
            </span>
          }
          description={`${sub.plan.name} · ${PERIOD_LABELS[sub.plan.billingPeriod]} billing`}
        />
      </div>

      <Card className="px-5 py-4">
        <StatusStepper status={sub.status} />
      </Card>

      {isQuotation ? (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader>
            <CardTitle>Review your quotation</CardTitle>
            <CardDescription>
              {sub.validUntil
                ? quoteExpired
                  ? `This quotation expired on ${formatDate(sub.validUntil)}. Ask us for a new quote.`
                  : `Valid until ${formatDate(sub.validUntil)}.`
                : "Review the lines below and accept or decline."}
            </CardDescription>
          </CardHeader>
          {actions.length > 0 ? (
            <CardContent>
              <div className="max-w-sm">
                <SubscriptionActions subscriptionId={sub.id} actions={actions} />
              </div>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Lines</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.lines.map((line, i) => (
                  <TableRow key={`${i}-${line.productId}`}>
                    <TableCell className="whitespace-normal">{line.description}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{line.quantity}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatMoney(line.unitPrice)}</TableCell>
                    <TableCell className="text-neutral-600">
                      {line.taxName ? `${line.taxName} (${formatBps(line.taxRateBps)})` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatMoney(line.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="ml-auto grid w-full max-w-72 gap-1.5 p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Untaxed</span>
                <span className="font-mono tabular-nums">{formatMoney(draft.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Tax</span>
                <span className="font-mono tabular-nums">{formatMoney(draft.taxTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-2 font-semibold">
                <span>Per {period}</span>
                <span className="font-mono tabular-nums">{formatMoney(draft.total)}</span>
              </div>
              <p className="pt-1 text-xs text-neutral-500">Before any discounts that apply to your account.</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Plan</dt>
                  <dd className="text-right">{sub.plan.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Billing</dt>
                  <dd className="text-right">{PERIOD_LABELS[sub.plan.billingPeriod]}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Payment terms</dt>
                  <dd className="text-right">{sub.paymentTerm.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Start date</dt>
                  <dd className="text-right font-mono">{formatDate(sub.startDate)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Term</dt>
                  <dd className="text-right">{termText}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Expiry</dt>
                  <dd className="text-right font-mono">{formatDate(sub.expiryDate)}</dd>
                </div>
                {sub.status === "ACTIVE" || sub.status === "PAUSED" ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Next invoice</dt>
                    <dd className="text-right font-mono">
                      {sub.status === "PAUSED" ? "Paused" : formatDate(sub.nextInvoiceDate)}
                    </dd>
                  </div>
                ) : null}
                {isQuotation && sub.validUntil ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Valid until</dt>
                    <dd className="text-right font-mono">{formatDate(sub.validUntil)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-neutral-200 pt-2.5">
                  <dt className="text-neutral-500">Recurring</dt>
                  <dd className="text-right font-mono tabular-nums">
                    {formatMoney(sub.recurringTotal)}
                    <span className="text-xs text-neutral-500"> / {period}</span>
                  </dd>
                </div>
              </dl>
              {sub.status === "CLOSED" && sub.closeReason ? (
                <p className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  Closed on {formatDate(sub.closedAt)}: {sub.closeReason}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {!isQuotation && actions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Manage subscription</CardTitle>
                <CardDescription>Only the options your plan allows are shown.</CardDescription>
              </CardHeader>
              <CardContent>
                <SubscriptionActions subscriptionId={sub.id} actions={actions} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
