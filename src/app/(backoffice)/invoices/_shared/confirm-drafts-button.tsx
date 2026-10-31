"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { confirmAllDrafts } from "@/server/actions/invoices";

export function ConfirmDraftsButton({ count, disabled }: { count: number; disabled: boolean }) {
  const [state, formAction] = useActionState(confirmAllDrafts, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Confirm ${count} draft invoice${count === 1 ? "" : "s"}? Confirmed invoices can no longer be edited.`)) {
          e.preventDefault();
        }
      }}
      className="flex items-center gap-3"
    >
      {state?.error ? <FormMessage state={state} /> : null}
      <SubmitButton pendingText="Confirming…" disabled={disabled}>
        <CheckCheck />
        Confirm all drafts
      </SubmitButton>
    </form>
  );
}
