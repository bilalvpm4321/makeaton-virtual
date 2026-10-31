import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { STATUS_ORDER } from "@/lib/subscriptions/state";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  QUOTATION: "Quotation",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active",
  CLOSED: "Closed",
};

/**
 * Where a subscription stands in its lifecycle, rendered inside a card.
 * PAUSED is drawn at the ACTIVE step, labelled "Paused" in amber.
 * Pass closedFromQuote when a quotation was cancelled: the steps after Quotation are dimmed.
 */
export function StatusStepper({
  status,
  closedFromQuote = false,
  className,
}: {
  status: string;
  closedFromQuote?: boolean;
  className?: string;
}) {
  const effective = status === "PAUSED" ? "ACTIVE" : status;
  const currentIndex = STATUS_ORDER.indexOf(effective);
  const closedEarly = closedFromQuote && effective === "CLOSED";

  return (
    <Card className={cn("mb-6 overflow-x-auto px-5 py-4", className)}>
      <ol className="flex w-full min-w-[540px] items-center md:min-w-0" aria-label="Subscription status">
        {STATUS_ORDER.map((step, i) => {
          const isCurrent = currentIndex === i;
          const isDone = currentIndex > i;
          const state = isCurrent ? "current" : isDone ? "done" : "upcoming";
          const label =
            isCurrent && status === "PAUSED" ? "Paused" : (STEP_LABELS[step] ?? step);
          const dimmed = closedEarly && (step === "CONFIRMED" || step === "ACTIVE");

          return (
            <li
              key={step}
              className={cn("flex items-center", i < STATUS_ORDER.length - 1 && "flex-1", dimmed && "opacity-40")}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ring-1 ring-inset",
                    state === "done" && "bg-primary text-primary-foreground ring-primary",
                    state === "current" &&
                      "bg-card text-primary ring-2 ring-primary shadow-[0_0_0_4px_rgb(91_76_240/0.12)]",
                    state === "upcoming" && "bg-card text-muted-foreground ring-border",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {state === "done" ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-[13px] font-medium whitespace-nowrap",
                    state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                    isCurrent && status === "PAUSED" && "text-warning",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STATUS_ORDER.length - 1 && (
                <div className={cn("mx-3 h-px flex-1", i < currentIndex ? "bg-primary" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
