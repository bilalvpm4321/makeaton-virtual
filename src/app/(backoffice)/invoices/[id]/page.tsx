import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Check, Printer, Send, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { diffDays, formatDate, formatDateInput, today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { InvoiceActionButton } from "../_shared/action-button";
import { InvoiceDocument } from "../_shared/invoice-document";
import { getInvoiceForDocument } from "../_shared/invoice-data";
import { PAYMENT_METHOD_LABELS, type PaymentMethodValue } from "../_shared/payment-methods";
import { RecordPaymentForm } from "../_shared/record-payment-form";
import { cancelInvoice, confirmInvoice, sendInvoice } from "@/server/actions/invoices";

export const dynamic = "force-dynamic";

const stampFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const day = today();

  const [invoice, activity] = await Promise.all([
    getInvoiceForDocument(id),
    prisma.activity.findMany({
      where: { entityType: "invoice", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, message: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);
  if (!invoice) notFound();

  const amountDue = invoice.total - invoice.amountPaid;
  const overdue = invoice.status === "CONFIRMED" && invoice.dueDate < day && amountDue > 0;
  const daysOverdue = overdue ? diffDays(day, invoice.dueDate) : 0;

  const canManage = can(user, "invoices.manage");
  const canPay = can(user, "payments.record");
  const canCancel = invoice.status === "DRAFT" || (invoice.status === "CONFIRMED" && invoice.amountPaid === 0);

  return (
    <div>
      <nav className="mb-2 flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/invoices" className="hover:text-neutral-900 hover:underline underline-offset-4">
          Invoices
        </Link>
        <span aria-hidden>›</span>
        <span className="font-mono tabular-nums text-neutral-900">{invoice.number}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{invoice.number}</h1>
            <StatusBadge status={overdue ? "OVERDUE" : invoice.status} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {invoice.customer.name}
            {invoice.subscription ? ` · ${invoice.subscription.number}` : ""}
            {` · issued ${formatDate(invoice.issueDate)}`}
            {invoice.sentAt ? ` · emailed ${stampFormatter.format(invoice.sentAt)}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && invoice.status === "DRAFT" ? (
            <InvoiceActionButton
              action={confirmInvoice}
              invoiceId={invoice.id}
              label="Confirm"
              icon={<Check />}
              variant="default"
              pendingText="Confirming…"
            />
          ) : null}
          {canManage && (invoice.status === "CONFIRMED" || invoice.status === "PAID") ? (
            <InvoiceActionButton
              action={sendInvoice}
              invoiceId={invoice.id}
              label={invoice.sentAt ? "Send again" : "Send"}
              icon={<Send />}
              pendingText="Sending…"
            />
          ) : null}
          {canManage && canCancel ? (
            <InvoiceActionButton
              action={cancelInvoice}
              invoiceId={invoice.id}
              label="Cancel invoice"
              icon={<X />}
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              confirmText={`Cancel invoice ${invoice.number}? Discount usage on it will be released. This cannot be undone.`}
              pendingText="Cancelling…"
            />
          ) : null}
          <a
            href={`/invoices/${invoice.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <Printer />
            Print
          </a>
        </div>
      </div>

      {overdue ? (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            Overdue by {daysOverdue === 1 ? "1 day" : `${daysOverdue} days`}. {formatMoney(amountDue)} is due.
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <InvoiceDocument invoice={invoice} overdue={overdue} amountDue={amountDue} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-neutral-500">No payments recorded yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-200 text-sm">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {PAYMENT_METHOD_LABELS[p.method as PaymentMethodValue] ?? p.method}
                        </p>
                        <p className="text-xs tabular-nums text-neutral-500">
                          {formatDate(p.date)}
                          {p.recordedBy ? ` · ${p.recordedBy.name}` : ""}
                        </p>
                        {p.note ? <p className="truncate text-xs text-neutral-500">{p.note}</p> : null}
                      </div>
                      <Money value={p.amount} className="font-medium" />
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
                <span className="text-sm text-neutral-500">Amount due</span>
                <span
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    amountDue === 0 ? "text-emerald-700" : overdue ? "text-red-600" : "text-neutral-900",
                  )}
                >
                  {amountDue === 0 ? "Paid in full" : formatMoney(amountDue)}
                </span>
              </div>
            </CardContent>
          </Card>

          {invoice.status === "CONFIRMED" && canPay && amountDue > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Record payment</CardTitle>
              </CardHeader>
              <CardContent>
                <RecordPaymentForm
                  invoiceId={invoice.id}
                  amountDueMinor={amountDue}
                  amountDueLabel={formatMoney(amountDue)}
                  amountDueInput={(amountDue / 100).toFixed(2)}
                  defaultDate={formatDateInput(day)}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <EmptyState title="No activity yet" />
              ) : (
                <ol className="relative ml-2 space-y-5 border-l border-neutral-200 py-1">
                  {activity.map((a) => (
                    <li key={a.id} className="relative pl-5">
                      <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-neutral-900 ring-4 ring-white" />
                      <p className="text-sm">{a.message}</p>
                      <p className="text-xs text-neutral-500">
                        {a.user?.name ?? "System"} · {stampFormatter.format(a.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
