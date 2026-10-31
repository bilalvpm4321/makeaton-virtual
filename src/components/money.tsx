import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Formats an integer amount in minor units, right-aligned with tabular digits. */
export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn("block text-right tabular-nums", className)}>{formatMoney(value)}</span>;
}
