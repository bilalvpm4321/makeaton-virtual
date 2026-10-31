import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getPage, PAGE_SIZE } from "@/lib/pagination";
import { can } from "@/lib/rbac";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const canManage = can(user, "catalog.manage");
  const { page, skip, take } = getPage(sp);

  const [templates, total] = await Promise.all([
    prisma.quotationTemplate.findMany({
      orderBy: { name: "asc" },
      skip,
      take,
      include: {
        plan: { select: { name: true } },
        paymentTerm: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.quotationTemplate.count(),
  ]);

  return (
    <>
      <PageHeader
        title="Quotation templates"
        description="Pre-filled quotes: a plan, product lines and how long the quote stays valid."
        actions={
          canManage ? (
            <Link href="/catalog/templates/new" className={buttonVariants()}>
              <Plus />
              New template
            </Link>
          ) : (
            <Badge variant="muted">Read only</Badge>
          )
        }
      />

      {total === 0 ? (
        <EmptyState
          title="No quotation templates yet"
          description="Templates let staff start a subscription quote with plan and lines already filled in."
          action={
            canManage ? (
              <Link href="/catalog/templates/new" className={buttonVariants({ size: "sm" })}>
                New template
              </Link>
            ) : null
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Validity</TableHead>
              <TableHead>Payment term</TableHead>
              <TableHead className="text-right">Lines</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link href={`/catalog/templates/${t.id}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                </TableCell>
                <TableCell>{t.plan.name}</TableCell>
                <TableCell>{t.validityDays} days</TableCell>
                <TableCell className="text-neutral-500">{t.paymentTerm?.name ?? "—"}</TableCell>
                <TableCell className="text-right">{t._count.lines}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/catalog/templates" searchParams={sp} />
    </>
  );
}
