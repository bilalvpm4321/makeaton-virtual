"use client";

import { useActionState, type ReactNode } from "react";
import { FormMessage } from "@/components/form-message";
import type { ActionState } from "@/lib/action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Small form wrapper for server actions that only need a top-level message (no per-field errors). */
export function ActionForm({
  action,
  className,
  children,
}: {
  action: Action;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}
