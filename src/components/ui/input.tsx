import * as React from "react";
import { cn } from "@/lib/utils";

export const INPUT_CLASS =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-card placeholder:text-muted-foreground/70 transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/12 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15 file:border-0 file:bg-transparent file:text-sm file:font-medium";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input ref={ref} type={type} className={cn(INPUT_CLASS, className)} {...props} />
  ),
);
Input.displayName = "Input";

export { Input };
