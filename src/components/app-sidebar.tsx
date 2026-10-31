"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileText,
  Inbox,
  Landmark,
  Layers,
  LayoutDashboard,
  Package,
  Percent,
  Play,
  Repeat,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
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
    title: "Sales",
    items: [
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
      { href: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    title: "Billing",
    items: [
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/billing", label: "Billing run", icon: Play },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/catalog/products", label: "Products", icon: Package },
      { href: "/catalog/plans", label: "Plans", icon: Layers },
      { href: "/catalog/templates", label: "Quotation templates", icon: ClipboardList },
      { href: "/catalog/discounts", label: "Discounts", icon: Percent },
      { href: "/catalog/taxes", label: "Taxes", icon: Landmark },
      { href: "/catalog/payment-terms", label: "Payment terms", icon: CalendarClock },
    ],
  },
  {
    title: "Admin",
    adminOnly: true,
    items: [
      { href: "/settings/users", label: "Users", icon: UserCog },
      { href: "/outbox", label: "Outbox", icon: Inbox },
    ],
  },
];

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname() ?? "";
  const groups = NAV.filter((g) => !g.adminOnly || role === "ADMIN");

  return (
    <aside className="border-b bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="px-4 py-4 text-base font-semibold">Brightloop</div>
      <nav className="flex gap-6 overflow-x-auto px-3 pb-3 md:flex-col md:gap-5 md:overflow-visible md:pb-6">
        {groups.map((group) => (
          <div key={group.title} className="flex shrink-0 gap-1 md:flex-col">
            <p className="hidden px-3 pb-1 text-xs font-medium uppercase tracking-wide text-neutral-400 md:block">
              {group.title}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm",
                    active
                      ? "bg-neutral-100 font-medium text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
