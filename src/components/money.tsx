import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Formats an integer amount in minor units in the monospaced ledger face, right-aligned. */
export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn("num block text-right", className)}>{formatMoney(value)}</span>;
}
