import { allowedActions, type SubStatus } from "@/lib/subscriptions/state";

// Pure module (no Prisma): imported by the portal server action and by the client action panel.

/** Lifecycle actions a customer may trigger from the portal (PLAN §7). Staff-only steps are excluded. */
export const CUSTOMER_ACTIONS = ["CONFIRM", "CANCEL", "PAUSE", "RESUME", "RENEW", "CLOSE"] as const;
export type CustomerAction = (typeof CUSTOMER_ACTIONS)[number];

export const CUSTOMER_ACTION_LABELS: Record<CustomerAction, string> = {
  CONFIRM: "Accept quotation",
  CANCEL: "Decline quotation",
  PAUSE: "Pause",
  RESUME: "Resume",
  RENEW: "Renew",
  CLOSE: "Close subscription",
};

export function isCustomerAction(value: string): value is CustomerAction {
  return (CUSTOMER_ACTIONS as readonly string[]).includes(value);
}

/**
 * Intersection of the state machine (status, quote expiry, term, plan flags) with the customer's action set.
 * Declining is only offered while the subscription is still a quotation.
 */
export function customerActionsFor(
  sub: {
    status: SubStatus;
    validUntil: Date | null;
    termPeriods: number | null;
    lineCount: number;
  },
  plan: { closable: boolean; pausable: boolean; renewable: boolean },
  today: Date,
): CustomerAction[] {
  const allowed = allowedActions(sub, plan, today);
  return CUSTOMER_ACTIONS.filter(
    (action) => allowed.includes(action) && (action !== "CANCEL" || sub.status === "QUOTATION"),
  );
}
