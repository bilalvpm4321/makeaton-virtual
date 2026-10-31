"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/action-state";
import type { ButtonProps } from "@/components/ui/button";

type InvoiceAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Posts one invoice action (confirm, cancel, send) with a hidden invoiceId.
 * Optional `confirmText` asks before submitting (used for irreversible actions).
 */
export function InvoiceActionButton({
  action,
  invoiceId,
  label,
  icon,
  variant = "outline",
  size = "default",
  confirmText,
  pendingText,
  className,
}: {
  action: InvoiceAction;
  invoiceId: string;
  label: string;
  icon?: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  confirmText?: string;
  pendingText?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <SubmitButton variant={variant} size={size} pendingText={pendingText ?? "Working…"} className={className}>
        {icon}
        {label}
      </SubmitButton>
    </form>
  );
}
