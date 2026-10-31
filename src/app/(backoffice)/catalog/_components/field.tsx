import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Label + control + optional hint. htmlFor must match the control's id. */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

/** Checkbox tile with a label and optional description. */
export function CheckField({
  name,
  label,
  hint,
  defaultChecked,
  className,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  defaultChecked?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3",
        className,
      )}
    >
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 rounded border-neutral-300" />
      <span className="grid gap-0.5">
        <span className="text-sm font-medium text-neutral-900">{label}</span>
        {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
      </span>
    </label>
  );
}
