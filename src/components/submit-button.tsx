"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Submit button that disables itself and shows a spinner plus `pendingText` while its parent form is submitting. */
export function SubmitButton({
  pendingText = "Saving…",
  children,
  disabled,
  type = "submit",
  ...props
}: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type={type} disabled={pending || disabled} {...props}>
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
