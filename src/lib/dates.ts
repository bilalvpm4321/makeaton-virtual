// Pure date helpers. No date-fns. All business dates are UTC-midnight Date objects
// (they match Prisma `@db.Date` values).

export type Period = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export const PERIOD_LABELS: Record<Period, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export const PERIOD_SHORT: Record<Period, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

const DAY_MS = 86_400_000;

/** UTC calendar date of `d`, as UTC midnight. Use `today()` for the current date. */
export function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Current local calendar date, as UTC midnight. */
export function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

/** Adds calendar months in UTC, clamping to the last day of the target month (Jan 31 + 1 -> Feb 28). */
export function addMonths(d: Date, n: number): Date {
  const day = d.getUTCDate();
  const firstOfTarget = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const y = firstOfTarget.getUTCFullYear();
  const m = firstOfTarget.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, lastDay)));
}

export function addPeriod(d: Date, period: Period, n: number): Date {
  switch (period) {
    case "DAILY":
      return addDays(d, n);
    case "WEEKLY":
      return addDays(d, 7 * n);
    case "MONTHLY":
      return addMonths(d, n);
    case "YEARLY":
      return addMonths(d, 12 * n);
  }
}

/** a - b in whole days (calendar days, UTC). */
export function diffDays(a: Date, b: Date): number {
  return Math.round((toDateOnly(a).getTime() - toDateOnly(b).getTime()) / DAY_MS);
}

/** Parses "2026-10-31" into UTC midnight. Returns null for empty or invalid input. */
export function parseDateInput(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(m[3])) return null;
  return d;
}

/** "2026-10-31" for <input type="date">, or "" when null. */
export function formatDateInput(d: Date | null): string {
  if (!d) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "31 Oct 2026", or "—" when null. */
export function formatDate(d: Date | null): string {
  if (!d) return "—";
  return dateFormatter.format(d);
}
