import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronRight, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireCustomer } from "@/lib/auth/guards";
import { diffDays, formatDate, today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/db";
import { InvoiceDocument, type DocumentInvoice } from "../../_components/invoice-document";
import { amountDue, displayStatus, isOverdue } from "../../_lib/invoice-view";

export const dynamic = "force-dynamic";

export default async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { customerId } = await requireCustomer();
  const now = today();

  // Ownership and visibility: only this customer's own, non-draft invoices.
  const invoice = await prisma.invoice.findFirst({
    where: { id, customerId, status: { not: "DRAFT" } },
    select: {
      id: true,
      number: true,
      status: true,
      issueDate: true,
      dueDate: true,
      periodStart: true,
      periodEnd: true,
      subtotal: true,
      discountTotal: true,
      taxTotal: true,
      total: true,
      amountPaid: true,
      subscription: { select: { number: true } },
      customer: { select: { name: true, email: true, address: true } },
      lines: {
        select: {
          description: true,
          quantity: true,
          unitPrice: true,
          subtotal: true,
          discountAmount: true,
          taxName: true,
          taxRateBps: true,
          taxAmount: true,
          total: true,
        },
      },
    },
  });
  if (!invoice) notFound();

  const overdue = isOverdue(invoice, now);
  const owed = amountDue(invoice);
  const doc: DocumentInvoice = {
    number: invoice.number,
    displayStatus: displayStatus(invoice, now),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    subscriptionNumber: invoice.subscription?.number ?? null,
    customer: invoice.customer,
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    amountDue: owed,
    lines: invoice.lines,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="mb-1.5 flex items-center gap-1 text-xs text-neutral-500">
            <Link href="/portal" className="hover:text-neutral-900 hover:underline">
              Home
            </Link>
            <ChevronRight className="size-3" />
            <span className="font-mono">{invoice.number}</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight">Invoice {invoice.number}</h1>
        </div>
        <Link
          href={`/invoices/${invoice.id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          <Printer />
          Print / Download
        </Link>
      </div>

      {overdue ? (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            Overdue by {diffDays(now, invoice.dueDate)} {diffDays(now, invoice.dueDate) === 1 ? "day" : "days"}.{" "}
            {formatMoney(owed)} is due.
          </span>
        </div>
      ) : null}

      <InvoiceDocument invoice={doc} />

      <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
        Pay by bank transfer to Brightloop Software, A/C 000123456789, IFSC BRGT0000123 — quote the invoice number.
      </p>
      <p className="text-xs text-neutral-500">Due date: {formatDate(invoice.dueDate)}</p>
    </div>
  );
}
