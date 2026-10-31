import type { Period } from "@/lib/dates";

/** Normalizes a recurring amount (minor units) to a monthly figure for MRR. */
export function normalizeToMonthly(amount: number, period: Period): number {
  switch (period) {
    case "DAILY":
      return Math.round(amount * 30);
    case "WEEKLY":
      return Math.round((amount * 52) / 12);
    case "MONTHLY":
      return Math.round(amount);
    case "YEARLY":
      return Math.round(amount / 12);
  }
}
