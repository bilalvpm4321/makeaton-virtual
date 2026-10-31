import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/guards";
import { today } from "@/lib/dates";
import { getInvoiceForDocument } from "@/app/(backoffice)/invoices/_shared/invoice-data";
import { InvoiceDocument } from "@/app/(backoffice)/invoices/_shared/invoice-document";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

// A4 sheet and print-only rules. Kept here so the document itself stays print-agnostic.
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  .no-print { display: none !important; }
  html, body { background: #fff !important; }
  .print-sheet { box-shadow: none !important; border: 0 !important; padding: 0 !important; }
}
`;

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invoices/${id}/print`)}`);

  const invoice = await getInvoiceForDocument(id);
  if (!invoice) notFound();

  const isStaff = user.role === "ADMIN" || user.role === "STAFF";
  const isOwner = user.role === "CUSTOMER" && user.customerId !== null && user.customerId === invoice.customerId;
  if (!isStaff && !isOwner) notFound();

  const amountDue = invoice.total - invoice.amountPaid;
  const overdue = invoice.status === "CONFIRMED" && invoice.dueDate < today() && amountDue > 0;
  const back = isStaff ? `/invoices/${invoice.id}` : `/portal/invoices/${invoice.id}`;

  return (
    <div className="min-h-screen bg-neutral-100 py-10 print:min-h-0 print:bg-white print:py-0">
      <style>{PRINT_CSS}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[794px] items-center justify-between px-4">
        <Link href={back} className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft />
          Back
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[794px] px-4 print:max-w-none print:px-0">
        <InvoiceDocument invoice={invoice} overdue={overdue} amountDue={amountDue} />
      </div>
    </div>
  );
}
