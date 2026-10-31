import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { formatDate, PERIOD_SHORT, today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isQuoteExpired } from "@/lib/subscriptions/state";
import { CustomerForm } from "../_components/customer-form";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = today();

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, company: true, address: true, taxId: true },
  });
  if (!customer) notFound();

  const [subscriptions, invoices, balance] = await Promise.all([
    prisma.subscription.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        number: true,
        status: true,
        startDate: true,
        expiryDate: true,
        validUntil: true,
        recurringTotal: true,
        plan: { select: { name: true, billingPeriod: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { customerId: id },
      orderBy: { issueDate: "desc" },
      take: 100,
      select: { id: true, number: true, issueDate: true, dueDate: true, total: true, amountPaid: true, status: true },
    }),
    prisma.invoice.aggregate({
      where: { customerId: id, status: "CONFIRMED" },
      _sum: { total: true, amountPaid: true },
    }),
  ]);

  const balanceDue = (balance._sum.total ?? 0) - (balance._sum.amountPaid ?? 0);

  return (
    <>
      <div className="mb-1.5 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/customers" className="hover:text-neutral-900 hover:underline">
          Customers
        </Link>
        <span>›</span>
        <span className="text-neutral-900">{customer.name}</span>
      </div>
      <PageHeader
        title={customer.name}
        description={[customer.company, customer.email].filter(Boolean).join(" · ")}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm text-neutral-500">Balance due</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(balanceDue)}</p>
            </div>
            <p className="max-w-xs text-xs text-neutral-500">
              Confirmed invoices total minus payments received. Drafts and cancelled invoices are not included.
            </p>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
              <CardDescription>{subscriptions.length} shown, newest first</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pb-0">
              {subscriptions.length === 0 ? (
                <EmptyState
                  title="No subscriptions yet"
                  description="Start one from the subscriptions page."
                  action={
                    <Link href="/subscriptions/new" className="text-sm font-medium underline">
                      New subscription
                    </Link>
                  }
                />
              ) : (
                <Table className="rounded-none border-x-0 border-b-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Recurring</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link href={`/subscriptions/${s.id}`} className="font-mono font-medium hover:underline">
                            {s.number}
                          </Link>
                        </TableCell>
                        <TableCell>{s.plan.name}</TableCell>
                        <TableCell className="tabular-nums text-neutral-500">{formatDate(s.startDate)}</TableCell>
                        <TableCell className="tabular-nums text-neutral-500">
                          {s.expiryDate ? formatDate(s.expiryDate) : "Open-ended"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(s.recurringTotal)}
                          <span className="text-xs text-neutral-500"> / {PERIOD_SHORT[s.plan.billingPeriod]}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={s.status === "QUOTATION" && isQuoteExpired(s, now) ? "EXPIRED" : s.status}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>{invoices.length} shown, newest first</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pb-0">
              {invoices.length === 0 ? (
                <EmptyState title="No invoices yet" description="Invoices appear after a billing run." />
              ) : (
                <Table className="rounded-none border-x-0 border-b-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Amount due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => {
                      const amountDue = inv.total - inv.amountPaid;
                      const overdue = inv.status === "CONFIRMED" && inv.dueDate < now && amountDue > 0;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <Link href={`/invoices/${inv.id}`} className="font-mono font-medium hover:underline">
                              {inv.number}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums text-neutral-500">{formatDate(inv.issueDate)}</TableCell>
                          <TableCell className={overdue ? "tabular-nums font-medium text-red-600" : "tabular-nums text-neutral-500"}>
                            {formatDate(inv.dueDate)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(inv.total)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {amountDue > 0 ? formatMoney(amountDue) : <span className="text-neutral-400">—</span>}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={overdue ? "OVERDUE" : inv.status} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>Edit the details used on quotations and invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <CustomerForm
              id={customer.id}
              defaults={{
                name: customer.name,
                email: customer.email,
                phone: customer.phone ?? "",
                company: customer.company ?? "",
                address: customer.address ?? "",
                taxId: customer.taxId ?? "",
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
