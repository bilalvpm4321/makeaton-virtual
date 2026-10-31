import Link from "next/link";
import { Check, Repeat, TrendingUp, Wallet } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { PERIOD_SHORT } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

// Plans change at runtime, so always read them fresh. The page still renders when the database is unreachable.
export const dynamic = "force-dynamic";

async function getPublicPlans() {
  try {
    return await prisma.plan.findMany({
      where: { isPublic: true, isActive: true },
      orderBy: [{ price: "asc" }, { name: "asc" }],
      take: 6,
      select: {
        id: true,
        name: true,
        price: true,
        billingPeriod: true,
        pausable: true,
        closable: true,
        renewable: true,
        product: { select: { name: true } },
      },
    });
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const plans = await getPublicPlans();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="Brightloop home">
          <BrandMark tone="light" />
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            Log in
          </Link>
          <Link href="/signup" className={buttonVariants({ variant: "default" })}>
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-16 text-center sm:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-card">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
          Recurring billing, done right
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-[44px] leading-[1.04] tracking-tight sm:text-[60px] lg:text-[72px] lg:leading-[1.02]">
          Subscriptions, invoices and revenue <em className="text-primary">in one place</em>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
          Plans, quotations, automatic invoicing, taxes, discounts and payments. One loop, billed once, never skipped.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
            Start free
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Log in
          </Link>
        </div>

        <div className="mx-auto mt-14 max-w-4xl rounded-2xl border border-border bg-card p-2 text-left shadow-pop">
          <div className="grid gap-3 rounded-xl bg-background p-3 sm:grid-cols-3 sm:p-4">
            <KpiCard label="MRR" value={formatMoney(24_860_000)} hint="Normalized monthly" icon={TrendingUp} />
            <KpiCard label="Active subscriptions" value="142" hint="Across 6 plans" icon={Repeat} />
            <KpiCard label="Collected" value={formatMoney(19_625_000)} hint="This month" tone="success" icon={Wallet} />
          </div>
          <p className="px-3 pt-2 pb-1 text-[11px] text-muted-foreground">Illustrative figures.</p>
        </div>
      </section>

      <section id="plans" className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold">Simple plans</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pick a plan and we will prepare your quotation.</p>

        {plans.length === 0 ? (
          <Card className="mt-8">
            <EmptyState
              title="No public plans yet"
              description="Plans appear here as soon as the team publishes them."
              action={
                <Link href="/signup" className={buttonVariants({ variant: "outline" })}>
                  Create an account
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan, index) => {
              const popular = plans.length >= 3 && index === 1;
              const features = [
                plan.pausable ? "Pausable" : null,
                plan.closable ? "Cancel anytime" : null,
                plan.renewable ? "Renewable" : null,
              ].filter((f): f is string => f !== null);

              return (
                <Card
                  key={plan.id}
                  className={cn("flex flex-col p-6", popular && "ring-2 ring-primary")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{plan.name}</h3>
                      {plan.product ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{plan.product.name}</p>
                      ) : null}
                    </div>
                    {popular ? <Badge variant="default">Popular</Badge> : null}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="num text-[34px] font-semibold leading-none tracking-tight">
                      {formatMoney(plan.price)}
                    </span>
                    <span className="text-sm text-muted-foreground">/ {PERIOD_SHORT[plan.billingPeriod]}</span>
                  </div>

                  {features.length > 0 ? (
                    <ul className="mt-5 space-y-2 text-sm">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="size-4 shrink-0 text-success" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-auto pt-6">
                    <Link href="/signup" className={cn(buttonVariants({ variant: popular ? "default" : "outline" }), "w-full")}>
                      Choose plan
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <footer className="mt-auto border-t border-border py-8 text-center text-xs text-muted-foreground">
        © Brightloop · Subscription billing
      </footer>
    </div>
  );
}
