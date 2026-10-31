import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { formatBps } from "@/lib/money";
import { getPage, getParam, PAGE_SIZE } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { SearchForm } from "../_components/search-form";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const canManage = can(user, "catalog.manage");
  const q = getParam(sp, "q");
  const { page, skip, take } = getPage(sp);
  const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      include: { defaultTax: true, _count: { select: { variants: true } } },
    }),
    prisma.product.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Products"
        description="Items you sell. Variants adjust the unit price of a product."
        actions={
          canManage ? (
            <Link href="/catalog/products/new" className={buttonVariants()}>
              <Plus />
              New product
            </Link>
          ) : (
            <Badge variant="muted">Read only</Badge>
          )
        }
      />

      <div className="mb-4">
        <SearchForm placeholder="Search products by name…" defaultValue={q} />
      </div>

      {total === 0 ? (
        <EmptyState
          title={q ? "No results" : "No products yet"}
          description={q ? "Try a different search." : "Add a product to start building plans."}
          action={
            canManage && !q ? (
              <Link href="/catalog/products/new" className={buttonVariants({ size: "sm" })}>
                New product
              </Link>
            ) : null
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Sales price</TableHead>
              <TableHead className="text-right">Cost price</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead className="text-right">Variants</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/catalog/products/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{p.type === "GOODS" ? "Goods" : "Service"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Money value={p.salesPrice} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={p.costPrice} />
                </TableCell>
                <TableCell className="text-neutral-500">
                  {p.defaultTax ? `${p.defaultTax.name} (${formatBps(p.defaultTax.rateBps)})` : "—"}
                </TableCell>
                <TableCell className="text-right">{p._count.variants}</TableCell>
                <TableCell>
                  <Badge variant={p.isActive ? "success" : "muted"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/catalog/products" searchParams={sp} />
    </>
  );
}
