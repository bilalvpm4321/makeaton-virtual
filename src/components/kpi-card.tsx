import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  default: "text-neutral-900",
  success: "text-green-700",
  warning: "text-amber-700",
  danger: "text-red-700",
} as const;

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className={cn("text-2xl font-semibold tabular-nums", TONE_CLASS[tone])}>{value}</div>
        {hint ? <div className="text-xs text-neutral-500">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}
