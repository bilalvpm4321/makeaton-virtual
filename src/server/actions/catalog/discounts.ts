"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { parseDateInput } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { toMinor } from "@/lib/money";
import { checked, fail, isPrismaError, num, optionalText, text, texts } from "./_form";

const discountSchema = z
  .object({
    name: z.string().min(1, "Name is required.").max(120, "Name must be 120 characters or fewer."),
    code: z
      .string()
      .max(32, "Code must be 32 characters or fewer.")
      .regex(/^[A-Z0-9_-]+$/, "Code can only use letters, numbers, dashes and underscores.")
      .nullable(),
    type: z.enum(["PERCENT", "FIXED"], { error: "Choose a discount type." }),
    value: z.number({ error: "Enter a valid value." }).gt(0, "Value must be greater than 0."),
    scope: z.enum(["SUBSCRIPTION", "PRODUCTS"], { error: "Choose a scope." }),
    productIds: z.array(z.string()),
    minPurchase: z.number({ error: "Enter a valid minimum purchase." }).min(0, "Minimum purchase cannot be negative."),
    minQuantity: z
      .number({ error: "Enter a valid minimum quantity." })
      .int("Minimum quantity must be a whole number.")
      .min(0, "Minimum quantity cannot be negative."),
    startDate: z.date().nullable(),
    endDate: z.date().nullable(),
    usageLimit: z
      .number({ error: "Enter a valid usage limit." })
      .int("Usage limit must be a whole number.")
      .min(1, "Usage limit must be at least 1.")
      .nullable(),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "PERCENT" && v.value > 100) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "A percentage cannot exceed 100." });
    }
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date." });
    }
    if (v.scope === "PRODUCTS" && v.productIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["productIds"], message: "Select at least one product for this scope." });
    }
  });

type DiscountInput = z.infer<typeof discountSchema>;

function readDiscount(fd: FormData) {
  return {
    name: text(fd, "name"),
    code: optionalText(fd, "code")?.toUpperCase() ?? null,
    type: text(fd, "type"),
    value: num(fd, "value"),
    scope: text(fd, "scope"),
    productIds: texts(fd, "productIds"),
    minPurchase: num(fd, "minPurchase") ?? 0,
    minQuantity: num(fd, "minQuantity") ?? 0,
    startDate: parseDateInput(text(fd, "startDate")),
    endDate: parseDateInput(text(fd, "endDate")),
    usageLimit: num(fd, "usageLimit") ?? null,
    isActive: checked(fd, "isActive"),
  };
}

/** PERCENT is stored in basis points, FIXED in minor units. */
function discountData(d: DiscountInput) {
  return {
    name: d.name,
    code: d.code,
    type: d.type,
    value: d.type === "PERCENT" ? Math.round(d.value * 100) : toMinor(d.value),
    scope: d.scope,
    minPurchase: toMinor(d.minPurchase),
    minQuantity: d.minQuantity,
    startDate: d.startDate,
    endDate: d.endDate,
    usageLimit: d.usageLimit,
    isActive: d.isActive,
  };
}

export async function createDiscount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("discounts.manage");
  const parsed = discountSchema.safeParse(readDiscount(formData));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;

  let rule: { id: string };
  try {
    rule = await prisma.discountRule.create({
      data: {
        ...discountData(d),
        createdById: user.id,
        products: d.scope === "PRODUCTS" ? { connect: d.productIds.map((id) => ({ id })) } : undefined,
      },
    });
  } catch (e) {
    if (isPrismaError(e, "P2002")) return { error: "That code is already in use." };
    if (isPrismaError(e, "P2003")) return { error: "One of the selected products no longer exists." };
    throw e;
  }
  revalidatePath("/catalog/discounts");
  redirect(`/catalog/discounts/${rule.id}`);
}

export async function updateDiscount(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("discounts.manage");
  const parsed = discountSchema.safeParse(readDiscount(formData));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;

  const current = await prisma.discountRule.findUnique({ where: { id }, select: { usageCount: true } });
  if (!current) return { error: "Discount not found." };
  if (d.usageLimit !== null && d.usageLimit < current.usageCount) {
    return { error: `Usage limit cannot be below the current usage (${current.usageCount}).` };
  }

  try {
    await prisma.discountRule.update({
      where: { id },
      data: {
        ...discountData(d),
        products: { set: d.scope === "PRODUCTS" ? d.productIds.map((pid) => ({ id: pid })) : [] },
      },
    });
  } catch (e) {
    if (isPrismaError(e, "P2002")) return { error: "That code is already in use." };
    if (isPrismaError(e, "P2003")) return { error: "One of the selected products no longer exists." };
    throw e;
  }
  revalidatePath("/catalog/discounts");
  revalidatePath(`/catalog/discounts/${id}`);
  return { success: "Discount saved." };
}
