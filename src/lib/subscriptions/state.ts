// PURE: no prisma import. See PLAN.md §6.2.

export type SubStatus = "DRAFT" | "QUOTATION" | "CONFIRMED" | "ACTIVE" | "PAUSED" | "CLOSED";

export type SubAction =
  | "SEND_QUOTE"
  | "CONFIRM"
  | "ACTIVATE"
  | "PAUSE"
  | "RESUME"
  | "CLOSE"
  | "RENEW"
  | "CANCEL";

export const ACTION_LABELS: Record<SubAction, string> = {
  SEND_QUOTE: "Send quotation",
  CONFIRM: "Confirm",
  ACTIVATE: "Activate",
  PAUSE: "Pause",
  RESUME: "Resume",
  CLOSE: "Close",
  RENEW: "Renew",
  CANCEL: "Cancel",
};

/** Status-level transition map. Plan flags, line count and quote expiry are checked in allowedActions. */
export const TRANSITIONS: Record<SubStatus, SubAction[]> = {
  DRAFT: ["SEND_QUOTE", "CANCEL"],
  QUOTATION: ["CONFIRM", "CANCEL"],
  CONFIRMED: ["ACTIVATE"],
  ACTIVE: ["PAUSE", "CLOSE", "RENEW"],
  PAUSED: ["RESUME", "CLOSE"],
  CLOSED: [],
};

export const STATUS_ORDER: string[] = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "CLOSED"];

/** A quotation is expired when its validUntil date is before today. */
export function isQuoteExpired(sub: { validUntil: Date | null }, today: Date): boolean {
  return sub.validUntil !== null && sub.validUntil < today;
}

export function allowedActions(
  sub: {
    status: SubStatus;
    validUntil: Date | null;
    termPeriods: number | null;
    lineCount: number;
  },
  plan: { closable: boolean; pausable: boolean; renewable: boolean },
  today: Date,
): SubAction[] {
  return TRANSITIONS[sub.status].filter((action) => {
    switch (action) {
      case "SEND_QUOTE":
        return sub.lineCount >= 1;
      case "CONFIRM":
        return !isQuoteExpired(sub, today);
      case "PAUSE":
        return plan.pausable;
      case "CLOSE":
        return plan.closable;
      case "RENEW":
        return plan.renewable && sub.termPeriods !== null;
      default:
        return true;
    }
  });
}
