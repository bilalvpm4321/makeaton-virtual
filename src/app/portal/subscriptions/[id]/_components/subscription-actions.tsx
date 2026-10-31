"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CUSTOMER_ACTION_LABELS,
  type CustomerAction,
} from "@/app/portal/_lib/customer-actions";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { portalSubscriptionAction } from "@/server/actions/portal";

const HELP: Record<CustomerAction, string> = {
  CONFIRM: "Accepting confirms the subscription. Billing starts on the start date.",
  CANCEL: "Declining closes this quotation. You can ask us for a new one at any time.",
  PAUSE: "Periods that start while the subscription is paused are not billed.",
  RESUME: "Billing restarts with the next period.",
  RENEW: "Extends the term by one more term.",
  CLOSE: "Ends billing for this subscription. Invoices already issued are not affected.",
};

const BUTTON_VARIANT: Record<Exclude<CustomerAction, "CLOSE">, "default" | "outline"> = {
  CONFIRM: "default",
  CANCEL: "outline",
  PAUSE: "outline",
  RESUME: "default",
  RENEW: "outline",
};

export function SubscriptionActions({
  subscriptionId,
  actions,
}: {
  subscriptionId: string;
  actions: CustomerAction[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(portalSubscriptionAction, undefined);
  const [confirmingClose, setConfirmingClose] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.error) toast.error(state.error);
    if (state.success) toast.success(state.success);
  }, [state]);

  const actionable = actions.filter((a): a is Exclude<CustomerAction, "CLOSE"> => a !== "CLOSE");
  const canClose = actions.includes("CLOSE");

  return (
    <div className="space-y-4">
      {actionable.map((action) => (
        <form key={action} action={formAction} className="space-y-1.5">
          <input type="hidden" name="subscriptionId" value={subscriptionId} />
          <input type="hidden" name="action" value={action} />
          <Button type="submit" variant={BUTTON_VARIANT[action]} size="lg" className="w-full" disabled={pending}>
            {CUSTOMER_ACTION_LABELS[action]}
          </Button>
          <p className="text-xs text-neutral-500">{HELP[action]}</p>
        </form>
      ))}

      {canClose ? (
        confirmingClose ? (
          <form action={formAction} className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <input type="hidden" name="subscriptionId" value={subscriptionId} />
            <input type="hidden" name="action" value="CLOSE" />
            <p className="text-xs text-neutral-600">{HELP.CLOSE}</p>
            <label className="flex items-start gap-2 text-sm text-neutral-800">
              <input type="checkbox" name="understood" value="yes" required className="mt-0.5 size-4" />
              <span>I understand</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="destructive" size="sm" disabled={pending}>
                {CUSTOMER_ACTION_LABELS.CLOSE}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingClose(false)}>
                Keep it open
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={() => setConfirmingClose(true)}
            disabled={pending}
          >
            {CUSTOMER_ACTION_LABELS.CLOSE}
          </Button>
        )
      ) : null}
    </div>
  );
}
