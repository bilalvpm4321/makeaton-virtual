import { formatDate, PERIOD_SHORT, type Period } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

/** Signed amount for adjustments, e.g. +₹560.00 or −₹50.00. */
export function signedMoney(minor: number): string {
  return `${minor < 0 ? "−" : "+"}${formatMoney(Math.abs(minor))}`;
}

/** "12 months", "1 week", or "Open-ended" when there is no term. */
export function formatTerm(termLength: number | null, period: Period): string {
  if (termLength === null) return "Open-ended";
  return `${termLength} ${PERIOD_SHORT[period]}${termLength === 1 ? "" : "s"}`;
}

/** "Always", "1 Oct 2026 – open", or "1 Oct 2026 – 31 Dec 2026". */
export function formatAvailability(from: Date | null, until: Date | null): string {
  if (!from && !until) return "Always";
  return `${from ? formatDate(from) : "…"} – ${until ? formatDate(until) : "open"}`;
}

/** Discount validity, same shape as availability. */
export function formatValidity(start: Date | null, end: Date | null): string {
  if (!start && !end) return "Open-ended";
  return `${start ? formatDate(start) : "Any time"} – ${end ? formatDate(end) : "no end"}`;
}
