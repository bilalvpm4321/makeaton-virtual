"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Submit button that disables itself and shows `pendingText` while its parent form is submitting. */
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
      {pending ? pendingText : children}
    </Button>
  );
}
