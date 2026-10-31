import { StatusBadge } from "@/components/status-badge";
import { formatBps, formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export type DocumentLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  taxName: string | null;
  taxRateBps: number;
  taxAmount: number;
  total: number;
};

export type DocumentInvoice = {
  number: string;
  displayStatus: string;
  issueDate: Date;
  dueDate: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
  subscriptionNumber: string | null;
  customer: { name: string; email: string; address: string | null };
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  lines: DocumentLine[];
};

/** Printable-style invoice body. Shared by the portal view; figures come from the billing engine, not computed here. */
export function InvoiceDocument({ invoice }: { invoice: DocumentInvoice }) {
  const paidInFull = invoice.amountDue <= 0;

  return (
    <article className="print-sheet rounded-lg border border-neutral-200 bg-white p-6 shadow-sm sm:p-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight">Brightloop Software</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            billing@brightloop.test
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-semibold tracking-tight">Invoice</p>
          <p className="mt-2 font-mono text-sm">{invoice.number}</p>
          <div className="mt-2 flex sm:justify-end">
            <StatusBadge status={invoice.displayStatus} />
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6 text-sm sm:grid-cols-3">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">Bill to</p>
          <p className="font-medium">{invoice.customer.name}</p>
          <p className="text-neutral-600">{invoice.customer.email}</p>
          {invoice.customer.address ? <p className="whitespace-pre-line text-neutral-600">{invoice.customer.address}</p> : null}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">Details</p>
          <p>
            Issued <span className="font-mono">{formatDate(invoice.issueDate)}</span>
          </p>
          <p>
            Due <span className="font-mono">{formatDate(invoice.dueDate)}</span>
          </p>
          {invoice.subscriptionNumber ? (
            <p>
              Subscription <span className="font-mono">{invoice.subscriptionNumber}</span>
            </p>
          ) : null}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">Period</p>
          {invoice.periodStart && invoice.periodEnd ? (
            <p className="font-mono">
              {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
            </p>
          ) : (
            <p className="text-neutral-500">—</p>
          )}
        </div>
      </div>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-800">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-3 font-medium">Description</th>
              <th className="py-2 px-3 text-right font-medium">Qty</th>
              <th className="py-2 px-3 text-right font-medium">Unit price</th>
              <th className="py-2 px-3 text-right font-medium">Discount</th>
              <th className="py-2 px-3 text-right font-medium">Tax</th>
              <th className="py-2 pl-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, i) => (
              <tr key={i} className="border-b border-neutral-200 align-top">
                <td className="py-2.5 pr-3">{line.description}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">{line.quantity}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatMoney(line.unitPrice)}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  {line.discountAmount > 0 ? `−${formatMoney(line.discountAmount)}` : "—"}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-600">
                  {line.taxName ? (
                    <>
                      {formatMoney(line.taxAmount)}
                      <span className="block text-[11px] text-neutral-500">
                        {line.taxName} {formatBps(line.taxRateBps)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 pl-3 text-right font-mono tabular-nums">{formatMoney(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto mt-6 grid w-full max-w-72 gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">Subtotal</span>
          <span className="font-mono tabular-nums">{formatMoney(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Discount</span>
          <span className="font-mono tabular-nums text-green-700">
            {invoice.discountTotal > 0 ? `−${formatMoney(invoice.discountTotal)}` : formatMoney(0)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Tax</span>
          <span className="font-mono tabular-nums">{formatMoney(invoice.taxTotal)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-800 pt-3 text-base font-semibold">
          <span>Total</span>
          <span className="font-mono tabular-nums">{formatMoney(invoice.total)}</span>
        </div>
        <div className="flex justify-between text-neutral-600">
          <span>Paid</span>
          <span className="font-mono tabular-nums">{formatMoney(invoice.amountPaid)}</span>
        </div>
        <div className={`flex justify-between font-medium ${paidInFull ? "text-green-700" : invoice.displayStatus === "OVERDUE" ? "text-red-700" : ""}`}>
          <span>{paidInFull ? "Paid in full" : "Amount due"}</span>
          {paidInFull ? null : <span className="font-mono tabular-nums">{formatMoney(invoice.amountDue)}</span>}
        </div>
      </div>
    </article>
  );
}
