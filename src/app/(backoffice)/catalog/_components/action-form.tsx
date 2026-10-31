"use client";

import Link from "next/link";
import { type FormEvent, startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { ButtonProps } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Form wrapper for catalog mutations. Submits through useActionState and keeps the
 * user's input when the action returns an error (no native form reset).
 * readOnly disables every field and hides the submit bar (staff view).
 * compact renders an inline form for row-level buttons such as Remove.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save changes",
  submitVariant,
  submitSize,
  submitClassName,
  className,
  readOnly = false,
  cancelHref,
  resetOnSuccess = false,
  compact = false,
}: {
  action: Action;
  children: ReactNode;
  submitLabel?: string;
  submitVariant?: ButtonProps["variant"];
  submitSize?: ButtonProps["size"];
  submitClassName?: string;
  className?: string;
  readOnly?: boolean;
  cancelHref?: string;
  resetOnSuccess?: boolean;
  compact?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.success) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={className}>
      <fieldset disabled={readOnly} className="contents">
        {children}
      </fieldset>
      {readOnly ? null : (
        <div className={cn("flex flex-wrap items-center gap-3", compact ? "" : "mt-6 justify-end")}>
          <div className="mr-auto min-w-0 flex-1">
            <FormMessage state={state} />
          </div>
          {cancelHref ? (
            <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
              Cancel
            </Link>
          ) : null}
          <SubmitButton
            variant={submitVariant}
            size={submitSize}
            className={submitClassName}
            disabled={isPending}
          >
            {isPending ? "Saving…" : submitLabel}
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
