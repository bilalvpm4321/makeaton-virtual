import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { BrandMark } from "@/components/brand-mark";
import { PortalNav } from "@/components/portal-nav";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/guards";
import { logoutAction } from "@/server/actions/session";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("CUSTOMER");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3 sm:h-16 sm:py-0">
          <div className="flex min-w-0 items-center">
            <Link href="/portal" aria-label="Brightloop portal home">
              <BrandMark tone="light" />
            </Link>
            <PortalNav />
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={user.name} className="size-7 text-[11px]" />
            <span className="hidden truncate text-[13px] font-medium md:inline">{user.name}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut />
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
      <footer className="no-print py-8 text-center text-xs text-muted-foreground">
        Questions about a bill? billing@brightloop.test
      </footer>
    </div>
  );
}
