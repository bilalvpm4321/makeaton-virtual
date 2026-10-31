import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant; className?: string }> = {
  // Subscription statuses
  DRAFT: { label: "Draft", variant: "secondary" },
  QUOTATION: { label: "Quotation", variant: "outline" },
  CONFIRMED: { label: "Confirmed", variant: "info" },
  ACTIVE: { label: "Active", variant: "success" },
  PAUSED: { label: "Paused", variant: "warning" },
  CLOSED: { label: "Closed", variant: "muted" },
  // Invoice statuses
  PAID: { label: "Paid", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "muted", className: "line-through" },
  // Derived states (never stored)
  OVERDUE: { label: "Overdue", variant: "danger" },
  EXPIRED: { label: "Expired", variant: "warning" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  return (
    <Badge variant={entry.variant} className={cn(entry.className, className)}>
      {entry.label}
    </Badge>
  );
}
