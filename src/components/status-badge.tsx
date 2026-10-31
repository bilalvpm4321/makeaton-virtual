import { Check, Pause } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusEntry = { label: string; variant: BadgeVariant; className?: string; icon?: "pause" | "check" };

const STATUS_MAP: Record<string, StatusEntry> = {
  // Subscription statuses
  DRAFT: { label: "Draft", variant: "muted" },
  QUOTATION: { label: "Quotation", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "info" },
  ACTIVE: { label: "Active", variant: "success" },
  PAUSED: { label: "Paused", variant: "secondary", icon: "pause" },
  CLOSED: { label: "Closed", variant: "outline", className: "text-muted-foreground" },
  // Invoice statuses
  PAID: { label: "Paid", variant: "success", icon: "check" },
  CANCELLED: { label: "Cancelled", variant: "muted", className: "line-through decoration-muted-foreground/60" },
  // Derived states (never stored)
  OVERDUE: { label: "Overdue", variant: "danger" },
  EXPIRED: { label: "Expired", variant: "warning" },
};

/**
 * Status pill. `kind` is optional; when it is "invoice" (or unset) and `overdue` is true the badge reads OVERDUE.
 * Expired quotations use status "EXPIRED"; an ACTIVE subscription past its term without autoClose can be shown
 * with a second badge, status "EXPIRED", next to the Active badge.
 */
export function StatusBadge({
  status,
  className,
  kind,
  overdue,
}: {
  status: string;
  className?: string;
  kind?: "subscription" | "invoice";
  overdue?: boolean;
}) {
  const key = kind !== "subscription" && overdue ? "OVERDUE" : status;
  const entry: StatusEntry = STATUS_MAP[key] ?? { label: key, variant: "outline" };
  const Icon = entry.icon === "pause" ? Pause : entry.icon === "check" ? Check : null;

  return (
    <Badge variant={entry.variant} className={cn(entry.className, className)}>
      {Icon ? (
        <Icon className="size-3" />
      ) : (
        <span className={cn("size-1.5 rounded-full bg-current", key === "OVERDUE" && "animate-pulse")} />
      )}
      {entry.label}
    </Badge>
  );
}
