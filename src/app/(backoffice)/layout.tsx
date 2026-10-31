import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/guards";
import { logoutAction } from "@/server/actions/session";

export const dynamic = "force-dynamic";

export default async function BackofficeLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("ADMIN", "STAFF");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppSidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-end gap-3 border-b bg-white px-4 py-3 md:px-6">
          <span className="text-sm font-medium">{user.name}</span>
          <Badge variant="secondary">{user.role === "ADMIN" ? "Admin" : "Staff"}</Badge>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
