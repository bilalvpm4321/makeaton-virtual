import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { StatusStepper } from "@/components/status-stepper";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/guards";
import { computeInvoiceDraft, type ComputeDiscount, type ComputeLine } from "@/lib/billing/compute";
import { prisma } from "@/lib/db";
import { formatDate, PERIOD_LABELS, PERIOD_SHORT, today } from "@/lib/dates";
import { formatBps, formatMoney } from "@/lib/money";
import { can } from "@/lib/rbac";
import { allowedActions, isQuoteExpired } from "@/lib/subscriptions/state";
import { ActionForm } from "../_components/action-form";
import { TransitionBar } from "../_components/transition-bar";
import {
  addSubscriptionLine,
  attachDiscount,
  detachDiscount,
  removeSubscriptionLine,
  updateSubscriptionLineQuantity,
} from "@/server/actions/subscriptions";

type ProductOption = {
  id: string;
  name: string;
  variants: { id: string; attribute: string; value: string; extraPrice: number }[];
};

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function discountValueLabel(d: { type: string; value: number }): string {
  return d.type === "PERCENT" ? `${formatBps(d.value)} off` : `${formatMoney(d.value)} off`;
}

function validityLabel(start: Date | null, end: Date | null): string {
  if (!start && !end) return "No date limit";
  return `${start ? formatDate(start) : "Now"} – ${end ? formatDate(end) : "open"}`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-[13px]">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-right tabular-nums">{children}</dd>
    </div>
  );
}

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const now = today();

  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      plan: {
        select: {
          id: true,
          name: true,
          productId: true,
          price: true,
          billingPeriod: true,
          minQuantity: true,
          closable: true,
          pausable: true,
          renewable: true,
          termLength: true,
          autoClose: true,
        },
      },
      paymentTerm: { select: { name: true } },
      salesperson: { select: { name: true } },
      template: { select: { name: true } },
      _count: { select: { lines: true } },
      lines: {
        select: {
          id: true,
          productId: true,
          variantId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          product: { select: { name: true } },
          tax: { select: { name: true, rateBps: true } },
        },
      },
      discounts: {
        select: {
          discount: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
              value: true,
              scope: true,
              minPurchase: true,
              minQuantity: true,
              startDate: true,
              endDate: true,
              usageLimit: true,
              usageCount: true,
              isActive: true,
              createdAt: true,
              products: { select: { id: true } },
            },
          },
        },
      },
      invoices: {
        orderBy: { issueDate: "desc" },
        take: 50,
        select: {
          id: true,
          number: true,
          periodStart: true,
          periodEnd: true,
          total: true,
          amountPaid: true,
          dueDate: true,
          status: true,
        },
      },
    },
  });
  if (!sub) notFound();

  const canManage = can(user, "subscriptions.manage");
  const canAttach = can(user, "discounts.attach");
  const editable = canManage && (sub.status === "DRAFT" || sub.status === "QUOTATION");
  const actions = canManage
    ? allowedActions(
        {
          status: sub.status,
          validUntil: sub.validUntil,
          termPeriods: sub.termPeriods,
          lineCount: sub._count.lines,
        },
        sub.plan,
        now,
      )
    : [];

  const attachedIds = sub.discounts.map((d) => d.discount.id);
  const [attachable, activity] = await Promise.all([
    prisma.discountRule.findMany({
      where: { isActive: true, id: { notIn: attachedIds } },
      select: { id: true, name: true, code: true, type: true, value: true },
      orderBy: { name: "asc" },
    }),
    prisma.activity.findMany({
      where: { entityType: "subscription", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, message: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);

  const products: ProductOption[] = editable
    ? await prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          variants: {
            where: { isActive: true },
            select: { id: true, attribute: true, value: true, extraPrice: true },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];
  const taxes: { id: string; name: string; rateBps: number }[] = editable
    ? await prisma.tax.findMany({
        where: { isActive: true },
        select: { id: true, name: true, rateBps: true },
        orderBy: { name: "asc" },
      })
    : [];
  const variantOptions = products.flatMap((p) =>
    p.variants.map((v) => ({ id: v.id, label: `${p.name} — ${v.attribute}: ${v.value}` })),
  );

  const isMain = (l: { productId: string; variantId: string | null }) =>
    sub.plan.productId !== null && l.productId === sub.plan.productId && l.variantId === null;

  // Next invoice preview: same engine as billing (PLAN.md §6.6), dry run only.
  const previewLines: ComputeLine[] = sub.lines.map((l) => ({
    productId: l.productId,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxName: l.tax?.name ?? null,
    taxRateBps: l.tax?.rateBps ?? 0,
  }));
  const previewDiscounts: ComputeDiscount[] = sub.discounts.map(({ discount: d }) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    value: d.value,
    scope: d.scope,
    productIds: d.products.map((p) => p.id),
    minPurchase: d.minPurchase,
    minQuantity: d.minQuantity,
    startDate: d.startDate,
    endDate: d.endDate,
    usageLimit: d.usageLimit,
    usageCount: d.usageCount,
    isActive: d.isActive,
    createdAt: d.createdAt,
  }));
  const previewDate = sub.nextInvoiceDate ?? sub.startDate;
  const draft = computeInvoiceDraft(previewLines, previewDiscounts, previewDate);

  const quoteExpired = isQuoteExpired(sub, now);
  const displayStatus = sub.status === "QUOTATION" && quoteExpired ? "EXPIRED" : sub.status;
  const expiredActive = sub.status === "ACTIVE" && sub.expiryDate !== null && sub.expiryDate < now && !sub.plan.autoClose;

  return (
    <>
      <div className="mb-1.5 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/subscriptions" className="hover:text-neutral-900 hover:underline">
          Subscriptions
        </Link>
        <span>›</span>
        <span className="font-mono text-neutral-900">{sub.number}</span>
      </div>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{sub.number}</span>
            <StatusBadge status={displayStatus} />
            {expiredActive ? <Badge variant="warning">Expired — renew or close</Badge> : null}
          </span>
        }
        description={`${sub.customer.name} · ${sub.plan.name}`}
        actions={<TransitionBar subscriptionId={sub.id} actions={actions} />}
      />

      <Card className="mb-6 px-5 py-4">
        <StatusStepper status={sub.status} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-6">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Lines</CardTitle>
              <CardDescription>
                {editable
                  ? "Add, change or remove lines while this is a draft or a quotation."
                  : "Lines are locked once the subscription is confirmed."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {editable ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sub.lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={editable ? 7 : 6} className="py-6 text-center text-neutral-500">
                        No lines yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sub.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">
                          {l.product.name}
                          {isMain(l) ? <span className="ml-2 text-xs font-normal text-neutral-500">Plan line</span> : null}
                        </TableCell>
                        <TableCell className="text-neutral-500">{l.description}</TableCell>
                        <TableCell className="text-neutral-500">{l.tax ? l.tax.name : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {editable ? (
                            <ActionForm action={updateSubscriptionLineQuantity} className="flex items-center justify-end gap-1.5">
                              <input type="hidden" name="subscriptionId" value={sub.id} />
                              <input type="hidden" name="lineId" value={l.id} />
                              <Input
                                name="quantity"
                                type="number"
                                min={isMain(l) ? sub.plan.minQuantity : 1}
                                defaultValue={l.quantity}
                                aria-label={`Quantity for ${l.description}`}
                                className="h-8 w-20 text-right tabular-nums"
                              />
                              <Button type="submit" size="sm" variant="outline">
                                Save
                              </Button>
                            </ActionForm>
                          ) : (
                            l.quantity
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(l.unitPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(l.quantity * l.unitPrice)}</TableCell>
                        {editable ? (
                          <TableCell className="text-right">
                            {isMain(l) ? (
                              <span className="text-xs text-neutral-400">Locked</span>
                            ) : (
                              <ActionForm action={removeSubscriptionLine}>
                                <input type="hidden" name="subscriptionId" value={sub.id} />
                                <input type="hidden" name="lineId" value={l.id} />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                  Remove
                                </Button>
                              </ActionForm>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="ml-auto w-72 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Recurring total</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(sub.recurringTotal)}
                    <span className="text-xs font-normal text-neutral-500"> / {PERIOD_SHORT[sub.plan.billingPeriod]}</span>
                  </span>
                </div>
                <p className="text-xs text-neutral-500">Before tax and discounts. Taxes are added on each invoice.</p>
              </div>

              {editable ? (
                <ActionForm
                  action={addSubscriptionLine}
                  className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50/60 p-4 sm:grid-cols-2 lg:grid-cols-6"
                >
                  <input type="hidden" name="subscriptionId" value={sub.id} />
                  <div className="grid gap-1.5 lg:col-span-2">
                    <Label htmlFor="productId">Product</Label>
                    <Select id="productId" name="productId" required defaultValue="">
                      <option value="" disabled>
                        Choose a product…
                      </option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-1.5 lg:col-span-2">
                    <Label htmlFor="variantId">Variant (optional)</Label>
                    <Select id="variantId" name="variantId" defaultValue="">
                      <option value="">No variant</option>
                      {variantOptions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="quantity">Qty</Label>
                    <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} className="text-right tabular-nums" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="unitPrice">Unit price (₹)</Label>
                    <Input id="unitPrice" name="unitPrice" inputMode="decimal" placeholder="Default pricing" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="taxId">Tax</Label>
                    <Select id="taxId" name="taxId" defaultValue="">
                      <option value="">Product default</option>
                      {taxes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-end justify-end sm:col-span-2 lg:col-span-6">
                    <SubmitButton pendingText="Adding…" variant="outline">
                      Add line
                    </SubmitButton>
                  </div>
                </ActionForm>
              ) : null}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Discounts</CardTitle>
              <CardDescription>Applied automatically to every next invoice while valid and under the usage limit.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {sub.discounts.length === 0 ? (
                <p className="text-sm text-neutral-500">No discounts attached.</p>
              ) : (
                <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
                  {sub.discounts.map(({ discount: d }) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {d.name}
                          {d.code ? <span className="ml-2 font-mono text-xs text-neutral-500">{d.code}</span> : null}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {discountValueLabel(d)} · {d.scope === "PRODUCTS" ? "Specific products" : "Whole subscription"} ·{" "}
                          {validityLabel(d.startDate, d.endDate)} · Used {d.usageCount}
                          {d.usageLimit !== null ? ` of ${d.usageLimit}` : ""}
                        </p>
                      </div>
                      {canAttach ? (
                        <ActionForm action={detachDiscount}>
                          <input type="hidden" name="subscriptionId" value={sub.id} />
                          <input type="hidden" name="discountId" value={d.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            Detach
                          </Button>
                        </ActionForm>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {canAttach && sub.status !== "CLOSED" && attachable.length > 0 ? (
                <ActionForm action={attachDiscount} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="subscriptionId" value={sub.id} />
                  <Select name="discountId" required defaultValue="" aria-label="Discount to attach" className="w-80">
                    <option value="" disabled>
                      Choose a discount…
                    </option>
                    {attachable.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.code ? ` (${r.code})` : ""} · {discountValueLabel(r)}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="outline">
                    Attach discount
                  </Button>
                </ActionForm>
              ) : null}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Invoices generated for this subscription, newest first.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {sub.invoices.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-neutral-500">No invoices yet.</p>
              ) : (
                <Table className="rounded-none border-x-0 border-b-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sub.invoices.map((inv) => {
                      const amountDue = inv.total - inv.amountPaid;
                      const overdue = inv.status === "CONFIRMED" && inv.dueDate < now && amountDue > 0;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <Link href={`/invoices/${inv.id}`} className="font-mono font-medium hover:underline">
                              {inv.number}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums text-neutral-500">
                            {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(inv.total)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(inv.amountPaid)}</TableCell>
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

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Every change to this subscription, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-neutral-500">No activity yet.</p>
              ) : (
                <ol className="relative ml-3 space-y-5 border-l border-neutral-200 py-2">
                  {activity.map((a) => (
                    <li key={a.id} className="relative pl-6">
                      <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-neutral-900 ring-4 ring-white" />
                      <p className="text-sm">{a.message}</p>
                      <p className="text-xs text-neutral-500">
                        {a.user?.name ?? "System"} · {dateTime.format(a.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid h-fit gap-4 lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-neutral-100">
                <Row label="Customer">
                  <Link href={`/customers/${sub.customer.id}`} className="font-medium hover:underline">
                    {sub.customer.name}
                  </Link>
                </Row>
                <Row label="Plan">
                  {sub.plan.name} · {PERIOD_LABELS[sub.plan.billingPeriod]}
                </Row>
                <Row label="Start">{formatDate(sub.startDate)}</Row>
                <Row label="Expiry">{sub.expiryDate ? formatDate(sub.expiryDate) : "Open-ended"}</Row>
                <Row label="Next invoice">{formatDate(sub.nextInvoiceDate)}</Row>
                <Row label="Payment term">{sub.paymentTerm.name}</Row>
                {sub.validUntil ? (
                  <Row label="Valid until">
                    <span className={quoteExpired ? "text-amber-700" : undefined}>{formatDate(sub.validUntil)}</span>
                  </Row>
                ) : null}
                <Row label="Salesperson">{sub.salesperson?.name ?? "—"}</Row>
                {sub.template ? <Row label="Template">{sub.template.name}</Row> : null}
                <Row label="Recurring">
                  {formatMoney(sub.recurringTotal)} / {PERIOD_SHORT[sub.plan.billingPeriod]}
                </Row>
              </dl>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/40">
            <CardHeader>
              <CardTitle>Next invoice preview</CardTitle>
              <CardDescription>
                Dated {formatDate(previewDate)}. Preview, computed with the same engine as billing.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {sub.status === "CLOSED" ? (
                <p className="text-neutral-500">Closed. No further invoices will be created.</p>
              ) : previewLines.length === 0 ? (
                <p className="text-neutral-500">Add a line to see the next invoice.</p>
              ) : (
                <>
                  <ul className="grid gap-1.5">
                    {draft.lines.map((l, i) => (
                      <li key={`${l.productId}-${i}`} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">
                          {l.description} × {l.quantity}
                        </span>
                        <span className="shrink-0 tabular-nums">{formatMoney(l.total)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="grid gap-1.5 border-t border-blue-200 pt-3">
                    <Row label="Subtotal">{formatMoney(draft.subtotal)}</Row>
                    {draft.appliedDiscounts.map((d) => (
                      <div key={d.discountId} className="flex justify-between gap-3 text-[13px]">
                        <span className="text-neutral-600">{d.name}</span>
                        <span className="text-green-700 tabular-nums">−{formatMoney(d.amount)}</span>
                      </div>
                    ))}
                    <Row label="Tax">{formatMoney(draft.taxTotal)}</Row>
                    <div className="flex items-baseline justify-between gap-3 border-t border-blue-200 pt-2">
                      <span className="font-semibold">Total</span>
                      <span className="text-xl font-semibold tabular-nums">{formatMoney(draft.total)}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
