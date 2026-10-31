import Link from "next/link";
import { Check, Mail } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCustomer } from "@/lib/auth/guards";
import { PERIOD_SHORT, today, type Period } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const SALES_EMAIL = "billing@brightloop.test";

function termLabel(termLength: number | null, period: Period): string {
  if (!termLength) return "Open-ended";
  const unit = PERIOD_SHORT[period];
  return `${termLength} ${termLength === 1 ? unit : `${unit}s`} minimum term`;
}

export default async function PortalPlansPage() {
  await requireCustomer();
  const now = today();

  // Public, active plans that are on sale today.
  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
      isPublic: true,
      AND: [
        { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
        { OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] },
      ],
    },
    orderBy: [{ price: "asc" }, { name: "asc" }],
    take: 50,
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      billingPeriod: true,
      minQuantity: true,
      termLength: true,
      renewable: true,
      pausable: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Pick a plan that fits your team. Ask for a quote and we will prepare it for review."
      />

      {plans.length === 0 ? (
        <EmptyState title="No plans available right now" description="Check back soon or contact us." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const subject = encodeURIComponent(`Quote request: ${plan.name}`);
            const body = encodeURIComponent(`Hello,\n\nPlease prepare a quote for the plan "${plan.name}".\n`);
            return (
              <Card key={plan.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {plan.description ? <CardDescription>{plan.description}</CardDescription> : null}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5">
                  <div>
                    <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                      {formatMoney(plan.price)}
                    </span>
                    <span className="text-sm text-neutral-500"> / {PERIOD_SHORT[plan.billingPeriod]}</span>
                  </div>
                  <ul className="grid gap-2 text-sm text-neutral-700">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-green-600" />
                      Minimum quantity: {plan.minQuantity}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-green-600" />
                      {termLabel(plan.termLength, plan.billingPeriod)}
                    </li>
                    {plan.pausable ? (
                      <li className="flex items-center gap-2">
                        <Check className="size-4 text-green-600" />
                        Can be paused
                      </li>
                    ) : null}
                    {plan.renewable ? (
                      <li className="flex items-center gap-2">
                        <Check className="size-4 text-green-600" />
                        Renewable
                      </li>
                    ) : null}
                  </ul>
                  <div className="mt-auto pt-2">
                    <a
                      href={`mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`}
                      className={`${buttonVariants({ variant: "outline" })} w-full`}
                    >
                      <Mail />
                      Ask for a quote
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-sm text-neutral-500">
        Already have a quotation?{" "}
        <Link href="/portal" className="font-medium text-neutral-900 underline underline-offset-4">
          Go to your subscriptions
        </Link>
        .
      </p>
    </div>
  );
}
