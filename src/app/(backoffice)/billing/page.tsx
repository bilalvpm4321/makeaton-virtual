import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatDate, formatDateInput, today } from "@/lib/dates";
import { RunBillingForm } from "./run-billing-form";

export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<string, string> = { cron: "Cron", cli: "CLI" };

const stampFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

function triggerBadge(triggeredBy: string | null) {
  if (!triggeredBy) return <span className="text-neutral-400">—</span>;
  const label = TRIGGER_LABEL[triggeredBy] ?? "Manual";
  return <Badge variant={label === "Manual" ? "secondary" : "info"}>{label}</Badge>;
}

function parseLog(log: string | null): string {
  if (!log) return "";
  try {
    const parsed: unknown = JSON.parse(log);
    return Array.isArray(parsed) ? parsed.map(String).join("\n") : log;
  } catch {
    return log;
  }
}

export default async function BillingPage() {
  const day = today();

  const [activeDue, confirmedDue, runs] = await Promise.all([
    prisma.subscription.count({ where: { status: "ACTIVE", nextInvoiceDate: { lte: day } } }),
    prisma.subscription.count({ where: { status: "CONFIRMED", startDate: { lte: day } } }),
    prisma.billingRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        runDate: true,
        activated: true,
        invoiced: true,
        closed: true,
        skipped: true,
        errors: true,
        log: true,
        triggeredBy: true,
        createdAt: true,
      },
    }),
  ]);

  const due = activeDue + confirmedDue;
  const last = runs[0] ?? null;

  const lastStats = last
    ? [
        { label: "Activated", value: last.activated, tone: "text-neutral-900" },
        { label: "Invoiced", value: last.invoiced, tone: "text-neutral-900" },
        { label: "Closed", value: last.closed, tone: "text-neutral-900" },
        { label: "Skipped", value: last.skipped, tone: "text-neutral-500", hint: "already billed" },
        {
          label: "Errors",
          value: last.errors,
          tone: last.errors > 0 ? "text-red-600" : "text-neutral-900",
        },
      ]
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing run"
        description="Activate confirmed subscriptions, generate due invoices and close ended terms. Safe to run twice."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Due today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-[40px] font-semibold tabular-nums leading-none">{due}</p>
              <p className="mt-2 text-sm text-neutral-500">
                {due === 1 ? "subscription due today" : "subscriptions due today"}
              </p>
            </div>
            <ol className="space-y-2 text-sm text-neutral-600">
              <li>
                <span className="font-medium text-neutral-900">1. Activate</span> confirmed subscriptions whose
                start date has arrived.
              </li>
              <li>
                <span className="font-medium text-neutral-900">2. Invoice</span> every period that is due, as drafts
                you can review.
              </li>
              <li>
                <span className="font-medium text-neutral-900">3. Auto-close</span> subscriptions whose term ended on
                a plan with auto-close.
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Run now</CardTitle>
          </CardHeader>
          <CardContent>
            <RunBillingForm defaultAsOf={formatDateInput(day)} />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">Last result</h2>
        {lastStats ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {lastStats.map((s) => (
                <div key={s.label} className="rounded-lg border border-neutral-200 bg-white p-4">
                  <p className="text-xs text-neutral-500">{s.label}</p>
                  <p className={`mt-1 text-xl font-semibold tabular-nums ${s.tone}`}>{s.value}</p>
                  {s.hint ? <p className="mt-0.5 text-[11px] text-neutral-400">{s.hint}</p> : null}
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-500">
              As of {formatDate(last.runDate)}, ran {stampFormatter.format(last.createdAt)} IST.
            </p>
          </>
        ) : (
          <EmptyState title="No billing runs yet" description="Run billing to see results here." />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">History</h2>
        {runs.length === 0 ? null : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ran at</TableHead>
                  <TableHead>Triggered by</TableHead>
                  <TableHead>As of</TableHead>
                  <TableHead className="text-right">Activated</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap tabular-nums text-neutral-600">
                      {stampFormatter.format(r.createdAt)}
                    </TableCell>
                    <TableCell>{triggerBadge(r.triggeredBy)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-neutral-600">
                      {formatDate(r.runDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.activated}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.invoiced}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.closed}</TableCell>
                    <TableCell className="text-right tabular-nums text-neutral-500">{r.skipped}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.errors > 0 ? (
                        <details className="inline-block text-left">
                          <summary className="cursor-pointer text-red-600">{r.errors}</summary>
                          <pre className="mt-2 max-w-md whitespace-pre-wrap rounded-md bg-neutral-50 p-2 text-xs text-neutral-700">
                            {parseLog(r.log)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-neutral-400">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        )}
      </section>
    </div>
  );
}
