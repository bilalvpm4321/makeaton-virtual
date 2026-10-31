import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/guards";
import { logoutAction } from "@/server/actions/session";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("CUSTOMER");

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/portal" className="font-semibold">
              Brightloop
            </Link>
            <nav className="flex gap-4 text-sm text-neutral-600">
              <Link href="/portal" className="hover:text-neutral-900">
                My subscriptions
              </Link>
              <Link href="/portal/plans" className="hover:text-neutral-900">
                Plans
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">{user.name}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
