import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/guards";
import { logoutAction } from "@/server/actions/session";

export const dynamic = "force-dynamic";

export default async function BackofficeLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("ADMIN", "STAFF");

  return (
    <div className="min-h-screen">
      <AppSidebar role={user.role} />
      <div className="flex min-h-screen min-w-0 flex-col md:pl-60">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-end gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={user.name} />
            <span className="hidden truncate text-[13px] font-medium sm:inline">{user.name}</span>
            <Badge variant={user.role === "ADMIN" ? "default" : "info"}>
              {user.role === "ADMIN" ? "Admin" : "Staff"}
            </Badge>
          </div>
          <span className="h-5 w-px bg-border" aria-hidden="true" />
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut />
              Log out
            </Button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
