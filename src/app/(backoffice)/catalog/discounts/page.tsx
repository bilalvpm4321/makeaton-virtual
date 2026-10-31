import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/guards";
import { today } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatBps, formatMoney } from "@/lib/money";
import { getPage, getParam, PAGE_SIZE } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { SearchForm } from "../_components/search-form";
import { formatValidity } from "../_components/format";

type DiscountRow = {
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  usageLimit: number | null;
  usageCount: number;
};

/** Derived status: Inactive, Used up, Expired, Scheduled, or Active. */
function discountStatus(rule: DiscountRow): { label: string; variant: "muted" | "warning" | "danger" | "info" | "success" } {
  const now = today();
  if (!rule.isActive) return { label: "Inactive", variant: "muted" };
  if (rule.usageLimit !== null && rule.usageCount >= rule.usageLimit) return { label: "Used up", variant: "warning" };
  if (rule.endDate && rule.endDate < now) return { label: "Expired", variant: "danger" };
  if (rule.startDate && rule.startDate > now) return { label: "Scheduled", variant: "info" };
  return { label: "Active", variant: "success" };
}

export default async function DiscountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const canManage = can(user, "discounts.manage");
  const q = getParam(sp, "q");
  const { page, skip, take } = getPage(sp);
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { code: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rules, total] = await Promise.all([
    prisma.discountRule.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { _count: { select: { products: true } } },
    }),
    prisma.discountRule.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Discounts"
        description="Rules that reduce invoices automatically while they are valid and unused."
        actions={
          canManage ? (
            <Link href="/catalog/discounts/new" className={buttonVariants()}>
              <Plus />
              New discount
            </Link>
          ) : (
            <Badge variant="muted">Read only</Badge>
          )
        }
      />

      <div className="mb-4">
        <SearchForm placeholder="Search by name or code…" defaultValue={q} />
      </div>

      {total === 0 ? (
        <EmptyState
          title={q ? "No results" : "No discounts yet"}
          description={q ? "Try a different search." : "Create a rule to offer a percentage or fixed discount."}
          action={
            canManage && !q ? (
              <Link href="/catalog/discounts/new" className={buttonVariants({ size: "sm" })}>
                New discount
              </Link>
            ) : null
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Minimum</TableHead>
              <TableHead>Validity</TableHead>
              <TableHead className="text-right">Usage</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => {
              const status = discountStatus(r);
              const minParts = [
                r.minPurchase > 0 ? `${formatMoney(r.minPurchase)} purchase` : null,
                r.minQuantity > 0 ? `${r.minQuantity} qty` : null,
              ].filter((p): p is string => p !== null);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/catalog/discounts/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.code ? (
                      <Badge variant="outline" className="font-mono">
                        {r.code}
                      </Badge>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {r.type === "PERCENT" ? formatBps(r.value) : formatMoney(r.value)}
                  </TableCell>
                  <TableCell className="text-neutral-500">
                    {r.scope === "PRODUCTS" ? `${r._count.products} product(s)` : "Whole subscription"}
                  </TableCell>
                  <TableCell className="text-neutral-500">{minParts.length ? minParts.join(" · ") : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">
                    {formatValidity(r.startDate, r.endDate)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {r.usageCount} / {r.usageLimit ?? "unlimited"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/catalog/discounts" searchParams={sp} />
    </>
  );
}
