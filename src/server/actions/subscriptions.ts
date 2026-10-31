"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { expiryFor } from "@/lib/billing/period";
import { prisma } from "@/lib/db";
import { addDays, formatDate, parseDateInput, today } from "@/lib/dates";
import { toMinor } from "@/lib/money";
import { nextSubscriptionNumber } from "@/lib/sequence";
import { recomputeRecurringTotal, transitionSubscription } from "@/lib/subscriptions/service";
import { ACTION_LABELS } from "@/lib/subscriptions/state";

class ActionError extends Error {}

const SUB_ACTIONS = ["SEND_QUOTE", "CONFIRM", "ACTIVATE", "PAUSE", "RESUME", "CLOSE", "RENEW", "CANCEL"] as const;

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    errors[String(issue.path[0] ?? "form")] ??= issue.message;
  }
  return errors;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

type PricingPlan = { productId: string | null; price: number };
type PricingProduct = { id: string; name: string; salesPrice: number; defaultTaxId: string | null };
type PricingVariant = { attribute: string; value: string; extraPrice: number } | null;

/** PLAN.md §6.3: the plan price for the plan's own product, catalogue price otherwise, plus the variant extra. */
function defaultUnitPrice(plan: PricingPlan, product: PricingProduct, variant: PricingVariant): number {
  const base = product.id === plan.productId ? plan.price : product.salesPrice;
  return base + (variant?.extraPrice ?? 0);
}

function describeLine(product: { name: string }, variant: PricingVariant): string {
  return variant ? `${product.name} — ${variant.attribute}: ${variant.value}` : product.name;
}

/** The plan's main line is the plan's own product without a variant. Its quantity has a floor. */
function isMainLine(line: { productId: string; variantId: string | null }, plan: { productId: string | null }): boolean {
  return plan.productId !== null && line.productId === plan.productId && line.variantId === null;
}

async function loadEditableSubscription(tx: Prisma.TransactionClient, id: string) {
  const sub = await tx.subscription.findUnique({
    where: { id },
    include: { plan: { select: { productId: true, price: true, minQuantity: true } } },
  });
  if (!sub) throw new ActionError("Subscription not found.");
  if (sub.status !== "DRAFT" && sub.status !== "QUOTATION") {
    throw new ActionError("Lines can only change while the subscription is a draft or a quotation.");
  }
  return sub;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createSchema = z.object({
  customerId: z.string().min(1, "Choose a customer."),
  planId: z.string().min(1, "Choose a plan."),
  paymentTermId: z.string().min(1, "Choose a payment term."),
  startDate: z.string().min(1, "Choose a start date."),
  notes: z.string().max(2000, "Keep notes under 2000 characters."),
  templateId: z.string(),
});

export async function createSubscription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("subscriptions.manage");

  const parsed = createSchema.safeParse({
    customerId: str(formData, "customerId"),
    planId: str(formData, "planId"),
    paymentTermId: str(formData, "paymentTermId"),
    startDate: str(formData, "startDate"),
    notes: str(formData, "notes"),
    templateId: str(formData, "templateId"),
  });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const input = parsed.data;
  const startDate = parseDateInput(input.startDate);
  if (!startDate) {
    return { error: "Check the highlighted fields.", fieldErrors: { startDate: "Enter a valid start date." } };
  }
  const templateId = input.templateId || null;
  const notes = input.notes || null;

  let subscriptionId: string;
  try {
    subscriptionId = await prisma.$transaction(async (tx) => {
      const plan = await tx.plan.findUnique({ where: { id: input.planId }, include: { product: true } });
      if (!plan || !plan.isActive) throw new ActionError("This plan is not available.");
      if (plan.availableFrom && startDate < plan.availableFrom) {
        throw new ActionError(`This plan can be sold from ${formatDate(plan.availableFrom)}.`);
      }
      if (plan.availableUntil && startDate > plan.availableUntil) {
        throw new ActionError(`This plan is not sold after ${formatDate(plan.availableUntil)}.`);
      }

      const customer = await tx.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
      if (!customer) throw new ActionError("Choose an existing customer.");
      const paymentTerm = await tx.paymentTerm.findUnique({ where: { id: input.paymentTermId }, select: { id: true } });
      if (!paymentTerm) throw new ActionError("Choose a payment term.");

      const template = templateId
        ? await tx.quotationTemplate.findUnique({
            where: { id: templateId },
            include: { lines: { include: { product: true, variant: true } } },
          })
        : null;
      if (templateId && !template) throw new ActionError("That quotation template no longer exists.");

      const termPeriods = plan.termLength ?? null;
      const created = await tx.subscription.create({
        data: {
          number: await nextSubscriptionNumber(tx),
          customerId: customer.id,
          planId: plan.id,
          status: "DRAFT",
          startDate,
          termPeriods,
          expiryDate: expiryFor(startDate, plan.billingPeriod, termPeriods),
          validUntil: template ? addDays(today(), template.validityDays) : null,
          paymentTermId: paymentTerm.id,
          salespersonId: user.id,
          templateId: template?.id ?? null,
          notes,
        },
        select: { id: true },
      });

      // Template lines are copied; otherwise the plan's main product becomes one line at minQuantity.
      const lines: Prisma.SubscriptionLineCreateManyInput[] = template
        ? template.lines.map((l) => ({
            subscriptionId: created.id,
            productId: l.productId,
            variantId: l.variantId,
            description: describeLine(l.product, l.variant),
            quantity: isMainLine(l, plan) ? Math.max(l.quantity, plan.minQuantity) : Math.max(1, l.quantity),
            unitPrice: l.unitPrice ?? defaultUnitPrice(plan, l.product, l.variant),
            taxId: l.taxId ?? l.product.defaultTaxId,
          }))
        : plan.product
          ? [
              {
                subscriptionId: created.id,
                productId: plan.product.id,
                variantId: null,
                description: plan.product.name,
                quantity: Math.max(1, plan.minQuantity),
                unitPrice: defaultUnitPrice(plan, plan.product, null),
                taxId: plan.product.defaultTaxId,
              },
            ]
          : [];

      if (lines.length > 0) await tx.subscriptionLine.createMany({ data: lines });
      await recomputeRecurringTotal(tx, created.id);
      await logActivity(tx, {
        entityType: "subscription",
        entityId: created.id,
        message: "Subscription created",
        userId: user.id,
      });
      return created.id;
    });
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message };
    throw e;
  }

  revalidatePath("/subscriptions");
  redirect(`/subscriptions/${subscriptionId}`);
}

// ---------------------------------------------------------------------------
// Lifecycle transitions (state machine lives in lib/subscriptions/service.ts)
// ---------------------------------------------------------------------------

const transitionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(SUB_ACTIONS),
  reason: z.string().max(300, "Keep the reason under 300 characters."),
});

export async function transitionSubscriptionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("subscriptions.manage");

  const parsed = transitionSchema.safeParse({
    id: str(formData, "id"),
    action: str(formData, "action"),
    reason: str(formData, "reason"),
  });
  if (!parsed.success) return { error: "That action is not valid." };
  const { id, action, reason } = parsed.data;

  if (action === "CLOSE" && reason === "") {
    return { error: "Enter a reason to close this subscription.", fieldErrors: { reason: "Required." } };
  }

  try {
    await transitionSubscription(id, action, { id: user.id, role: user.role }, {
      reason: action === "CLOSE" ? reason : undefined,
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }

  revalidatePath(`/subscriptions/${id}`);
  revalidatePath("/subscriptions");
  return { success: `${ACTION_LABELS[action]} done.` };
}

// ---------------------------------------------------------------------------
// Lines (DRAFT and QUOTATION only)
// ---------------------------------------------------------------------------

const addLineSchema = z.object({
  subscriptionId: z.string().min(1),
  productId: z.string().min(1, "Choose a product."),
  variantId: z.string(),
  quantity: z.coerce.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1."),
  unitPrice: z
    .string()
    .refine((v) => {
      if (v === "") return true;
      const n = Number(v.replace(/,/g, ""));
      return Number.isFinite(n) && n >= 0;
    }, "Enter a valid unit price."),
  taxId: z.string(),
});

export async function addSubscriptionLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("subscriptions.manage");

  const parsed = addLineSchema.safeParse({
    subscriptionId: str(formData, "subscriptionId"),
    productId: str(formData, "productId"),
    variantId: str(formData, "variantId"),
    quantity: str(formData, "quantity") || "1",
    unitPrice: str(formData, "unitPrice"),
    taxId: str(formData, "taxId"),
  });
  if (!parsed.success) {
    return { error: "Check the line details.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const input = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const sub = await loadEditableSubscription(tx, input.subscriptionId);
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: { id: true, name: true, salesPrice: true, defaultTaxId: true },
      });
      if (!product) throw new ActionError("Choose a product.");

      const variant = input.variantId
        ? await tx.productVariant.findUnique({
            where: { id: input.variantId },
            select: { productId: true, attribute: true, value: true, extraPrice: true },
          })
        : null;
      if (input.variantId && (!variant || variant.productId !== product.id)) {
        throw new ActionError("That variant does not belong to the chosen product.");
      }

      if (input.taxId) {
        const tax = await tx.tax.findUnique({ where: { id: input.taxId }, select: { id: true } });
        if (!tax) throw new ActionError("Choose a valid tax.");
      }

      const unitPrice = input.unitPrice ? toMinor(input.unitPrice) : defaultUnitPrice(sub.plan, product, variant);
      const taxId = input.taxId || product.defaultTaxId;
      const description = describeLine(product, variant);

      await tx.subscriptionLine.create({
        data: {
          subscriptionId: sub.id,
          productId: product.id,
          variantId: variant ? input.variantId : null,
          description,
          quantity: input.quantity,
          unitPrice,
          taxId,
        },
      });
      await recomputeRecurringTotal(tx, sub.id);
      await logActivity(tx, {
        entityType: "subscription",
        entityId: sub.id,
        message: `Line added: ${description} × ${input.quantity}`,
        userId: user.id,
      });
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }

  revalidatePath(`/subscriptions/${input.subscriptionId}`);
  return { success: "Line added." };
}

const lineRefSchema = z.object({
  subscriptionId: z.string().min(1),
  lineId: z.string().min(1, "Line not found."),
});

export async function removeSubscriptionLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("subscriptions.manage");

  const parsed = lineRefSchema.safeParse({
    subscriptionId: str(formData, "subscriptionId"),
    lineId: str(formData, "lineId"),
  });
  if (!parsed.success) return { error: "Line not found." };
  const { subscriptionId, lineId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const sub = await loadEditableSubscription(tx, subscriptionId);
      const line = await tx.subscriptionLine.findFirst({ where: { id: lineId, subscriptionId } });
      if (!line) throw new ActionError("Line not found.");
      if (isMainLine(line, sub.plan)) {
        throw new ActionError(
          `The main plan line must keep at least ${sub.plan.minQuantity} unit(s) and cannot be removed.`,
        );
      }
      await tx.subscriptionLine.delete({ where: { id: line.id } });
      await recomputeRecurringTotal(tx, subscriptionId);
      await logActivity(tx, {
        entityType: "subscription",
        entityId: subscriptionId,
        message: `Line removed: ${line.description}`,
        userId: user.id,
      });
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }

  revalidatePath(`/subscriptions/${subscriptionId}`);
  return { success: "Line removed." };
}

const quantitySchema = z.object({
  subscriptionId: z.string().min(1),
  lineId: z.string().min(1, "Line not found."),
  quantity: z.coerce.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1."),
});

export async function updateSubscriptionLineQuantity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("subscriptions.manage");

  const parsed = quantitySchema.safeParse({
    subscriptionId: str(formData, "subscriptionId"),
    lineId: str(formData, "lineId"),
    quantity: str(formData, "quantity"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the quantity.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const { subscriptionId, lineId, quantity } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const sub = await loadEditableSubscription(tx, subscriptionId);
      const line = await tx.subscriptionLine.findFirst({ where: { id: lineId, subscriptionId } });
      if (!line) throw new ActionError("Line not found.");
      if (isMainLine(line, sub.plan) && quantity < sub.plan.minQuantity) {
        throw new ActionError(`The main plan line must keep at least ${sub.plan.minQuantity} unit(s).`);
      }
      await tx.subscriptionLine.update({ where: { id: line.id }, data: { quantity } });
      await recomputeRecurringTotal(tx, subscriptionId);
      await logActivity(tx, {
        entityType: "subscription",
        entityId: subscriptionId,
        message: `Quantity changed: ${line.description} → ${quantity}`,
        userId: user.id,
      });
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }

  revalidatePath(`/subscriptions/${subscriptionId}`);
  return { success: "Quantity updated." };
}

// ---------------------------------------------------------------------------
// Discounts attached to a subscription (applied to every next invoice)
// ---------------------------------------------------------------------------

const discountSchema = z.object({
  subscriptionId: z.string().min(1),
  discountId: z.string().min(1, "Choose a discount."),
});

export async function attachDiscount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("discounts.attach");

  const parsed = discountSchema.safeParse({
    subscriptionId: str(formData, "subscriptionId"),
    discountId: str(formData, "discountId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose a discount." };
  const { subscriptionId, discountId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { id: subscriptionId }, select: { status: true } });
      if (!sub) throw new ActionError("Subscription not found.");
      if (sub.status === "CLOSED") throw new ActionError("Closed subscriptions cannot take new discounts.");

      const rule = await tx.discountRule.findUnique({ where: { id: discountId }, select: { name: true, isActive: true } });
      if (!rule || !rule.isActive) throw new ActionError("This discount is not active.");

      await tx.subscriptionDiscount.create({ data: { subscriptionId, discountId } });
      await logActivity(tx, {
        entityType: "subscription",
        entityId: subscriptionId,
        message: `Discount attached: ${rule.name}`,
        userId: user.id,
      });
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "This discount is already attached." };
    return { error: errorMessage(e) };
  }

  revalidatePath(`/subscriptions/${subscriptionId}`);
  return { success: "Discount attached." };
}

export async function detachDiscount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("discounts.attach");

  const parsed = discountSchema.safeParse({
    subscriptionId: str(formData, "subscriptionId"),
    discountId: str(formData, "discountId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose a discount." };
  const { subscriptionId, discountId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const rule = await tx.discountRule.findUnique({ where: { id: discountId }, select: { name: true } });
      await tx.subscriptionDiscount.deleteMany({ where: { subscriptionId, discountId } });
      await logActivity(tx, {
        entityType: "subscription",
        entityId: subscriptionId,
        message: `Discount detached: ${rule?.name ?? discountId}`,
        userId: user.id,
      });
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }

  revalidatePath(`/subscriptions/${subscriptionId}`);
  return { success: "Discount detached." };
}
