import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Search, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { diffDays, formatDate, parseDateInput, today } from "@/lib/dates";
import { getPage, getParam } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { ConfirmDraftsButton } from "./_shared/confirm-drafts-button";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "confirmed", label: "Confirmed" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function parseTab(value: string | undefined): TabKey {
  return TABS.some((t) => t.key === value) ? (value as TabKey) : "all";
}

/** Overdue = CONFIRMED and past due (derived, never stored). "Confirmed" excludes overdue so tabs do not overlap. */
function tabWhere(tab: TabKey, day: Date): Prisma.InvoiceWhereInput {
  switch (tab) {
    case "draft":
      return { status: "DRAFT" };
    case "confirmed":
      return { status: "CONFIRMED", dueDate: { gte: day } };
    case "overdue":
      return { status: "CONFIRMED", dueDate: { lt: day } };
    case "paid":
      return { status: "PAID" };
    case "cancelled":
      return { status: "CANCELLED" };
    default:
      return {};
  }
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const day = today();

  const tab = parseTab(getParam(sp, "status"));
  const q = getParam(sp, "q");
  const from = parseDateInput(getParam(sp, "from") ?? null);
  const to = parseDateInput(getParam(sp, "to") ?? null);
  const { page, skip, take } = getPage(sp);

  const filters: Prisma.InvoiceWhereInput[] = [];
  if (q) {
    filters.push({
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (from || to) {
    filters.push({ issueDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  }
  const base: Prisma.InvoiceWhereInput = filters.length ? { AND: filters } : {};
  const where: Prisma.InvoiceWhereInput = { AND: [base, tabWhere(tab, day)] };

  const countFor = (t: TabKey) =>
    prisma.invoice.count({ where: { AND: [base, tabWhere(t, day)] } });

  const [counts, total, invoices, draftCount] = await Promise.all([
    Promise.all(TABS.map((t) => countFor(t.key))),
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: [{ issueDate: "desc" }, { id: "desc" }],
      skip,
      take,
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        customer: { select: { name: true } },
        subscription: { select: { number: true } },
      },
    }),
    prisma.invoice.count({ where: { status: "DRAFT" } }),
  ]);

  const countByTab = Object.fromEntries(TABS.map((t, i) => [t.key, counts[i]])) as Record<TabKey, number>;
  const hasFilters = Boolean(q || from || to);
  const canManage = can(user, "invoices.manage");

  const keep = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status: tab, q, from: getParam(sp, "from"), to: getParam(sp, "to"), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "status" && v === "all")) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/invoices?${qs}` : "/invoices";
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Drafts from billing runs, confirmed invoices and payment status."
        actions={
          canManage ? <ConfirmDraftsButton disabled={draftCount === 0} count={draftCount} /> : undefined
        }
      />

      <nav className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((t) => {
          const active = tab === t.key;
          const isOverdue = t.key === "overdue";
          return (
            <Link
              key={t.key}
              href={keep({ status: t.key })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-900",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[11px] tabular-nums",
                  isOverdue ? "bg-red-50 text-red-600" : active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500",
                )}
              >
                {countByTab[t.key]}
              </span>
            </Link>
          );
        })}
      </nav>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="status" value={tab} />
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by number or customer…"
            className="pl-9"
            aria-label="Search invoices"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="from" className="text-xs text-neutral-500">
            Issued from
          </Label>
          <Input id="from" name="from" type="date" defaultValue={getParam(sp, "from") ?? ""} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to" className="text-xs text-neutral-500">
            to
          </Label>
          <Input id="to" name="to" type="date" defaultValue={getParam(sp, "to") ?? ""} className="w-40" />
        </div>
        <Button type="submit" variant="outline" size="default">
          Apply
        </Button>
        {hasFilters ? (
          <Link href={keep({ q: undefined, from: undefined, to: undefined })} className={buttonVariants({ variant: "ghost" })}>
            <X />
            Clear
          </Link>
        ) : null}
        <span className="ml-auto text-[13px] text-neutral-500 tabular-nums">
          {total} {total === 1 ? "invoice" : "invoices"}
        </span>
      </form>

      <div>
        {invoices.length === 0 ? (
          <div className="p-4">
            {hasFilters || tab !== "all" ? (
              <EmptyState title="No results" description="Try a different search or clear filters." />
            ) : (
              <EmptyState
                title="No invoices here"
                description="Invoices appear after a billing run."
                action={
                  <Link href="/billing" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Go to billing
                  </Link>
                }
              />
            )}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Amount due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const amountDue = inv.total - inv.amountPaid;
                  const overdue = inv.status === "CONFIRMED" && inv.dueDate < day;
                  const daysOverdue = overdue ? diffDays(day, inv.dueDate) : 0;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-mono font-medium tabular-nums hover:text-neutral-900 hover:underline underline-offset-4"
                        >
                          {inv.number}
                        </Link>
                      </TableCell>
                      <TableCell>{inv.customer.name}</TableCell>
                      <TableCell className="font-mono text-xs tabular-nums text-neutral-500">
                        {inv.subscription?.number ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-neutral-500">{formatDate(inv.issueDate)}</TableCell>
                      <TableCell>
                        <span className={cn("tabular-nums", overdue ? "font-medium text-red-600" : "text-neutral-500")}>
                          {formatDate(inv.dueDate)}
                        </span>
                        {overdue ? (
                          <span className="block text-[11px] text-red-600/80">
                            {daysOverdue === 1 ? "1 day overdue" : `${daysOverdue} days overdue`}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={inv.total} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={inv.amountPaid} className="text-neutral-500" />
                      </TableCell>
                      <TableCell className="text-right">
                        {amountDue > 0 ? (
                          <Money value={amountDue} className={cn("font-medium", overdue && "text-red-600")} />
                        ) : (
                          <span className="block text-right text-neutral-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={overdue ? "OVERDUE" : inv.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="px-4 pb-4">
              <Pagination
                page={page}
                total={total}
                pageSize={take}
                basePath="/invoices"
                searchParams={{ status: tab === "all" ? undefined : tab, q, from: getParam(sp, "from"), to: getParam(sp, "to") }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
