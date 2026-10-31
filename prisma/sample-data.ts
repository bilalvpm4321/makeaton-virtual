// Adds five realistic sample customers on top of a bootstrapped database. Never deletes anything.
// Subscriptions are billed through the real billing engine, so invoices, taxes and discounts are genuine.
// Usage: npm run db:sample
// Optional: DEMO_CUSTOMER_EMAIL=you@example.com gives the café customer your email, so signing up or
// using "Continue with Google" with it opens their customer portal (their pending quotation is there).
import type { BillingPeriod, PaymentMethod, Prisma } from "@prisma/client";
import { logActivity } from "../src/lib/activity";
import { normalizeEmail } from "../src/lib/auth/password";
import { expiryFor } from "../src/lib/billing/period";
import { runBilling } from "../src/lib/billing/run";
import { addDays, addMonths, today } from "../src/lib/dates";
import { prisma } from "../src/lib/db";
import { formatMoney } from "../src/lib/money";
import { nextSubscriptionNumber } from "../src/lib/sequence";
import { recomputeRecurringTotal } from "../src/lib/subscriptions/service";

const MARKER_EMAIL = "accounts@malabar-textiles.example";

type LineSpec = { productId: string; variantId?: string; quantity: number };
type SubSpec = {
  customerId: string;
  planId: string;
  startDate: Date;
  paymentTermId: string;
  lines: LineSpec[];
  status: "ACTIVE" | "QUOTATION";
  validUntil?: Date;
  discountIds?: string[];
};

async function findOrCreate<T>(find: () => Promise<T | null>, create: () => Promise<T>): Promise<T> {
  return (await find()) ?? (await create());
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No admin found. Run `npm run db:bootstrap` first.");
  if (await prisma.customer.findUnique({ where: { email: MARKER_EMAIL } })) {
    console.log("Sample data is already present; nothing to do.");
    return;
  }
  const now = today();

  // Catalog
  const gst18 = await findOrCreate(
    () => prisma.tax.findFirst({ where: { rateBps: 1800, isActive: true } }),
    () => prisma.tax.create({ data: { name: "GST 18%", rateBps: 1800 } }),
  );
  const term15 = await findOrCreate(
    () => prisma.paymentTerm.findFirst({ where: { dueDays: 15 } }),
    () => prisma.paymentTerm.create({ data: { name: "15 days", dueDays: 15 } }),
  );
  const term30 = await findOrCreate(
    () => prisma.paymentTerm.findFirst({ where: { dueDays: 30 } }),
    () => prisma.paymentTerm.create({ data: { name: "30 days", dueDays: 30 } }),
  );

  const product = (name: string, salesPrice: number, costPrice: number, notes: string) =>
    findOrCreate(
      () => prisma.product.findFirst({ where: { name } }),
      () => prisma.product.create({ data: { name, salesPrice, costPrice, notes, type: "SERVICE", defaultTaxId: gst18.id } }),
    );
  const crm = await product("Brightloop CRM", 120000, 30000, "Leads, deals and follow-ups for small sales teams.");
  const accounting = await product("Brightloop Accounting", 180000, 50000, "GST-ready books, ledgers and reports.");
  const storage = await product("Extra Storage 100 GB", 29900, 5000, "Add-on: more space for files and attachments.");
  const support = await product("Priority Support", 99900, 20000, "Add-on: 4-hour response, dedicated contact.");

  const variant = (productId: string, value: string, extraPrice: number) =>
    prisma.productVariant.upsert({
      where: { productId_attribute_value: { productId, attribute: "Brand", value } },
      update: {},
      create: { productId, attribute: "Brand", value, extraPrice },
    });
  const crmOdoo = await variant(crm.id, "Odoo", 56000);
  const crmStandard = await variant(crm.id, "Standard", 0);

  const plan = (name: string, data: Omit<Prisma.PlanUncheckedCreateInput, "name">) =>
    findOrCreate(() => prisma.plan.findFirst({ where: { name } }), () => prisma.plan.create({ data: { name, ...data } }));
  const crmMonthly = await plan("CRM Monthly", {
    productId: crm.id, price: 120000, billingPeriod: "MONTHLY", minQuantity: 1,
    closable: true, pausable: true, renewable: true, description: "Pay month to month, cancel any time.",
  });
  const crmYearly = await plan("CRM Yearly", {
    productId: crm.id, price: 1200000, billingPeriod: "YEARLY", minQuantity: 5, termLength: 1,
    closable: true, renewable: true, description: "Two months free versus monthly, for teams of 5+.",
  });
  const accountingMonthly = await plan("Accounting Monthly", {
    productId: accounting.id, price: 180000, billingPeriod: "MONTHLY", minQuantity: 1, termLength: 12,
    autoClose: true, closable: true, renewable: true, description: "12-month term, closes automatically at the end.",
  });

  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
  const volume = await findOrCreate(
    () => prisma.discountRule.findFirst({ where: { name: "Volume 10+ seats" } }),
    () => prisma.discountRule.create({
      data: {
        name: "Volume 10+ seats", code: "VOLUME10", type: "PERCENT", value: 1000, scope: "SUBSCRIPTION",
        minQuantity: 10, startDate: yearStart, endDate: yearEnd, usageLimit: 100, createdById: admin.id,
      },
    }),
  );
  await findOrCreate(
    () => prisma.quotationTemplate.findFirst({ where: { name: "Enterprise Yearly — CRM + Support" } }),
    () => prisma.quotationTemplate.create({
      data: {
        name: "Enterprise Yearly — CRM + Support", validityDays: 30, planId: crmYearly.id, paymentTermId: term30.id,
        notes: "Standard offer for teams of 10 or more.",
        lines: { create: [
          { productId: crm.id, variantId: crmOdoo.id, quantity: 10 },
          { productId: support.id, quantity: 1 },
        ] },
      },
    }),
  );

  // Customers
  const customer = (name: string, company: string, email: string, phone: string, address: string) =>
    prisma.customer.create({ data: { name, company, email: normalizeEmail(email), phone, address } });
  const malabar = await customer("Anitha Menon", "Malabar Textiles", MARKER_EMAIL, "+91 98470 12345", "MG Road, Kozhikode, Kerala 673001");
  const greenLeaf = await customer("Rahul Nair", "Green Leaf Organics", "hello@greenleaf-organics.example", "+91 94460 22110", "Kakkanad, Kochi, Kerala 682030");
  const spiceRoute = await customer("Fathima Rasheed", "Spice Route Exports", "finance@spiceroute-exports.example", "+91 90480 77881", "Mattancherry, Kochi, Kerala 682002");
  const nila = await customer("Arjun Das", "Nila Design Studio", "studio@niladesign.example", "+91 97440 55432", "Vazhuthacaud, Thiruvananthapuram, Kerala 695014");
  const cafe = await customer("Meera Joseph", "Kochi Café Collective",
    process.env.DEMO_CUSTOMER_EMAIL || "owner@kochicafe.example", "+91 95390 66120", "Fort Kochi, Kerala 682001");

  // Subscriptions
  const productsById = new Map([crm, accounting, storage, support].map((p) => [p.id, p]));
  const variantsById = new Map([crmOdoo, crmStandard].map((v) => [v.id, v]));
  const plansById = new Map([crmMonthly, crmYearly, accountingMonthly].map((p) => [p.id, p]));

  async function createSubscription(spec: SubSpec) {
    const p = plansById.get(spec.planId)!;
    return prisma.$transaction(async (tx) => {
      const termPeriods = p.termLength ?? null;
      const sub = await tx.subscription.create({
        data: {
          number: await nextSubscriptionNumber(tx),
          customerId: spec.customerId,
          planId: p.id,
          status: spec.status,
          startDate: spec.startDate,
          termPeriods,
          expiryDate: expiryFor(spec.startDate, p.billingPeriod as BillingPeriod, termPeriods),
          periodsBilled: 0,
          nextInvoiceDate: spec.status === "ACTIVE" ? spec.startDate : null,
          validUntil: spec.validUntil ?? null,
          paymentTermId: spec.paymentTermId,
          salespersonId: admin!.id,
          lines: {
            create: spec.lines.map((l) => {
              const prod = productsById.get(l.productId)!;
              const v = l.variantId ? variantsById.get(l.variantId)! : null;
              return {
                productId: prod.id,
                variantId: v?.id ?? null,
                description: v ? `${prod.name} — ${v.attribute}: ${v.value}` : prod.name,
                quantity: l.quantity,
                unitPrice: (prod.id === p.productId ? p.price : prod.salesPrice) + (v?.extraPrice ?? 0),
                taxId: prod.defaultTaxId,
              };
            }),
          },
          discounts: spec.discountIds?.length ? { create: spec.discountIds.map((discountId) => ({ discountId })) } : undefined,
        },
      });
      await recomputeRecurringTotal(tx, sub.id);
      await logActivity(tx, { entityType: "subscription", entityId: sub.id, message: "Subscription created", userId: admin!.id });
      if (spec.status === "ACTIVE") {
        await logActivity(tx, { entityType: "subscription", entityId: sub.id, message: "Status: Confirmed → Active", userId: admin!.id });
      } else {
        await logActivity(tx, { entityType: "subscription", entityId: sub.id, message: "Status: Draft → Quotation", userId: admin!.id });
      }
      return sub;
    });
  }

  const subMalabar = await createSubscription({
    customerId: malabar.id, planId: crmMonthly.id, startDate: addMonths(now, -4), paymentTermId: term15.id, status: "ACTIVE",
    lines: [{ productId: crm.id, variantId: crmOdoo.id, quantity: 5 }, { productId: storage.id, quantity: 2 }],
  });
  const subGreenLeaf = await createSubscription({
    customerId: greenLeaf.id, planId: accountingMonthly.id, startDate: addMonths(now, -3), paymentTermId: term15.id, status: "ACTIVE",
    lines: [{ productId: accounting.id, quantity: 2 }],
  });
  const subSpice = await createSubscription({
    customerId: spiceRoute.id, planId: crmYearly.id, startDate: addMonths(now, -2), paymentTermId: term30.id, status: "ACTIVE",
    lines: [{ productId: crm.id, variantId: crmStandard.id, quantity: 12 }, { productId: support.id, quantity: 1 }],
    discountIds: [volume.id],
  });
  const subNila = await createSubscription({
    customerId: nila.id, planId: crmMonthly.id, startDate: addMonths(now, -2), paymentTermId: term15.id, status: "ACTIVE",
    lines: [{ productId: crm.id, variantId: crmStandard.id, quantity: 2 }],
  });
  const subCafe = await createSubscription({
    customerId: cafe.id, planId: crmMonthly.id, startDate: addDays(now, 7), paymentTermId: term15.id, status: "QUOTATION",
    validUntil: addDays(now, 30),
    lines: [{ productId: crm.id, variantId: crmStandard.id, quantity: 1 }, { productId: storage.id, quantity: 1 }],
  });

  // Billing day, catching up every period since each start date.
  const run = await runBilling(now, admin.id);

  // Make the history look lived-in: each invoice issued on its period start and confirmed then,
  // then payments by plan: unpaid invoices whose due date has passed show up as overdue.
  const methods: PaymentMethod[] = ["UPI", "BANK_TRANSFER", "CARD", "UPI", "CHEQUE"];
  let m = 0;
  async function settle(subscriptionId: string, dueDays: number, pay: (index: number, count: number) => number) {
    const invoices = await prisma.invoice.findMany({ where: { subscriptionId }, orderBy: { periodStart: "asc" } });
    for (const [i, inv] of invoices.entries()) {
      const issue = inv.periodStart ?? inv.issueDate;
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { issueDate: issue, dueDate: addDays(issue, dueDays), status: "CONFIRMED", confirmedAt: issue },
      });
      await logActivity(prisma, { entityType: "invoice", entityId: inv.id, message: "Status: Draft → Confirmed", userId: admin!.id });
      const share = pay(i, invoices.length);
      if (share <= 0) continue;
      const amount = Math.min(inv.total, Math.round(inv.total * share));
      const method = methods[m++ % methods.length];
      const paidOn = addDays(issue, 5) > now ? now : addDays(issue, 5);
      await prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: { invoiceId: inv.id, method, amount, date: paidOn, note: share < 1 ? "Part payment" : null, recordedById: admin!.id },
        });
        const full = amount >= inv.total;
        await tx.invoice.update({
          where: { id: inv.id },
          data: { amountPaid: amount, ...(full ? { status: "PAID", paidAt: paidOn } : {}) },
        });
        await logActivity(tx, { entityType: "invoice", entityId: inv.id, message: `Payment of ${formatMoney(amount)} recorded (${method.replace("_", " ").toLowerCase()})`, userId: admin!.id });
        if (full) await logActivity(tx, { entityType: "invoice", entityId: inv.id, message: "Status: Confirmed → Paid", userId: admin!.id });
      });
    }
    return invoices.length;
  }
  const nMalabar = await settle(subMalabar.id, term15.dueDays, (i, n) => (i < n - 2 ? 1 : 0)); // one overdue, one current
  const nGreen = await settle(subGreenLeaf.id, term15.dueDays, (i, n) => (i < n - 1 ? 1 : 0));
  const nSpice = await settle(subSpice.id, term30.dueDays, () => 0.5); // yearly, half paid
  const nNila = await settle(subNila.id, term15.dueDays, (i, n) => (i < n - 1 ? 1 : 0));

  // Nila pauses after their latest invoice.
  await prisma.subscription.update({ where: { id: subNila.id }, data: { status: "PAUSED", pausedAt: new Date() } });
  await logActivity(prisma, { entityType: "subscription", entityId: subNila.id, message: "Status: Active → Paused", userId: admin.id });

  console.log("Sample data added (nothing was deleted).");
  console.log(`  Billing run: ${run.invoiced} invoices, ${run.errors} errors`);
  console.log(`  ${subMalabar.number} Malabar Textiles — CRM Monthly (Odoo) ×5 + storage, ${nMalabar} invoices, 1 overdue`);
  console.log(`  ${subGreenLeaf.number} Green Leaf Organics — Accounting Monthly ×2, ${nGreen} invoices`);
  console.log(`  ${subSpice.number} Spice Route Exports — CRM Yearly ×12 with 10% volume discount, ${nSpice} invoice, half paid`);
  console.log(`  ${subNila.number} Nila Design Studio — CRM Monthly ×2, ${nNila} invoices, paused`);
  console.log(`  ${subCafe.number} Kochi Café Collective — quotation awaiting acceptance (${cafe.email})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
