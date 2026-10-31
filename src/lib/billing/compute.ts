// PURE: no prisma import. See PLAN.md §6.6.

export type ComputeLine = {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxName: string | null;
  taxRateBps: number;
};

export type ComputeDiscount = {
  id: string;
  name: string;
  type: "PERCENT" | "FIXED";
  value: number;
  scope: "SUBSCRIPTION" | "PRODUCTS";
  productIds: string[];
  minPurchase: number;
  minQuantity: number;
  startDate: Date | null;
  endDate: Date | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  createdAt: Date;
};

export type InvoiceLineDraft = ComputeLine & {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
};

export type InvoiceDraft = {
  lines: InvoiceLineDraft[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  appliedDiscounts: { discountId: string; name: string; amount: number }[];
};

type WorkLine = ComputeLine & { subtotal: number; discountAmount: number };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Splits `amount` across eligible lines in proportion to their remaining net.
 * Rounding remainder goes to the last eligible line; no line net goes below 0.
 */
function allocate(eligible: WorkLine[], amount: number) {
  const nets = eligible.map((l) => l.subtotal - l.discountAmount);
  const base = sum(nets);
  const n = eligible.length;
  const allocs: number[] = new Array(n).fill(0);
  let remaining = amount;

  for (let i = 0; i < n - 1; i++) {
    const share = base > 0 ? Math.round((amount * nets[i]) / base) : 0;
    const a = Math.max(0, Math.min(nets[i], remaining, share));
    allocs[i] = a;
    remaining -= a;
  }
  if (n > 0) {
    const a = Math.max(0, Math.min(nets[n - 1], remaining));
    allocs[n - 1] = a;
    remaining -= a;
  }
  // Defensive: rounding can leave a few units unallocated; hand them out where there is room.
  for (let i = 0; i < n && remaining > 0; i++) {
    const take = Math.min(nets[i] - allocs[i], remaining);
    if (take > 0) {
      allocs[i] += take;
      remaining -= take;
    }
  }

  eligible.forEach((l, i) => {
    l.discountAmount += allocs[i];
  });
}

export function computeInvoiceDraft(
  lines: ComputeLine[],
  discounts: ComputeDiscount[],
  onDate: Date,
): InvoiceDraft {
  const work: WorkLine[] = lines.map((l) => ({
    ...l,
    subtotal: l.quantity * l.unitPrice,
    discountAmount: 0,
  }));

  const appliedDiscounts: InvoiceDraft["appliedDiscounts"] = [];
  const ordered = [...discounts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const d of ordered) {
    if (!d.isActive) continue;
    if (d.startDate && onDate < d.startDate) continue;
    if (d.endDate && onDate > d.endDate) continue;
    if (d.usageLimit != null && d.usageCount >= d.usageLimit) continue;

    const eligible =
      d.scope === "PRODUCTS" ? work.filter((l) => d.productIds.includes(l.productId)) : work;
    if (eligible.length === 0) continue;

    const base = sum(eligible.map((l) => l.subtotal - l.discountAmount));
    const qty = sum(eligible.map((l) => l.quantity));
    if (base < d.minPurchase || qty < d.minQuantity) continue;

    const amount =
      d.type === "PERCENT" ? Math.round((base * d.value) / 10000) : Math.min(d.value, base);
    if (amount <= 0) continue;

    allocate(eligible, amount);
    appliedDiscounts.push({ discountId: d.id, name: d.name, amount });
  }

  const drafted: InvoiceLineDraft[] = work.map((l) => {
    const net = l.subtotal - l.discountAmount;
    const taxAmount = Math.round((net * l.taxRateBps) / 10000);
    return { ...l, taxAmount, total: net + taxAmount };
  });

  const subtotal = sum(drafted.map((l) => l.subtotal));
  const discountTotal = sum(drafted.map((l) => l.discountAmount));
  const taxTotal = sum(drafted.map((l) => l.taxAmount));

  return {
    lines: drafted,
    subtotal,
    discountTotal,
    taxTotal,
    total: subtotal - discountTotal + taxTotal,
    appliedDiscounts,
  };
}
