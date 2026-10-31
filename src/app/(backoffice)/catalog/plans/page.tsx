import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/guards";
import { PERIOD_SHORT } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getPage, PAGE_SIZE } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { formatAvailability, formatTerm } from "../_components/format";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const canManage = can(user, "catalog.manage");
  const { page, skip, take } = getPage(sp);

  const [plans, total] = await Promise.all([
    prisma.plan.findMany({
      orderBy: { name: "asc" },
      skip,
      take,
      include: { product: { select: { name: true } } },
    }),
    prisma.plan.count(),
  ]);

  return (
    <>
      <PageHeader
        title="Plans"
        description="Recurring offers: price, billing period, term and what customers can do with them."
        actions={
          canManage ? (
            <Link href="/catalog/plans/new" className={buttonVariants()}>
              <Plus />
              New plan
            </Link>
          ) : (
            <Badge variant="muted">Read only</Badge>
          )
        }
      />

      {total === 0 ? (
        <EmptyState
          title="No plans yet"
          description="Create a plan to sell subscriptions and build quotation templates."
          action={
            canManage ? (
              <Link href="/catalog/plans/new" className={buttonVariants({ size: "sm" })}>
                New plan
              </Link>
            ) : null
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Min qty</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/catalog/plans/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="text-neutral-500">{p.product?.name ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatMoney(p.price)}{" "}
                  <span className="text-xs text-neutral-500">/ {PERIOD_SHORT[p.billingPeriod]}</span>
                </TableCell>
                <TableCell className="text-right">{p.minQuantity}</TableCell>
                <TableCell>{formatTerm(p.termLength, p.billingPeriod)}</TableCell>
                <TableCell className="whitespace-nowrap text-neutral-500">
                  {formatAvailability(p.availableFrom, p.availableUntil)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {p.autoClose ? <Badge variant="secondary">Auto-close</Badge> : null}
                    {p.closable ? <Badge variant="secondary">Closable</Badge> : null}
                    {p.pausable ? <Badge variant="secondary">Pausable</Badge> : null}
                    {p.renewable ? <Badge variant="secondary">Renewable</Badge> : null}
                    {p.isPublic ? <Badge variant="outline">Public</Badge> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={p.isActive ? "success" : "muted"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/catalog/plans" searchParams={sp} />
    </>
  );
}
