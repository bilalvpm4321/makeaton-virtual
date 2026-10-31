/**
 * Demo seed. Wipes every table, then creates:
 *  - demo users (admin, staff, customer) and the catalog: taxes, payment terms, products with variants,
 *    plans, discount rules and quotation templates;
 *  - named customers with subscriptions in every status, with invoices and payments;
 *  - SEED_SCALE generated customers, each with one active monthly subscription and its billing history.
 *
 * Usage: npm run db:seed            (SEED_SCALE=5000 npm run db:seed for the performance test)
 * Refuses to run in production (see assertDemoSeedAllowed) unless ALLOW_DEMO_SEED=true.
 */
import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  Prisma,
  PrismaClient,
  type DiscountRule,
  type PaymentMethod,
  type PaymentTerm,
  type Plan,
  type Product,
  type ProductVariant,
  type SubscriptionStatus,
  type Tax,
} from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import {
  computeInvoiceDraft,
  type ComputeDiscount,
  type ComputeLine,
} from "../src/lib/billing/compute";
import { expiryFor, periodEnd, periodStart } from "../src/lib/billing/period";
import { addDays, addMonths, addPeriod, today, type Period } from "../src/lib/dates";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the environment as given.
}

const prisma = new PrismaClient();

const CHUNK = 1000;
const SCALE = Math.max(0, Number(process.env.SEED_SCALE ?? 200) || 0);
const TODAY = today();

const daysFromToday = (n: number) => addDays(TODAY, n);
const monthsAgo = (n: number) => addMonths(TODAY, -n);
/** Anchor for a subscription that is due for its k-th period exactly today. */
const dueToday = (period: Period, k: number) => addPeriod(TODAY, period, -k);
/** Subscriptions are created a little before they start; never in the future. */
const backdate = (start: Date) => (start < TODAY ? addDays(start, -2) : TODAY);
/** Timestamp at a given hour of a business date (UTC). */
const at = (date: Date, hour: number) => new Date(date.getTime() + hour * 3_600_000);

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  DRAFT: "Draft",
  QUOTATION: "Quotation",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

const PATH_QUOTE: SubscriptionStatus[] = ["DRAFT", "QUOTATION"];
const PATH_CONFIRMED: SubscriptionStatus[] = [...PATH_QUOTE, "CONFIRMED"];
const PATH_ACTIVE: SubscriptionStatus[] = [...PATH_CONFIRMED, "ACTIVE"];
const PATH_PAUSED: SubscriptionStatus[] = [...PATH_ACTIVE, "PAUSED"];
const PATH_CLOSED: SubscriptionStatus[] = [...PATH_ACTIVE, "CLOSED"];

// ---------------------------------------------------------------------------
// Batch buffers: every subscription, invoice and payment is collected here and written with createMany.
// ---------------------------------------------------------------------------

const batch = {
  customers: [] as Prisma.CustomerCreateManyInput[],
  subscriptions: [] as Prisma.SubscriptionCreateManyInput[],
  subscriptionLines: [] as Prisma.SubscriptionLineCreateManyInput[],
  subscriptionDiscounts: [] as Prisma.SubscriptionDiscountCreateManyInput[],
  invoices: [] as Prisma.InvoiceCreateManyInput[],
  invoiceLines: [] as Prisma.InvoiceLineCreateManyInput[],
  payments: [] as Prisma.PaymentCreateManyInput[],
  redemptions: [] as Prisma.DiscountRedemptionCreateManyInput[],
  activities: [] as Prisma.ActivityCreateManyInput[],
};

/** Usage counts per discount, kept in step with the invoices the seed creates. */
const usage = new Map<string, number>();
const subCounter = { n: 0 };
const invoiceCounters = new Map<number, number>();

function nextSubNumber(): string {
  subCounter.n += 1;
  return `SUB/${String(subCounter.n).padStart(5, "0")}`;
}

/** Same format as lib/sequence.ts: INV/<year>/00001, one counter per year. */
function nextInvoiceNumber(issue: Date): string {
  const year = issue.getUTCFullYear();
  const n = (invoiceCounters.get(year) ?? 0) + 1;
  invoiceCounters.set(year, n);
  return `INV/${year}/${String(n).padStart(5, "0")}`;
}

const METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD", "UPI", "CHEQUE", "OTHER"];
const randomMethod = (): PaymentMethod => faker.helpers.arrayElement(METHODS);

/** A payment lands between issue and a few days past the due date, never after today. */
function paymentDate(issue: Date, dueDays: number): Date {
  const offset = faker.number.int({ min: 0, max: dueDays + 5 });
  const date = addDays(issue, offset);
  return date > TODAY ? TODAY : date;
}

// ---------------------------------------------------------------------------
// Pricing and line helpers (PLAN §6.3): plan.price for the plan's product, otherwise salesPrice, plus variant extra.
// ---------------------------------------------------------------------------

type ProductRef = {
  id: string;
  name: string;
  salesPrice: number;
  taxId: string | null;
  taxName: string | null;
  taxRateBps: number;
};

type LineInput = { product: ProductRef; variant?: ProductVariant; quantity: number };

function line(product: ProductRef, quantity: number, variant?: ProductVariant): LineInput {
  return { product, variant, quantity };
}

function priceLine(plan: Plan, input: LineInput) {
  const { product, variant, quantity } = input;
  const base = product.id === plan.productId ? plan.price : product.salesPrice;
  return {
    productId: product.id,
    variantId: variant?.id ?? null,
    description: variant ? `${product.name} (${variant.attribute}: ${variant.value})` : product.name,
    quantity,
    unitPrice: base + (variant?.extraPrice ?? 0),
    taxId: product.taxId,
    taxName: product.taxName,
    taxRateBps: product.taxRateBps,
  };
}

// ---------------------------------------------------------------------------
// Subscription builder: writes the subscription, its lines, discounts, invoices and payments.
// ---------------------------------------------------------------------------

type SubInput = {
  customerId: string;
  createdAt: Date;
  plan: Plan;
  status: SubscriptionStatus;
  start: Date;
  term: PaymentTerm;
  lines: LineInput[];
  discounts?: ComputeDiscount[];
  /** Number of billing periods already invoiced (k). Each one becomes an invoice. */
  periodsBilled?: number;
  /** Decides whether invoice k is paid in full. */
  isPaid?: (index: number) => boolean;
  /** Invoice index that gets a partial payment instead (only when it is not paid). */
  partialIndex?: number;
  validUntil?: Date | null;
  pausedAt?: Date | null;
  closedAt?: Date | null;
  closeReason?: string | null;
  templateId?: string | null;
  salespersonId?: string | null;
  /** Staff member who records payments and owns the activity trail. */
  actorId?: string | null;
  path?: SubscriptionStatus[];
};

function addSubscription(input: SubInput): void {
  const { plan, term, start } = input;
  const period = plan.billingPeriod;
  const subId = randomUUID();
  const priced = input.lines.map((l) => priceLine(plan, l));
  const recurringTotal = priced.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const periodsBilled = input.periodsBilled ?? 0;
  const billing = input.status === "ACTIVE" || input.status === "PAUSED";

  batch.subscriptions.push({
    id: subId,
    number: nextSubNumber(),
    customerId: input.customerId,
    planId: plan.id,
    status: input.status,
    startDate: start,
    termPeriods: plan.termLength,
    expiryDate: expiryFor(start, period, plan.termLength),
    periodsBilled,
    nextInvoiceDate: billing ? periodStart(start, period, periodsBilled) : null,
    validUntil: input.validUntil ?? null,
    paymentTermId: term.id,
    salespersonId: input.salespersonId ?? null,
    templateId: input.templateId ?? null,
    recurringTotal,
    pausedAt: input.pausedAt ?? null,
    closedAt: input.closedAt ?? null,
    closeReason: input.closeReason ?? null,
    createdAt: input.createdAt,
  });

  for (const l of priced) {
    batch.subscriptionLines.push({
      id: randomUUID(),
      subscriptionId: subId,
      productId: l.productId,
      variantId: l.variantId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxId: l.taxId,
    });
  }

  for (const d of input.discounts ?? []) {
    batch.subscriptionDiscounts.push({ id: randomUUID(), subscriptionId: subId, discountId: d.id });
  }

  // Invoices for every elapsed period, computed by the same pure engine billing uses.
  const computeLines: ComputeLine[] = priced.map((l) => ({
    productId: l.productId,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxName: l.taxName,
    taxRateBps: l.taxRateBps,
  }));

  for (let k = 0; k < periodsBilled; k++) {
    const issue = periodStart(start, period, k);
    const dueDate = addDays(issue, term.dueDays);
    const draft = computeInvoiceDraft(
      computeLines,
      (input.discounts ?? []).map((d) => ({ ...d, usageCount: usage.get(d.id) ?? 0 })),
      issue,
    );
    for (const applied of draft.appliedDiscounts) {
      usage.set(applied.discountId, (usage.get(applied.discountId) ?? 0) + 1);
    }

    const invoiceId = randomUUID();
    const paid = input.isPaid?.(k) ?? false;
    const partial = !paid && input.partialIndex === k;
    const paidOn = paid ? paymentDate(issue, term.dueDays) : null;
    const amountPaid = paid ? draft.total : partial ? Math.floor(draft.total / 3) : 0;

    batch.invoices.push({
      id: invoiceId,
      number: nextInvoiceNumber(issue),
      customerId: input.customerId,
      subscriptionId: subId,
      periodStart: issue,
      periodEnd: periodEnd(start, period, k),
      issueDate: issue,
      dueDate,
      status: paid ? "PAID" : "CONFIRMED",
      subtotal: draft.subtotal,
      discountTotal: draft.discountTotal,
      taxTotal: draft.taxTotal,
      total: draft.total,
      amountPaid,
      confirmedAt: at(issue, 9),
      paidAt: paidOn ? at(paidOn, 12) : null,
      createdAt: issue,
    });

    for (const l of draft.lines) {
      batch.invoiceLines.push({
        id: randomUUID(),
        invoiceId,
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        subtotal: l.subtotal,
        discountAmount: l.discountAmount,
        taxName: l.taxName,
        taxRateBps: l.taxRateBps,
        taxAmount: l.taxAmount,
        total: l.total,
      });
    }

    for (const applied of draft.appliedDiscounts) {
      batch.redemptions.push({
        id: randomUUID(),
        discountId: applied.discountId,
        invoiceId,
        amount: applied.amount,
      });
    }

    if (paidOn) {
      batch.payments.push({
        id: randomUUID(),
        invoiceId,
        method: randomMethod(),
        amount: draft.total,
        date: paidOn,
        recordedById: input.actorId ?? null,
      });
    } else if (partial) {
      batch.payments.push({
        id: randomUUID(),
        invoiceId,
        method: "BANK_TRANSFER",
        amount: amountPaid,
        date: paymentDate(issue, term.dueDays),
        recordedById: input.actorId ?? null,
      });
    }
  }

  const path = input.path ?? [];
  path.slice(1).forEach((to, i) => {
    batch.activities.push({
      id: randomUUID(),
      entityType: "subscription",
      entityId: subId,
      message: `Status: ${STATUS_LABEL[path[i]]} → ${STATUS_LABEL[to]}`,
      userId: input.actorId ?? null,
      createdAt: at(input.createdAt, i),
    });
  });
}

// ---------------------------------------------------------------------------
// Database wipe, catalog and users
// ---------------------------------------------------------------------------

async function wipe(): Promise<void> {
  // Reverse dependency order.
  await prisma.activity.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.billingRun.deleteMany();
  await prisma.discountRedemption.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscriptionDiscount.deleteMany();
  await prisma.subscriptionLine.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.quotationTemplateLine.deleteMany();
  await prisma.quotationTemplate.deleteMany();
  await prisma.discountRule.deleteMany();
  await prisma.paymentTerm.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.product.deleteMany();
  await prisma.tax.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.user.deleteMany();
}

async function createUsers() {
  const admin = await prisma.user.create({
    data: {
      email: "admin@brightloop.test",
      name: "Priya Admin",
      passwordHash: await hashPassword("Admin@12345"),
      role: "ADMIN",
    },
  });
  const staff = await prisma.user.create({
    data: {
      email: "staff@brightloop.test",
      name: "Sam Staff",
      passwordHash: await hashPassword("Staff@12345"),
      role: "STAFF",
    },
  });
  const customer = await prisma.user.create({
    data: {
      email: "customer@brightloop.test",
      name: "Asha Mehta",
      passwordHash: await hashPassword("Customer@12345"),
      role: "CUSTOMER",
    },
  });
  return { admin, staff, customer };
}

async function createCatalog(adminId: string) {
  const tax = {
    G18: await prisma.tax.create({ data: { name: "GST 18%", rateBps: 1800 } }),
    G5: await prisma.tax.create({ data: { name: "GST 5%", rateBps: 500 } }),
    Z0: await prisma.tax.create({ data: { name: "Zero-rated", rateBps: 0 } }),
  };

  const term = {
    IMM: await prisma.paymentTerm.create({ data: { name: "Immediate", dueDays: 0 } }),
    D15: await prisma.paymentTerm.create({ data: { name: "15 days", dueDays: 15 } }),
    D30: await prisma.paymentTerm.create({ data: { name: "30 days", dueDays: 30 } }),
  };

  const crm = await prisma.product.create({
    data: {
      name: "Brightloop CRM",
      type: "SERVICE",
      salesPrice: 120000,
      costPrice: 30000,
      notes: "Customer relationship management, priced per seat.",
      defaultTaxId: tax.G18.id,
      variants: {
        create: [
          { attribute: "Brand", value: "Odoo", extraPrice: 56000 },
          { attribute: "Brand", value: "Standard", extraPrice: 0 },
        ],
      },
    },
    include: { variants: true },
  });
  const crmOdoo = crm.variants.find((v) => v.value === "Odoo");
  const crmStd = crm.variants.find((v) => v.value === "Standard");
  if (!crmOdoo || !crmStd) throw new Error("CRM variants missing");

  const accounting = await prisma.product.create({
    data: {
      name: "Brightloop Accounting",
      type: "SERVICE",
      salesPrice: 180000,
      costPrice: 50000,
      defaultTaxId: tax.G18.id,
    },
  });
  const storage = await prisma.product.create({
    data: {
      name: "Extra Storage 100 GB",
      type: "SERVICE",
      salesPrice: 29900,
      costPrice: 8000,
      defaultTaxId: tax.G18.id,
    },
  });
  const support = await prisma.product.create({
    data: {
      name: "Priority Support",
      type: "SERVICE",
      salesPrice: 99900,
      costPrice: 40000,
      defaultTaxId: tax.G18.id,
    },
  });
  await prisma.product.create({
    data: {
      name: "Onboarding Kit",
      type: "GOODS",
      salesPrice: 250000,
      costPrice: 120000,
      notes: "One-off hardware and printed guide.",
      defaultTaxId: tax.G5.id,
    },
  });

  const ref = (p: Product, t: Tax): ProductRef => ({
    id: p.id,
    name: p.name,
    salesPrice: p.salesPrice,
    taxId: t.id,
    taxName: t.name,
    taxRateBps: t.rateBps,
  });

  const plan = {
    CRM_M: await prisma.plan.create({
      data: {
        name: "CRM Monthly",
        description: "Full CRM for one seat, billed every month. Pause, close or renew any time.",
        productId: crm.id,
        price: 120000,
        billingPeriod: "MONTHLY",
        minQuantity: 1,
        termLength: null,
        autoClose: false,
        closable: true,
        pausable: true,
        renewable: true,
      },
    }),
    CRM_Y: await prisma.plan.create({
      data: {
        name: "CRM Yearly",
        description: "Annual CRM contract for teams of five or more seats.",
        productId: crm.id,
        price: 1200000,
        billingPeriod: "YEARLY",
        minQuantity: 5,
        termLength: 1,
        autoClose: false,
        closable: true,
        pausable: false,
        renewable: true,
      },
    }),
    ACC_M: await prisma.plan.create({
      data: {
        name: "Accounting Monthly",
        description: "Twelve-month accounting term, billed monthly. Closes automatically at the end of the term.",
        productId: accounting.id,
        price: 180000,
        billingPeriod: "MONTHLY",
        minQuantity: 1,
        availableFrom: new Date(Date.UTC(2025, 0, 1)),
        availableUntil: new Date(Date.UTC(2030, 11, 31)),
        termLength: 12,
        autoClose: true,
        closable: true,
        pausable: false,
        renewable: true,
      },
    }),
    TRIAL_W: await prisma.plan.create({
      data: {
        name: "Weekly Trial",
        description: "Four-week trial, billed weekly. Not renewable.",
        price: 19900,
        billingPeriod: "WEEKLY",
        minQuantity: 1,
        termLength: 4,
        autoClose: true,
        closable: true,
        pausable: false,
        renewable: false,
      },
    }),
    DAY_P: await prisma.plan.create({
      data: {
        name: "Daily Pass",
        description: "Seven days of access, billed daily.",
        price: 4900,
        billingPeriod: "DAILY",
        minQuantity: 1,
        termLength: 7,
        autoClose: true,
        closable: true,
        pausable: false,
        renewable: true,
      },
    }),
  };

  const yearStart = new Date(Date.UTC(TODAY.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(TODAY.getUTCFullYear(), 11, 31));
  const lastMonthEnd = addDays(new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), 1)), -1);

  const volume = await prisma.discountRule.create({
    data: {
      name: "Volume 10+ seats",
      type: "PERCENT",
      value: 1000,
      scope: "SUBSCRIPTION",
      minQuantity: 10,
      usageLimit: 100,
      startDate: yearStart,
      endDate: yearEnd,
      createdById: adminId,
    },
  });
  const flat = await prisma.discountRule.create({
    data: {
      name: "Flat ₹500 Welcome",
      code: "WELCOME500",
      type: "FIXED",
      value: 50000,
      scope: "SUBSCRIPTION",
      minPurchase: 200000,
      usageLimit: 1,
      createdById: adminId,
    },
  });
  // Expired last month: shown in the admin list, never applied to new invoices.
  const supportOff = await prisma.discountRule.create({
    data: {
      name: "Support 20% off",
      type: "PERCENT",
      value: 2000,
      scope: "PRODUCTS",
      endDate: lastMonthEnd,
      createdById: adminId,
      products: { connect: [{ id: support.id }] },
    },
  });

  const discountRef = (row: DiscountRule, productIds: string[]): ComputeDiscount => ({
    id: row.id,
    name: row.name,
    type: row.type,
    value: row.value,
    scope: row.scope,
    productIds,
    minPurchase: row.minPurchase,
    minQuantity: row.minQuantity,
    startDate: row.startDate,
    endDate: row.endDate,
    usageLimit: row.usageLimit,
    usageCount: row.usageCount,
    isActive: row.isActive,
    createdAt: row.createdAt,
  });

  const enterprise = await prisma.quotationTemplate.create({
    data: {
      name: "Enterprise Yearly — CRM + Support",
      validityDays: 30,
      planId: plan.CRM_Y.id,
      paymentTermId: term.D30.id,
      notes: "Ten Odoo-branded CRM seats with priority support.",
      lines: {
        create: [
          { productId: crm.id, variantId: crmOdoo.id, quantity: 10, taxId: tax.G18.id },
          { productId: support.id, quantity: 1, taxId: tax.G18.id },
        ],
      },
    },
  });
  await prisma.quotationTemplate.create({
    data: {
      name: "CRM Monthly Starter",
      validityDays: 14,
      planId: plan.CRM_M.id,
      paymentTermId: term.IMM.id,
      lines: {
        create: [{ productId: crm.id, variantId: crmStd.id, quantity: 3, taxId: tax.G18.id }],
      },
    },
  });

  return {
    tax,
    term,
    plan,
    products: {
      crm: ref(crm, tax.G18),
      accounting: ref(accounting, tax.G18),
      storage: ref(storage, tax.G18),
      support: ref(support, tax.G18),
    },
    variants: { odoo: crmOdoo, std: crmStd },
    discounts: {
      volume: discountRef(volume, []),
      flat: discountRef(flat, []),
      supportOff: discountRef(supportOff, [support.id]),
    },
    enterprise,
  };
}

// ---------------------------------------------------------------------------
// Named customers and subscriptions
// ---------------------------------------------------------------------------

type CustomerSeed = { key: string; name: string; email: string; company: string; address: string };

const NAMED_CUSTOMERS: CustomerSeed[] = [
  { key: "acme", name: "Acme Retail", email: "customer@brightloop.test", company: "Acme Retail Pvt Ltd", address: "14 Residency Road, Bengaluru 560025" },
  { key: "nimbus", name: "Nimbus Logistics", email: "accounts@nimbus-logistics.test", company: "Nimbus Logistics", address: "Plot 9, MIDC, Pune 411019" },
  { key: "peak", name: "Peak Fitness", email: "billing@peak-fitness.test", company: "Peak Fitness Studios", address: "22 Carter Road, Mumbai 400050" },
  { key: "sunrise", name: "Sunrise Dental", email: "office@sunrise-dental.test", company: "Sunrise Dental Clinic", address: "5 Park Street, Kolkata 700016" },
  { key: "bluemango", name: "Blue Mango Cafe", email: "hello@bluemango.test", company: "Blue Mango Cafe LLP", address: "Shop 3, Koregaon Park, Pune 411001" },
  { key: "harbor", name: "Harbor Books", email: "finance@harborbooks.test", company: "Harbor Books Pvt Ltd", address: "Marine Lines, Mumbai 400020" },
  { key: "lumen", name: "Lumen Studio", email: "ops@lumenstudio.test", company: "Lumen Studio Design", address: "7 Jubilee Hills, Hyderabad 500033" },
  { key: "orchid", name: "Orchid Clinics", email: "accounts@orchidclinics.test", company: "Orchid Clinics Group", address: "88 Anna Salai, Chennai 600002" },
  { key: "metro", name: "Metro Motors", email: "fleet@metromotors.test", company: "Metro Motors Ltd", address: "Ring Road, Surat 395002" },
  { key: "quantum", name: "Quantum Labs", email: "it@quantumlabs.test", company: "Quantum Labs Pvt Ltd", address: "Electronic City, Bengaluru 560100" },
  { key: "greenleaf", name: "Green Leaf Organics", email: "orders@greenleaf.test", company: "Green Leaf Organics", address: "12 Civil Lines, Jaipur 302006" },
  { key: "delta", name: "Delta Freight", email: "billing@deltafreight.test", company: "Delta Freight Carriers", address: "Plot 41, Mundra Port, Gujarat" },
  { key: "riverside", name: "Riverside Bakery", email: "hello@riversidebakery.test", company: "Riverside Bakery", address: "3 River Walk, Kochi 682011" },
  { key: "summit", name: "Summit Consulting", email: "accounts@summitconsulting.test", company: "Summit Consulting Group", address: "401 Corporate Park, Gurugram 122002" },
  { key: "willow", name: "Willow & Co", email: "admin@willowandco.test", company: "Willow & Co", address: "19 Brigade Road, Bengaluru 560001" },
  { key: "oakridge", name: "Oakridge Partners", email: "finance@oakridge.test", company: "Oakridge Partners LLP", address: "Sector 62, Noida 201301" },
  { key: "tidewater", name: "Tidewater Trading", email: "buy@tidewater.test", company: "Tidewater Trading Co", address: "Harbour Road, Visakhapatnam 530001" },
  { key: "cedar", name: "Cedar Hill Holdings", email: "contact@cedarhill.test", company: "Cedar Hill Holdings", address: "Baner Road, Pune 411045" },
];

async function createNamedCustomers(customerUserId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const c of NAMED_CUSTOMERS) {
    const id = randomUUID();
    ids[c.key] = id;
    batch.customers.push({
      id,
      name: c.name,
      email: c.email,
      company: c.company,
      address: c.address,
      phone: faker.phone.number(),
      userId: c.key === "acme" ? customerUserId : null,
    });
  }
  return ids;
}

function addNamedSubscriptions(
  cust: Record<string, string>,
  cat: Awaited<ReturnType<typeof createCatalog>>,
  staffId: string,
) {
  const { plan, term, products: P, variants: V, discounts: D } = cat;
  const T = term;
  const sales = { salespersonId: staffId, actorId: staffId };

  // Acme Retail: the portal demo login. Active with an overdue tail, plus a valid quotation.
  addSubscription({
    ...sales,
    customerId: cust.acme,
    createdAt: backdate(monthsAgo(3)),
    plan: plan.CRM_M,
    status: "ACTIVE",
    start: monthsAgo(3),
    term: T.D15,
    lines: [line(P.crm, 8, V.odoo), line(P.storage, 2)],
    periodsBilled: 3,
    isPaid: (i) => i < 1,
    path: PATH_ACTIVE,
  });
  addSubscription({
    ...sales,
    customerId: cust.acme,
    createdAt: daysFromToday(0),
    plan: plan.CRM_Y,
    status: "QUOTATION",
    start: daysFromToday(7),
    term: T.D30,
    lines: [line(P.crm, 10, V.odoo), line(P.support, 1)],
    validUntil: daysFromToday(30),
    templateId: cat.enterprise.id,
    path: PATH_QUOTE,
  });

  // Draft, valid quotations, expired quotation.
  addSubscription({
    ...sales,
    customerId: cust.nimbus,
    createdAt: daysFromToday(0),
    plan: plan.CRM_M,
    status: "DRAFT",
    start: daysFromToday(14),
    term: T.IMM,
    lines: [line(P.crm, 5, V.std)],
    path: [],
  });
  addSubscription({
    ...sales,
    customerId: cust.peak,
    createdAt: daysFromToday(0),
    plan: plan.CRM_M,
    status: "QUOTATION",
    start: daysFromToday(7),
    term: T.IMM,
    lines: [line(P.crm, 3, V.odoo)],
    validUntil: daysFromToday(14),
    path: PATH_QUOTE,
  });
  addSubscription({
    ...sales,
    customerId: cust.sunrise,
    createdAt: backdate(daysFromToday(-20)),
    plan: plan.ACC_M,
    status: "QUOTATION",
    start: daysFromToday(7),
    term: T.D15,
    lines: [line(P.accounting, 1)],
    validUntil: daysFromToday(-10),
    path: PATH_QUOTE,
  });
  addSubscription({
    ...sales,
    customerId: cust.bluemango,
    createdAt: daysFromToday(0),
    plan: plan.DAY_P,
    status: "QUOTATION",
    start: daysFromToday(1),
    term: T.IMM,
    lines: [line(P.storage, 1)],
    validUntil: daysFromToday(7),
    path: PATH_QUOTE,
  });

  // Confirmed, waiting for the start date.
  addSubscription({
    ...sales,
    customerId: cust.harbor,
    createdAt: daysFromToday(-3),
    plan: plan.ACC_M,
    status: "CONFIRMED",
    start: daysFromToday(5),
    term: T.D15,
    lines: [line(P.accounting, 1)],
    path: PATH_CONFIRMED,
  });
  addSubscription({
    ...sales,
    customerId: cust.lumen,
    createdAt: daysFromToday(-2),
    plan: plan.CRM_M,
    status: "CONFIRMED",
    start: daysFromToday(2),
    term: T.IMM,
    lines: [line(P.crm, 4, V.std)],
    path: PATH_CONFIRMED,
  });

  // Active. Some are due for billing today (periods already invoiced up to today).
  addSubscription({
    ...sales,
    customerId: cust.orchid,
    createdAt: backdate(dueToday("MONTHLY", 3)),
    plan: plan.CRM_M,
    status: "ACTIVE",
    start: dueToday("MONTHLY", 3),
    term: T.IMM,
    lines: [line(P.crm, 6, V.odoo), line(P.support, 1)],
    periodsBilled: 3,
    isPaid: () => true,
    path: PATH_ACTIVE,
  });
  addSubscription({
    ...sales,
    customerId: cust.metro,
    createdAt: backdate(dueToday("MONTHLY", 2)),
    plan: plan.ACC_M,
    status: "ACTIVE",
    start: dueToday("MONTHLY", 2),
    term: T.D30,
    lines: [line(P.accounting, 12)],
    discounts: [D.volume], // 12 seats qualifies for 10% while the rule is valid
    periodsBilled: 2,
    isPaid: () => true,
    path: PATH_ACTIVE,
  });
  addSubscription({
    ...sales,
    customerId: cust.quantum,
    createdAt: TODAY,
    plan: plan.CRM_Y,
    status: "ACTIVE",
    start: TODAY,
    term: T.IMM,
    lines: [line(P.crm, 6, V.odoo), line(P.support, 1)],
    discounts: [D.supportOff], // expired last month: the first invoice (issued today) must not get it
    periodsBilled: 0, // first invoice is due on the start date
    path: PATH_ACTIVE,
  });
  addSubscription({
    ...sales,
    customerId: cust.greenleaf,
    createdAt: backdate(dueToday("MONTHLY", 2)),
    plan: plan.CRM_M,
    status: "ACTIVE",
    start: dueToday("MONTHLY", 2),
    term: T.IMM,
    lines: [line(P.crm, 2, V.std)],
    discounts: [D.flat], // one-time welcome discount: applies to the first invoice only
    periodsBilled: 2,
    isPaid: () => true,
    path: PATH_ACTIVE,
  });
  addSubscription({
    ...sales,
    customerId: cust.delta,
    createdAt: backdate(dueToday("MONTHLY", 4)),
    plan: plan.CRM_M,
    status: "ACTIVE",
    start: dueToday("MONTHLY", 4),
    term: T.IMM,
    lines: [line(P.crm, 10, V.odoo)],
    periodsBilled: 4,
    isPaid: (i) => i < 1, // three invoices overdue
    path: PATH_ACTIVE,
  });
  addSubscription({
    ...sales,
    customerId: cust.riverside,
    createdAt: backdate(monthsAgo(3)),
    plan: plan.ACC_M,
    status: "ACTIVE",
    start: monthsAgo(3),
    term: T.D15,
    lines: [line(P.accounting, 1)],
    periodsBilled: 3,
    isPaid: (i) => i < 1,
    partialIndex: 1, // one invoice part-paid
    path: PATH_ACTIVE,
  });
  addSubscription({
    ...sales,
    customerId: cust.summit,
    createdAt: backdate(dueToday("MONTHLY", 5)),
    plan: plan.CRM_M,
    status: "ACTIVE",
    start: dueToday("MONTHLY", 5),
    term: T.D15,
    lines: [line(P.crm, 3, V.std)],
    periodsBilled: 5,
    isPaid: () => true,
    path: PATH_ACTIVE,
  });

  // Paused and closed.
  addSubscription({
    ...sales,
    customerId: cust.willow,
    createdAt: backdate(monthsAgo(3)),
    plan: plan.CRM_M,
    status: "PAUSED",
    start: monthsAgo(3),
    term: T.IMM,
    lines: [line(P.crm, 2, V.odoo)],
    periodsBilled: 2,
    isPaid: () => true,
    pausedAt: daysFromToday(-10),
    path: PATH_PAUSED,
  });
  addSubscription({
    ...sales,
    customerId: cust.oakridge,
    createdAt: backdate(monthsAgo(4)),
    plan: plan.CRM_M,
    status: "CLOSED",
    start: monthsAgo(4),
    term: T.IMM,
    lines: [line(P.crm, 4, V.std)],
    periodsBilled: 2,
    isPaid: () => true,
    closedAt: daysFromToday(-20),
    closeReason: "Closed by customer",
    path: PATH_CLOSED,
  });
  addSubscription({
    ...sales,
    customerId: cust.tidewater,
    createdAt: daysFromToday(-14),
    plan: plan.TRIAL_W,
    status: "CLOSED",
    start: daysFromToday(-14),
    term: T.IMM,
    lines: [line(P.storage, 1)],
    closedAt: daysFromToday(-12),
    closeReason: "Cancelled quotation",
    path: [...PATH_QUOTE, "CLOSED"],
  });
}

// ---------------------------------------------------------------------------
// Generated customers (SEED_SCALE)
// ---------------------------------------------------------------------------

function addGeneratedCustomers(count: number, cat: Awaited<ReturnType<typeof createCatalog>>) {
  const { plan, term, products: P, variants: V } = cat;
  const terms = [term.IMM, term.D15, term.D30];

  for (let i = 0; i < count; i++) {
    const customerId = randomUUID();
    const company = faker.company.name();
    batch.customers.push({
      id: customerId,
      name: company,
      email: `buyer${i + 1}@seed.brightloop.test`,
      company,
      address: faker.location.streetAddress({ useFullAddress: true }),
      phone: faker.phone.number(),
    });

    const monthsBack = faker.number.int({ min: 1, max: 12 });
    const start = monthsAgo(monthsBack);
    const useAccounting = faker.number.float({ min: 0, max: 1 }) < 0.4;
    const lines: LineInput[] = useAccounting
      ? [line(P.accounting, faker.number.int({ min: 1, max: 5 }))]
      : [
          line(
            P.crm,
            faker.number.int({ min: 1, max: 25 }),
            faker.helpers.arrayElement([V.odoo, V.std]),
          ),
        ];
    if (faker.number.float({ min: 0, max: 1 }) < 0.5) {
      lines.push(line(P.storage, faker.number.int({ min: 1, max: 3 })));
    }

    // Number of monthly periods that have started by today.
    let periodsBilled = 0;
    while (periodStart(start, "MONTHLY", periodsBilled) <= TODAY) periodsBilled += 1;

    addSubscription({
      customerId,
      createdAt: start,
      plan: useAccounting ? plan.ACC_M : plan.CRM_M,
      status: "ACTIVE",
      start,
      term: faker.helpers.arrayElement(terms),
      lines,
      periodsBilled,
      isPaid: () => faker.number.float({ min: 0, max: 1 }) < 0.8,
    });
  }
}

// ---------------------------------------------------------------------------
// Writing the batches
// ---------------------------------------------------------------------------

async function insertChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await insert(rows.slice(i, i + CHUNK));
  }
}

async function flush(): Promise<void> {
  await insertChunks(batch.customers, (rows) => prisma.customer.createMany({ data: rows }));
  await insertChunks(batch.subscriptions, (rows) => prisma.subscription.createMany({ data: rows }));
  await insertChunks(batch.subscriptionLines, (rows) => prisma.subscriptionLine.createMany({ data: rows }));
  await insertChunks(batch.subscriptionDiscounts, (rows) =>
    prisma.subscriptionDiscount.createMany({ data: rows }),
  );
  await insertChunks(batch.invoices, (rows) => prisma.invoice.createMany({ data: rows }));
  await insertChunks(batch.invoiceLines, (rows) => prisma.invoiceLine.createMany({ data: rows }));
  await insertChunks(batch.payments, (rows) => prisma.payment.createMany({ data: rows }));
  await insertChunks(batch.redemptions, (rows) => prisma.discountRedemption.createMany({ data: rows }));
  await insertChunks(batch.activities, (rows) => prisma.activity.createMany({ data: rows }));
}

/** Sequence.next holds the next number to issue, so it is the count already used plus one. */
async function syncSequences(): Promise<void> {
  const subNext = subCounter.n + 1;
  await prisma.sequence.upsert({
    where: { key: "SUB" },
    update: { next: subNext },
    create: { key: "SUB", next: subNext },
  });
  for (const [year, count] of invoiceCounters) {
    const key = `INV-${year}`;
    await prisma.sequence.upsert({
      where: { key },
      update: { next: count + 1 },
      create: { key, next: count + 1 },
    });
  }
}

/**
 * The seed wipes every table, so it refuses to run against production (NODE_ENV, Vercel or a Neon host)
 * unless ALLOW_DEMO_SEED=true is set explicitly. Called first in main(), before any delete.
 */
function assertDemoSeedAllowed(): void {
  if (process.env.ALLOW_DEMO_SEED === "true") return;
  let host = "";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    // Missing or unparseable URL: the host check simply does not match.
  }
  const production =
    process.env.NODE_ENV === "production" || process.env.VERCEL !== undefined || host.endsWith("neon.tech");
  if (production) {
    console.error("Refusing to wipe a production database. Set ALLOW_DEMO_SEED=true to force.");
    process.exit(1);
  }
}

async function main(): Promise<void> {
  assertDemoSeedAllowed();
  faker.seed(20261031);
  console.log("Seeding Brightloop demo data...");

  await wipe();
  const { admin, staff, customer } = await createUsers();
  const cat = await createCatalog(admin.id);
  const cust = await createNamedCustomers(customer.id);

  addNamedSubscriptions(cust, cat, staff.id);
  addGeneratedCustomers(SCALE, cat);

  // Discount usage is written after the invoices that consumed it.
  for (const [id, count] of usage) {
    await prisma.discountRule.update({ where: { id }, data: { usageCount: count } });
  }

  await flush();
  await syncSequences();

  const invoiceTotal = batch.invoices.length;
  console.log(
    [
      "Seed complete:",
      `${batch.customers.length} customers (${NAMED_CUSTOMERS.length} named, ${SCALE} generated)`,
      `${batch.subscriptions.length} subscriptions`,
      `${invoiceTotal} invoices`,
      `${batch.payments.length} payments`,
      `${batch.subscriptionLines.length + batch.invoiceLines.length} lines`,
    ].join(" · "),
  );
  console.log("Demo logins: admin@brightloop.test, staff@brightloop.test, customer@brightloop.test");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

