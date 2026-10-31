"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Customer portal navigation. Overview covers /portal, its subscriptions and its invoices. */
export function PortalNav() {
  const pathname = usePathname() ?? "";
  const overviewActive =
    pathname === "/portal" || pathname.startsWith("/portal/subscriptions") || pathname.startsWith("/portal/invoices");
  const links = [
    { href: "/portal", label: "Overview", active: overviewActive },
    { href: "/portal/plans", label: "Plans", active: pathname.startsWith("/portal/plans") },
  ];

  return (
    <nav className="flex items-center gap-1 overflow-x-auto sm:ml-8">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.active ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
            link.active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
