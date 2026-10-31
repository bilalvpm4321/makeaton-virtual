// Pure display helpers for invoices shown to customers. Derived states are never stored (PLAN §6.8).

export type InvoiceAmounts = {
  status: string;
  dueDate: Date;
  total: number;
  amountPaid: number;
};

export function amountDue(inv: Pick<InvoiceAmounts, "total" | "amountPaid">): number {
  return inv.total - inv.amountPaid;
}

/** Overdue = CONFIRMED, due date already passed, and something still owed. */
export function isOverdue(inv: InvoiceAmounts, now: Date): boolean {
  return inv.status === "CONFIRMED" && inv.dueDate < now && amountDue(inv) > 0;
}

/** Status shown in badges: the stored status, or OVERDUE when derived as overdue. */
export function displayStatus(inv: InvoiceAmounts, now: Date): string {
  return isOverdue(inv, now) ? "OVERDUE" : inv.status;
}
