import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** Label, control, then a help line or an inline error. `action` sits on the label row (e.g. "Forgot password?"). */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  action,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {action}
      </div>
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
