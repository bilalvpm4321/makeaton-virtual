"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  CUSTOMER_ACTION_LABELS,
  CUSTOMER_ACTIONS,
  customerActionsFor,
  type CustomerAction,
} from "@/app/portal/_lib/customer-actions";
import { requireCustomer } from "@/lib/auth/guards";
import type { ActionState } from "@/lib/action-state";
import { today } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { transitionSubscription } from "@/lib/subscriptions/service";

const schema = z.object({
  subscriptionId: z.string().min(1, "Missing subscription."),
  action: z.enum(CUSTOMER_ACTIONS, { message: "Unknown action." }),
  understood: z.string().optional(),
});

const SUCCESS_MESSAGE: Record<CustomerAction, string> = {
  CONFIRM: "Quotation accepted. Your subscription is confirmed.",
  CANCEL: "Quotation declined.",
  PAUSE: "Subscription paused.",
  RESUME: "Subscription resumed.",
  RENEW: "Subscription renewed.",
  CLOSE: "Subscription closed.",
};

const CLOSE_REASON: Partial<Record<CustomerAction, string>> = {
  CANCEL: "Quotation declined by customer",
  CLOSE: "Closed by customer",
};

/**
 * Customer lifecycle action on one of their own subscriptions.
 * Ownership is checked against the logged-in customer; a foreign or unknown id is reported as not found.
 */
export async function portalSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, customerId } = await requireCustomer();

  const parsed = schema.safeParse({
    subscriptionId: formData.get("subscriptionId"),
    action: formData.get("action"),
    understood: formData.get("understood") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const { subscriptionId, action, understood } = parsed.data;

  if (action === "CLOSE" && understood !== "yes") {
    return { error: "Please confirm that you understand closing ends billing." };
  }

  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, customerId, status: { not: "DRAFT" } },
    select: {
      status: true,
      validUntil: true,
      termPeriods: true,
      plan: { select: { closable: true, pausable: true, renewable: true } },
      _count: { select: { lines: true } },
    },
  });
  if (!sub) return { error: "Subscription not found." };

  const allowed = customerActionsFor(
    {
      status: sub.status,
      validUntil: sub.validUntil,
      termPeriods: sub.termPeriods,
      lineCount: sub._count.lines,
    },
    sub.plan,
    today(),
  );
  if (!allowed.includes(action)) {
    return { error: `${CUSTOMER_ACTION_LABELS[action]} is not available for this subscription.` };
  }

  try {
    await transitionSubscription(
      subscriptionId,
      action,
      { id: user.id, role: user.role },
      { reason: CLOSE_REASON[action] },
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update the subscription." };
  }

  revalidatePath("/portal");
  revalidatePath(`/portal/subscriptions/${subscriptionId}`);
  return { success: SUCCESS_MESSAGE[action] };
}
