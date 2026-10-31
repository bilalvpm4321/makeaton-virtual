import * as React from "react";
import { cn } from "@/lib/utils";

// Chevron icon as an inline background image (kept out of the class list so the CSS bundler never tries to resolve it as a file).
const CHEVRON_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='#6b6a73' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'><path d='m6 9 6 6 6-6'/></svg>",
)}")`;

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, style, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-card px-3 py-1 pr-9 text-sm text-foreground shadow-card transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/12 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-[invalid=true]:border-danger",
        "bg-no-repeat",
        className,
      )}
      style={{ backgroundImage: CHEVRON_URL, backgroundSize: "16px", backgroundPosition: "right 0.6rem center", ...style }}
      {...props}
    />
  ),
);
Select.displayName = "Select";

export { Select };
