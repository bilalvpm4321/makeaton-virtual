"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  CalendarClock,
  CreditCard,
  FileStack,
  FileText,
  LayoutDashboard,
  Layers,
  Mail,
  Package,
  Receipt,
  Repeat,
  UserCog,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import type { Role } from "@/lib/auth/jwt";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { title: string; items: NavItem[]; adminOnly?: boolean };

const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Revenue",
    items: [
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/payments", label: "Payments", icon: Wallet },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/billing", label: "Billing run", icon: Zap },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/catalog/products", label: "Products", icon: Package },
      { href: "/catalog/plans", label: "Plans", icon: Layers },
      { href: "/catalog/templates", label: "Quotation templates", icon: FileStack },
      { href: "/catalog/discounts", label: "Discounts", icon: BadgePercent },
      { href: "/catalog/taxes", label: "Taxes", icon: Receipt },
      { href: "/catalog/payment-terms", label: "Payment terms", icon: CalendarClock },
    ],
  },
  {
    title: "Admin",
    adminOnly: true,
    items: [
      { href: "/settings/users", label: "Users", icon: UserCog },
      { href: "/outbox", label: "Outbox", icon: Mail },
    ],
  },
];

/** Desktop: fixed dark sidebar (md and up). Phone: a compact brand row with a horizontally scrolling nav. */
export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname() ?? "";
  const groups = NAV.filter((g) => !g.adminOnly || role === "ADMIN");
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Phone top strip */}
      <div className="no-print border-b border-sidebar-border bg-sidebar md:hidden">
        <div className="flex h-12 items-center px-4">
          <Link href="/dashboard" aria-label="Brightloop home">
            <BrandMark tone="dark" />
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {groups.flatMap((group) =>
            group.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium",
                    active ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/85 hover:text-white",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            }),
          )}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-5">
          <Link href="/dashboard" aria-label="Brightloop home">
            <BrandMark tone="dark" />
          </Link>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
                        active
                          ? "bg-sidebar-accent text-white shadow-[inset_2px_0_0_var(--primary)] [&_svg]:text-primary"
                          : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-white [&_svg]:text-sidebar-muted",
                      )}
                    >
                      <Icon />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-lg bg-sidebar-accent px-3 py-2.5 text-xs text-sidebar-muted">
            Billing runs daily at 00:00 UTC
          </div>
        </div>
      </aside>
    </>
  );
}
