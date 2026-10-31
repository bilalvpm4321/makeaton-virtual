import * as React from "react";
import { cn } from "@/lib/utils";

// Chevron icon as a background image. Spaces in the SVG are written as underscores (Tailwind arbitrary values).
const CHEVRON =
  "bg-[url(\"data:image/svg+xml;utf8,<svg_xmlns='http://www.w3.org/2000/svg'_width='16'_height='16'_fill='none'_stroke='%236b6a73'_stroke-width='2'_stroke-linecap='round'_stroke-linejoin='round'_viewBox='0_0_24_24'><path_d='m6_9_6_6_6-6'/></svg>\")] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-card px-3 py-1 pr-9 text-sm text-foreground shadow-card transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/12 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-[invalid=true]:border-danger",
        CHEVRON,
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";

export { Select };
