import Link from "next/link";
import { BarChart3, CheckCircle2, Play } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/guards";
import { formatDate, formatDateInput, parseDateInput, today } from "@/lib/dates";
import { getParam } from "@/lib/pagination";
import { formatMoney } from "@/lib/money";
import { getDashboardData } from "@/server/queries/dashboard";
import { RevenueChart } from "./_components/revenue-chart";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  UPI: "UPI",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

const pluralize = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("reports.view");
  const sp = await searchParams;

  const now = today();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let from = parseDateInput(getParam(sp, "from")) ?? defaultFrom;
  let to = parseDateInput(getParam(sp, "to")) ?? now;
  if (from > to) [from, to] = [to, from];
  const planId = getParam(sp, "plan");

  const data = await getDashboardData({ from, to, planId });
  const { kpis } = data;
  const hasChartData = data.chart.some((p) => p.invoiced > 0 || p.collected > 0);

  const rangeQuery = `from=${formatDateInput(from)}&to=${formatDateInput(to)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Revenue and billing health, ${formatDate(from)} to ${formatDate(to)}.`}
        actions={
          <Link href="/billing" className={buttonVariants({ variant: "outline" })}>
            <Play />
            Run billing
          </Link>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={formatDateInput(from)} className="w-44" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={formatDateInput(to)} className="w-44" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="plan">Plan</Label>
          <Select id="plan" name="plan" defaultValue={planId ?? ""} className="w-56">
            <option value="">All plans</option>
            {data.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>
          Reset
        </Link>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Link href="/subscriptions?status=ACTIVE" className="block rounded-lg">
          <KpiCard
            label="Active subscriptions"
            value={kpis.activeSubscriptions.toLocaleString("en-IN")}
            hint="Current status"
          />
        </Link>
        <Link href="/subscriptions?status=ACTIVE" className="block rounded-lg">
          <KpiCard label="MRR" value={formatMoney(kpis.mrr)} hint="Normalized monthly" />
        </Link>
        <Link href={`/payments?${rangeQuery}`} className="block rounded-lg">
          <KpiCard
            label="Collected"
            value={formatMoney(kpis.collected)}
            tone="success"
            hint={`${pluralize(kpis.collectedCount, "payment", "payments")} in range`}
          />
        </Link>
        <Link href="/invoices?status=CONFIRMED" className="block rounded-lg">
          <KpiCard
            label="Outstanding"
            value={formatMoney(kpis.outstanding)}
            tone="warning"
            hint={pluralize(kpis.outstandingCount, "invoice", "invoices")}
          />
        </Link>
        <Link href="/invoices?status=OVERDUE" className="block rounded-lg">
          <KpiCard
            label="Overdue"
            value={formatMoney(kpis.overdue)}
            tone="danger"
            hint={`${pluralize(kpis.overdueCount, "invoice", "invoices")} · view`}
          />
        </Link>
        <Link href={`/subscriptions?from=${formatDateInput(from)}&to=${formatDateInput(to)}`} className="block rounded-lg">
          <KpiCard
            label="New subscriptions"
            value={kpis.newSubscriptions.toLocaleString("en-IN")}
            hint="Created in range"
          />
        </Link>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <CardTitle>Invoiced vs collected</CardTitle>
            <CardDescription>Last 12 months</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-[#5b4cf0]" />
              Invoiced
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-[#12a150]" />
              Collected
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {hasChartData ? (
            <RevenueChart data={data.chart} />
          ) : (
            <EmptyState
              title="No invoices yet"
              description="Run billing to see revenue here."
              action={
                <Link href="/billing" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <BarChart3 />
                  Go to billing run
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="grid gap-1.5">
              <CardTitle>Top overdue invoices</CardTitle>
              <CardDescription>Oldest due date first, up to 10 invoices.</CardDescription>
            </div>
            <Link href="/invoices?status=OVERDUE" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              View all
            </Link>
          </CardHeader>
          {data.overdueInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <CheckCircle2 className="mb-2 size-5 text-green-600" />
              <p className="text-sm font-medium">No overdue invoices</p>
              <p className="mt-1 text-sm text-neutral-500">Every confirmed invoice is within terms.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Days overdue</TableHead>
                  <TableHead className="text-right">Amount due</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overdueInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/invoices/${inv.id}`} className="font-mono font-medium hover:text-neutral-900 hover:underline">
                        {inv.number}
                      </Link>
                      <div className="text-xs text-neutral-500">Due {formatDate(inv.dueDate)}</div>
                    </TableCell>
                    <TableCell>{inv.customerName}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-700">
                      {pluralize(inv.daysOverdue, "day", "days")}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-red-700">
                      {formatMoney(inv.amountDue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/invoices/${inv.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Record payment
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="grid gap-1.5">
              <CardTitle>Recent payments</CardTitle>
              <CardDescription>Latest 10 payments.</CardDescription>
            </div>
            <Link href="/payments" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              View all
            </Link>
          </CardHeader>
          {data.recentPayments.length === 0 ? (
            <EmptyState
              title="No payments recorded"
              description="Record a payment from any confirmed invoice."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular-nums text-neutral-500">
                      <Link href={`/invoices/${p.invoiceId}`} className="hover:text-neutral-900 hover:underline">
                        {formatDate(p.date)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{p.customerName}</div>
                      <div className="font-mono text-xs text-neutral-500">{p.invoiceNumber}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{METHOD_LABELS[p.method] ?? p.method}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-green-700">
                      {formatMoney(p.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
