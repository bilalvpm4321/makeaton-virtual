import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/db";
import { formatDateInput, PERIOD_SHORT, today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getParam } from "@/lib/pagination";
import { SubscriptionForm } from "./_components/subscription-form";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function NewSubscriptionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const templateId = getParam(sp, "template") ?? null;

  const [customers, plans, paymentTerms, templates, template] = await Promise.all([
    prisma.customer.findMany({
      select: { id: true, name: true, company: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      select: { id: true, name: true, price: true, billingPeriod: true },
      orderBy: { name: "asc" },
    }),
    prisma.paymentTerm.findMany({ select: { id: true, name: true }, orderBy: { dueDays: "asc" } }),
    prisma.quotationTemplate.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    templateId
      ? prisma.quotationTemplate.findUnique({
          where: { id: templateId },
          select: {
            id: true,
            name: true,
            planId: true,
            paymentTermId: true,
            validityDays: true,
            _count: { select: { lines: true } },
          },
        })
      : null,
  ]);

  return (
    <>
      <div className="mb-1.5 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/subscriptions" className="hover:text-neutral-900 hover:underline">
          Subscriptions
        </Link>
        <span>›</span>
        <span className="text-neutral-900">New</span>
      </div>
      <PageHeader title="New subscription" description="Creates a draft. Send it as a quotation from its page." />

      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Start from</CardTitle>
            <CardDescription>
              {template
                ? `Prefills the plan and payment term from "${template.name}". Its ${template._count.lines} line(s) are copied, and the quotation is valid for ${template.validityDays} days.`
                : "Pick a quotation template to prefill plan, terms and lines, or start blank."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/subscriptions/new" className="flex flex-wrap items-center gap-2">
              <Select name="template" defaultValue={templateId ?? ""} aria-label="Quotation template" className="w-72">
                <option value="">Start blank</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="outline">
                Apply
              </Button>
            </form>
            {templateId && !template ? (
              <p className="mt-2 text-xs text-red-600">That template no longer exists. Starting blank.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Pick the customer, plan and start date. You can add or change lines on the next screen.</CardDescription>
          </CardHeader>
          <CardContent>
            <SubscriptionForm
              key={template?.id ?? "blank"}
              templateId={template?.id ?? null}
              customers={customers.map((c) => ({
                id: c.id,
                label: c.company ? `${c.name} (${c.company})` : c.name,
              }))}
              plans={plans.map((p) => ({
                id: p.id,
                label: `${p.name} · ${formatMoney(p.price)} / ${PERIOD_SHORT[p.billingPeriod]}`,
              }))}
              paymentTerms={paymentTerms.map((t) => ({ id: t.id, label: t.name }))}
              defaults={{
                customerId: "",
                planId: template?.planId ?? "",
                paymentTermId: template?.paymentTermId ?? paymentTerms[0]?.id ?? "",
                startDate: formatDateInput(today()),
                notes: "",
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
