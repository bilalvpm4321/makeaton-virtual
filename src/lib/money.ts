const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "INR";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format an integer amount in minor units (paise) for display, e.g. 56000 -> "₹560.00". */
export function formatMoney(minor: number): string {
  return moneyFormatter.format(minor / 100);
}

/** Convert a user-entered major-unit value ("560.50", 560.5) to minor units (56050). NaN -> 0. */
export function toMinor(v: string | number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Minor units to a plain two-decimal string for form inputs, e.g. 56000 -> "560.00". */
export function fromMinor(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** Basis points to a percentage label: 1800 -> "18%", 1250 -> "12.5%". */
export function formatBps(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}
