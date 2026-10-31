import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { getPage, PAGE_SIZE } from "@/lib/pagination";
import { AddStaffDialog } from "./add-staff-dialog";
import { UserStatusButton } from "./user-status-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users · Brightloop" };

const ROLE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  ADMIN: { label: "Admin", variant: "default" },
  STAFF: { label: "Staff", variant: "info" },
  CUSTOMER: { label: "Customer", variant: "muted" },
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireRole("ADMIN");
  const sp = await searchParams;
  const { page, skip, take } = getPage(sp);

  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Users"
        description="Only admins can add staff."
        actions={<AddStaffDialog />}
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Created</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const role = ROLE_BADGE[user.role] ?? { label: user.role, variant: "outline" as const };
              const isSelf = user.id === me.id;
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.variant}>{role.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "success" : "muted"}>
                      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">You</span>
                    ) : (
                      <UserStatusButton userId={user.id} isActive={user.isActive} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Pagination
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          basePath="/settings/users"
          searchParams={sp}
        />
      </Card>
    </>
  );
}
