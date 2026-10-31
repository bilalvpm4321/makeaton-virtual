import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONE_CHIP = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
} as const;

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof TONE_CHIP;
  icon?: LucideIcon;
  href?: string;
}) {
  return (
    <Card className={cn("group relative overflow-hidden p-5 transition-colors", href && "hover:border-primary/30")}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {Icon ? (
          <span className={cn("grid size-8 place-items-center rounded-lg", TONE_CHIP[tone])}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "num mt-3 text-[26px] font-semibold leading-none tracking-tight",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </div>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
      {href ? <Link href={href} className="absolute inset-0" aria-label={typeof label === "string" ? label : undefined} /> : null}
    </Card>
  );
}
