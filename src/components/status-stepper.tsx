import { STATUS_ORDER } from "@/lib/subscriptions/state";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  QUOTATION: "Quotation",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active",
  CLOSED: "Closed",
};

/** Shows where a subscription stands in its lifecycle. PAUSED is drawn at the ACTIVE step. */
export function StatusStepper({ status }: { status: string }) {
  const effective = status === "PAUSED" ? "ACTIVE" : status;
  const currentIndex = STATUS_ORDER.indexOf(effective);

  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Subscription status">
      {STATUS_ORDER.map((step, i) => {
        const done = currentIndex > i;
        const current = currentIndex === i;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1",
                current && "border-neutral-900 bg-neutral-900 text-white",
                done && "border-neutral-300 bg-neutral-100 text-neutral-700",
                !done && !current && "border-neutral-200 text-neutral-400",
              )}
              aria-current={current ? "step" : undefined}
            >
              {STEP_LABELS[step] ?? step}
              {current && status === "PAUSED" ? " (paused)" : null}
            </span>
            {i < STATUS_ORDER.length - 1 ? <span className="text-neutral-300">→</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
