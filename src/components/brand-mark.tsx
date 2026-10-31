import { Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Logo lockup: indigo loop mark with an amber spark, plus the wordmark. Use tone "dark" on dark surfaces. */
export function BrandMark({ tone = "light", className }: { tone?: "dark" | "light"; className?: string }) {
  const onDark = tone === "dark";
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="relative grid size-7 place-items-center rounded-lg bg-primary text-white shadow-[0_0_0_1px_rgb(255_255_255/0.1)_inset]">
        <Repeat2 className="size-4" strokeWidth={2.5} />
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent ring-2",
            onDark ? "ring-sidebar" : "ring-card",
          )}
        />
      </span>
      <span className={cn("text-[15px] font-semibold tracking-tight", onDark ? "text-white" : "text-foreground")}>
        Brightloop
      </span>
    </span>
  );
}
