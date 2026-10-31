import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/dates";
import { formatBps, formatMoney } from "@/lib/money";
import type { InvoiceForDocument } from "./invoice-data";

const MINUS = "−";

const LABEL = "mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500";

/**
 * The invoice as a document. Used by the back office detail screen and the A4 print view.
 * Totals come from the stored invoice (computed by src/lib/billing/*), never recomputed here.
 */
export function InvoiceDocument({
  invoice,
  overdue,
  amountDue,
}: {
  invoice: InvoiceForDocument;
  overdue: boolean;
  amountDue: number;
}) {
  const status = overdue ? "OVERDUE" : invoice.status;
  const period =
    invoice.periodStart && invoice.periodEnd
      ? `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
      : "—";

  return (
    <article className="print-sheet relative rounded-lg border border-neutral-200 bg-white p-6 text-[13px] text-neutral-900 sm:p-10 print:border-0 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-lg font-semibold tracking-tight">Brightloop</p>
          <div className="mt-3 space-y-0.5 text-xs leading-relaxed text-neutral-500">
            <p>Brightloop Pvt Ltd</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[40px] leading-none font-semibold tracking-tight">Invoice</p>
          <p className="mt-2 font-mono text-sm tabular-nums">{invoice.number}</p>
          <div className="mt-2 flex justify-end">
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        <div>
          <p className={LABEL}>Bill to</p>
          <p className="font-semibold">{invoice.customer.company || invoice.customer.name}</p>
          {invoice.customer.company ? <p className="text-neutral-600">{invoice.customer.name}</p> : null}
          <p className="text-neutral-600">{invoice.customer.email}</p>
          {invoice.customer.address ? (
            <p className="whitespace-pre-line text-neutral-600">{invoice.customer.address}</p>
          ) : null}
          {invoice.customer.taxId ? <p className="text-neutral-600">GSTIN {invoice.customer.taxId}</p> : null}
        </div>
        <div>
          <p className={LABEL}>Details</p>
          <dl className="space-y-1">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Issue date</dt>
              <dd className="tabular-nums">{formatDate(invoice.issueDate)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Due date</dt>
              <dd className={overdue ? "font-medium tabular-nums text-red-600" : "tabular-nums"}>
                {formatDate(invoice.dueDate)}
              </dd>
            </div>
            {invoice.subscription ? (
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Subscription</dt>
                <dd className="font-mono tabular-nums">{invoice.subscription.number}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div>
          <p className={LABEL}>Period</p>
          <p className="tabular-nums">{period}</p>
        </div>
      </div>

      <div className="relative mt-10 w-full overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-neutral-900/80 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
              <th className="py-2 pr-3 font-semibold">Description</th>
              <th className="py-2 px-3 text-right font-semibold">Qty</th>
              <th className="py-2 px-3 text-right font-semibold">Unit price</th>
              <th className="py-2 px-3 text-right font-semibold">Discount</th>
              <th className="py-2 px-3 text-right font-semibold">Tax</th>
              <th className="py-2 pl-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id} className="border-b border-neutral-200 align-top">
                <td className="py-2.5 pr-3">{l.description}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.quantity}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(l.unitPrice)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                  {l.discountAmount > 0 ? `${MINUS}${formatMoney(l.discountAmount)}` : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600">
                  {l.taxRateBps > 0 ? (
                    <>
                      <span className="block">{l.taxName ?? "Tax"}</span>
                      <span className="text-[11px] text-neutral-400">{formatBps(l.taxRateBps)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 pl-3 text-right tabular-nums">{formatMoney(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto mt-6 w-full max-w-xs space-y-2 text-[13px] tabular-nums">
        <div className="flex justify-between">
          <span className="text-neutral-500">Subtotal</span>
          <span>{formatMoney(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Discount</span>
          <span className="text-emerald-700">
            {invoice.discountTotal > 0 ? `${MINUS}${formatMoney(invoice.discountTotal)}` : formatMoney(0)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Tax</span>
          <span>{formatMoney(invoice.taxTotal)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-900/80 pt-3 text-base font-semibold">
          <span>Total</span>
          <span>{formatMoney(invoice.total)}</span>
        </div>
        <div className="flex justify-between text-neutral-600">
          <span>Paid</span>
          <span>{formatMoney(invoice.amountPaid)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Amount due</span>
          {amountDue > 0 ? (
            <span className={overdue ? "text-red-600" : ""}>{formatMoney(amountDue)}</span>
          ) : (
            <span className="text-emerald-700">Paid in full</span>
          )}
        </div>
      </div>

      <div className="mt-12 border-t border-neutral-200 pt-6 text-xs text-neutral-500">
        <p>
          Pay by bank transfer to Brightloop Pvt Ltd · HDFC Bank · A/C 50200012345678 · IFSC HDFC0001234. Please quote
          the invoice number.
        </p>
      </div>

      {invoice.status === "PAID" ? (
        <div className="pointer-events-none absolute right-12 top-40 rotate-[-12deg] rounded-md border-2 border-emerald-600/80 px-3 py-1 text-lg font-bold uppercase tracking-widest text-emerald-700/80">
          Paid
        </div>
      ) : null}
    </article>
  );
}
