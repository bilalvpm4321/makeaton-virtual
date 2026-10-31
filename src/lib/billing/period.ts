import { addDays, addPeriod, type Period } from "@/lib/dates";

/** Start of billing period k (0-based). Always computed from the startDate anchor, never chained. */
export function periodStart(startDate: Date, period: Period, k: number): Date {
  return addPeriod(startDate, period, k);
}

/** Last day of billing period k (inclusive). */
export function periodEnd(startDate: Date, period: Period, k: number): Date {
  return addDays(periodStart(startDate, period, k + 1), -1);
}

/** Expiry date (inclusive) of a term, or null for open-ended subscriptions. */
export function expiryFor(startDate: Date, period: Period, termPeriods: number | null): Date | null {
  return termPeriods ? addDays(addPeriod(startDate, period, termPeriods), -1) : null;
}
