import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Search, Wallet, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { formatDate, parseDateInput } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getPage, getParam } from "@/lib/pagination";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethodValue,
} from "@/app/(backoffice)/invoices/_shared/payment-methods";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  await requireUser();

  const methodParam = getParam(sp, "method");
  const method = PAYMENT_METHODS.find((m) => m === methodParam);
  const q = getParam(sp, "q");
  const fromParam = getParam(sp, "from");
  const toParam = getParam(sp, "to");
  const from = parseDateInput(fromParam ?? null);
  const to = parseDateInput(toParam ?? null);
  const { page, skip, take } = getPage(sp);

  const filters: Prisma.PaymentWhereInput[] = [];
  if (method) filters.push({ method });
  if (from || to) filters.push({ date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  if (q) {
    filters.push({
      OR: [
        { invoice: { number: { contains: q, mode: "insensitive" } } },
        { invoice: { customer: { name: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  const where: Prisma.PaymentWhereInput = filters.length ? { AND: filters } : {};
  const hasFilters = Boolean(method || q || from || to);

  const [agg, payments] = await Promise.all([
    prisma.payment.aggregate({ where, _sum: { amount: true }, _count: true }),
    prisma.payment.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip,
      take,
      select: {
        id: true,
        date: true,
        method: true,
        amount: true,
        note: true,
        invoice: {
          select: { id: true, number: true, customer: { select: { name: true } } },
        },
        recordedBy: { select: { name: true } },
      },
    }),
  ]);

  const total = agg._count;
  const sum = agg._sum.amount ?? 0;

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Every payment recorded against an invoice."
      />

      <div className="mb-4 flex items-center gap-6 rounded-lg border border-neutral-200 bg-white px-5 py-3">
        <div>
          <p className="text-xs text-neutral-500">Total of filtered</p>
          <p className="text-lg font-semibold tabular-nums text-emerald-700">{formatMoney(sum)}</p>
        </div>
        <p className="text-sm text-neutral-500 tabular-nums">
          {total} {total === 1 ? "payment" : "payments"}
        </p>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by invoice or customer…"
            className="pl-9"
            aria-label="Search payments"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="method" className="text-xs text-neutral-500">
            Method
          </Label>
          <Select id="method" name="method" defaultValue={method ?? ""} className="w-44">
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((m: PaymentMethodValue) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="from" className="text-xs text-neutral-500">
            From
          </Label>
          <Input id="from" name="from" type="date" defaultValue={fromParam ?? ""} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to" className="text-xs text-neutral-500">
            To
          </Label>
          <Input id="to" name="to" type="date" defaultValue={toParam ?? ""} className="w-40" />
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/payments" className={buttonVariants({ variant: "ghost" })}>
            <X />
            Clear
          </Link>
        ) : null}
      </form>

      {payments.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No results" : "No payments recorded"}
          description={
            hasFilters ? "Try a different search or clear filters." : "Record a payment from any confirmed invoice."
          }
          action={
            hasFilters ? undefined : (
              <Link href="/invoices" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Wallet />
                Go to invoices
              </Link>
            )
          }
        />
      ) : (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Recorded by</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="tabular-nums text-neutral-500">{formatDate(p.date)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/invoices/${p.invoice.id}`}
                      className="font-mono font-medium tabular-nums hover:text-neutral-900 hover:underline underline-offset-4"
                    >
                      {p.invoice.number}
                    </Link>
                  </TableCell>
                  <TableCell>{p.invoice.customer.name}</TableCell>
                  <TableCell>{PAYMENT_METHOD_LABELS[p.method as PaymentMethodValue] ?? p.method}</TableCell>
                  <TableCell className="max-w-56 truncate text-neutral-500">{p.note ?? "—"}</TableCell>
                  <TableCell className="text-neutral-500">{p.recordedBy?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Money value={p.amount} className="font-medium" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-1">
            <Pagination
              page={page}
              total={total}
              pageSize={take}
              basePath="/payments"
              searchParams={{ method, q, from: fromParam, to: toParam }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
