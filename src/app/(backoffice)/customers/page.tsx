import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { getPage, getParam, PAGE_SIZE } from "@/lib/pagination";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = getParam(sp, "q");
  const { page, skip, take } = getPage(sp);

  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        createdAt: true,
        _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone who buys a subscription, with their active subscriptions."
        actions={
          <Link href="/customers/new" className={buttonVariants()}>
            <Plus />
            Add customer
          </Link>
        }
      />

      <form action="/customers" className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, email or company…"
            aria-label="Search customers"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
        {q ? (
          <Link href="/customers" className={buttonVariants({ variant: "ghost" })}>
            Clear
          </Link>
        ) : null}
        <span className="ml-auto text-sm text-neutral-500 tabular-nums">
          {total} {total === 1 ? "customer" : "customers"}
        </span>
      </form>

      {total === 0 ? (
        <EmptyState
          title={q ? "No results" : "No customers yet"}
          description={q ? "Try a different search or clear the filter." : "Add a customer before starting a subscription."}
          action={
            !q ? (
              <Link href="/customers/new" className={buttonVariants({ size: "sm" })}>
                Add customer
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Active subscriptions</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/customers/${c.id}`} className="font-medium text-neutral-900 hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-neutral-500">{c.company ?? "—"}</TableCell>
                  <TableCell className="text-neutral-500">{c.email}</TableCell>
                  <TableCell className="text-right tabular-nums">{c._count.subscriptions}</TableCell>
                  <TableCell className="tabular-nums text-neutral-500">{formatDate(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/customers" searchParams={sp} />
        </>
      )}
    </>
  );
}
