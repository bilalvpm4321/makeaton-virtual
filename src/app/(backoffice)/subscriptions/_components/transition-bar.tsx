"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACTION_LABELS, type SubAction } from "@/lib/subscriptions/state";
import { transitionSubscriptionAction } from "@/server/actions/subscriptions";

const DESTRUCTIVE: SubAction[] = ["CLOSE", "CANCEL"];

/** Lifecycle buttons for one subscription. Only the actions the server says are allowed are passed in. */
export function TransitionBar({ subscriptionId, actions }: { subscriptionId: string; actions: SubAction[] }) {
  const [state, formAction] = useActionState(transitionSubscriptionAction, undefined);

  if (actions.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="id" value={subscriptionId} />
      {actions.includes("CLOSE") ? (
        <Input
          name="reason"
          placeholder="Reason for closing"
          aria-label="Reason for closing"
          aria-invalid={!!state?.fieldErrors?.reason}
          className="h-9 w-52"
        />
      ) : null}
      {actions.map((action, i) => {
        const destructive = DESTRUCTIVE.includes(action);
        return (
          <Button
            key={action}
            type="submit"
            name="action"
            value={action}
            variant={destructive ? "ghost" : i === 0 ? "default" : "outline"}
            className={destructive ? "text-red-600 hover:bg-red-50 hover:text-red-700" : undefined}
            onClick={(e) => {
              if (destructive && !window.confirm(`${ACTION_LABELS[action]} this subscription? This cannot be undone.`)) {
                e.preventDefault();
              }
            }}
          >
            {ACTION_LABELS[action]}
          </Button>
        );
      })}
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
