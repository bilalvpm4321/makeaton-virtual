import Link from "next/link";
import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { formatDate, today } from "@/lib/dates";
import { getPage, getParam, PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { isQuoteExpired } from "@/lib/subscriptions/state";

type SearchParams = Record<string, string | string[] | undefined>;

const TABS: { key: "ALL" | SubscriptionStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "QUOTATION", label: "Quotation" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "ACTIVE", label: "Active" },
  { key: "PAUSED", label: "Paused" },
  { key: "CLOSED", label: "Closed" },
];

function listHref(params: { q?: string; plan?: string; status?: string }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.plan) sp.set("plan", params.plan);
  if (params.status) sp.set("status", params.status);
  const qs = sp.toString();
  return qs ? `/subscriptions?${qs}` : "/subscriptions";
}

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = getParam(sp, "q");
  const planId = getParam(sp, "plan");
  const statusParam = getParam(sp, "status");
  const status = TABS.some((t) => t.key !== "ALL" && t.key === statusParam)
    ? (statusParam as SubscriptionStatus)
    : undefined;
  const { page, skip, take } = getPage(sp);
  const now = today();

  // Search and plan filters apply to the tab counts too, so the numbers match the list.
  const base: Prisma.SubscriptionWhereInput = {
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(planId ? { planId } : {}),
  };
  const where: Prisma.SubscriptionWhereInput = status ? { ...base, status } : base;

  const [rows, total, groups, plans, templates] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        number: true,
        status: true,
        startDate: true,
        nextInvoiceDate: true,
        expiryDate: true,
        validUntil: true,
        recurringTotal: true,
        customer: { select: { name: true } },
        plan: { select: { name: true } },
      },
    }),
    prisma.subscription.count({ where }),
    prisma.subscription.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.plan.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.quotationTemplate.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const counts = new Map<string, number>();
  for (const g of groups) counts.set(g.status, g._count._all);
  const allCount = groups.reduce((sum, g) => sum + g._count._all, 0);
  const filtered = Boolean(q || planId || status);

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Quotations, confirmed and running subscriptions across all customers."
        actions={
          <>
            <form action="/subscriptions/new" className="flex items-center gap-2">
              <Select name="template" defaultValue="" aria-label="Start from a quotation template" className="w-44">
                <option value="">From template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="outline" disabled={templates.length === 0}>
                Start
              </Button>
            </form>
            <Link href="/subscriptions/new" className={buttonVariants()}>
              <Plus />
              New subscription
            </Link>
          </>
        }
      />

      <nav className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((t) => {
          const active = (status ?? "ALL") === t.key;
          const count = t.key === "ALL" ? allCount : (counts.get(t.key) ?? 0);
          return (
            <Link
              key={t.key}
              href={listHref({ q, plan: planId, status: t.key === "ALL" ? undefined : t.key })}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900",
              )}
            >
              {t.label}
              <span className="rounded-full bg-neutral-100 px-1.5 text-xs tabular-nums text-neutral-600">{count}</span>
            </Link>
          );
        })}
      </nav>

      <form action="/subscriptions" className="mb-4 flex flex-wrap items-center gap-2">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by number or customer…"
            aria-label="Search subscriptions"
            className="pl-9"
          />
        </div>
        <Select name="plan" defaultValue={planId ?? ""} aria-label="Filter by plan" className="w-44">
          <option value="">All plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {q || planId ? (
          <Link href={listHref({ status })} className={buttonVariants({ variant: "ghost" })}>
            Clear
          </Link>
        ) : null}
        <span className="ml-auto text-sm text-neutral-500 tabular-nums">
          {total} {total === 1 ? "subscription" : "subscriptions"}
        </span>
      </form>

      {total === 0 ? (
        <EmptyState
          title={filtered ? "No results" : "No subscriptions yet"}
          description={
            filtered
              ? "Try a different search or clear filters."
              : "Create one from scratch or from a quotation template."
          }
          action={
            filtered ? null : (
              <Link href="/subscriptions/new" className={buttonVariants({ size: "sm" })}>
                New subscription
              </Link>
            )
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Next invoice</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Recurring</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/subscriptions/${s.id}`} className="font-mono font-medium text-neutral-900 hover:underline">
                      {s.number}
                    </Link>
                  </TableCell>
                  <TableCell>{s.customer.name}</TableCell>
                  <TableCell className="text-neutral-500">{s.plan.name}</TableCell>
                  <TableCell className="tabular-nums text-neutral-500">{formatDate(s.startDate)}</TableCell>
                  <TableCell className="tabular-nums text-neutral-500">{formatDate(s.nextInvoiceDate)}</TableCell>
                  <TableCell className="tabular-nums text-neutral-500">{formatDate(s.expiryDate)}</TableCell>
                  <TableCell>
                    <Money value={s.recurringTotal} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status === "QUOTATION" && isQuoteExpired(s, now) ? "EXPIRED" : s.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/subscriptions" searchParams={sp} />
        </>
      )}
    </>
  );
}
