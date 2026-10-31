import { prisma } from "@/lib/db";

/** Loads everything the invoice document and its detail screen need. Returns null when the id is unknown. */
export async function getInvoiceForDocument(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
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
      sentAt: true,
      paidAt: true,
      confirmedAt: true,
      cancelledAt: true,
      customerId: true,
      customer: {
        select: { name: true, email: true, company: true, address: true, taxId: true },
      },
      subscription: { select: { id: true, number: true } },
      lines: {
        orderBy: { id: "asc" },
        select: {
          id: true,
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
      payments: {
        orderBy: { date: "desc" },
        select: {
          id: true,
          date: true,
          method: true,
          amount: true,
          note: true,
          recordedBy: { select: { name: true } },
        },
      },
    },
  });
}

export type InvoiceForDocument = NonNullable<Awaited<ReturnType<typeof getInvoiceForDocument>>>;
