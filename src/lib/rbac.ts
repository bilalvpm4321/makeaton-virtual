import type { Role } from "@/lib/auth/jwt";

export type { Role };

export type Permission =
  | "users.manage"
  | "catalog.manage"
  | "discounts.manage"
  | "discounts.attach"
  | "customers.manage"
  | "subscriptions.manage"
  | "billing.run"
  | "invoices.manage"
  | "payments.record"
  | "reports.view"
  | "outbox.view";

// PLAN.md §7. CUSTOMER has no back-office permissions; portal actions are ownership-checked instead.
const STAFF_PERMISSIONS: Permission[] = [
  "discounts.attach",
  "customers.manage",
  "subscriptions.manage",
  "billing.run",
  "invoices.manage",
  "payments.record",
  "reports.view",
];

export function can(user: { role: Role }, p: Permission): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "STAFF") return STAFF_PERMISSIONS.includes(p);
  return false;
}
