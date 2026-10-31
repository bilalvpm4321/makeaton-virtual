"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { parseDateInput } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { toMinor } from "@/lib/money";
import { checked, fail, isPrismaError, num, optionalText, text } from "./_form";

const planSchema = z
  .object({
    name: z.string().min(1, "Name is required.").max(120, "Name must be 120 characters or fewer."),
    description: z.string().max(2000, "Description is too long.").nullable(),
    productId: z.string().nullable(),
    price: z.number({ error: "Enter a valid price." }).min(0, "Price cannot be negative."),
    billingPeriod: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"], { error: "Choose a billing period." }),
    minQuantity: z
      .number({ error: "Enter a valid minimum quantity." })
      .int("Minimum quantity must be a whole number.")
      .min(1, "Minimum quantity must be at least 1."),
    availableFrom: z.date().nullable(),
    availableUntil: z.date().nullable(),
    termLength: z
      .number({ error: "Term must be a whole number of periods." })
      .int("Term must be a whole number of periods.")
      .min(1, "Term must be at least 1 period.")
      .nullable(),
    autoClose: z.boolean(),
    closable: z.boolean(),
    pausable: z.boolean(),
    renewable: z.boolean(),
    isPublic: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.availableFrom && v.availableUntil && v.availableUntil < v.availableFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["availableUntil"],
        message: "Available until must be on or after available from.",
      });
    }
  });

type PlanInput = z.infer<typeof planSchema>;

function readPlan(fd: FormData) {
  return {
    name: text(fd, "name"),
    description: optionalText(fd, "description"),
    productId: optionalText(fd, "productId"),
    price: num(fd, "price"),
    billingPeriod: text(fd, "billingPeriod"),
    minQuantity: num(fd, "minQuantity") ?? 1,
    availableFrom: parseDateInput(text(fd, "availableFrom")),
    availableUntil: parseDateInput(text(fd, "availableUntil")),
    termLength: num(fd, "termLength") ?? null,
    autoClose: checked(fd, "autoClose"),
    closable: checked(fd, "closable"),
    pausable: checked(fd, "pausable"),
    renewable: checked(fd, "renewable"),
    isPublic: checked(fd, "isPublic"),
    isActive: checked(fd, "isActive"),
  };
}

function planData(d: PlanInput) {
  return {
    name: d.name,
    description: d.description,
    productId: d.productId,
    price: toMinor(d.price),
    billingPeriod: d.billingPeriod,
    minQuantity: d.minQuantity,
    availableFrom: d.availableFrom,
    availableUntil: d.availableUntil,
    termLength: d.termLength,
    autoClose: d.autoClose,
    closable: d.closable,
    pausable: d.pausable,
    renewable: d.renewable,
    isPublic: d.isPublic,
    isActive: d.isActive,
  };
}

export async function createPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = planSchema.safeParse(readPlan(formData));
  if (!parsed.success) return fail(parsed.error);

  let plan: { id: string };
  try {
    plan = await prisma.plan.create({ data: planData(parsed.data) });
  } catch (e) {
    if (isPrismaError(e, "P2003")) return { error: "Selected product not found." };
    throw e;
  }
  revalidatePath("/catalog/plans");
  redirect(`/catalog/plans/${plan.id}`);
}

export async function updatePlan(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = planSchema.safeParse(readPlan(formData));
  if (!parsed.success) return fail(parsed.error);

  try {
    await prisma.plan.update({ where: { id }, data: planData(parsed.data) });
  } catch (e) {
    if (isPrismaError(e, "P2025")) return { error: "Plan not found." };
    if (isPrismaError(e, "P2003")) return { error: "Selected product not found." };
    throw e;
  }
  revalidatePath("/catalog/plans");
  revalidatePath(`/catalog/plans/${id}`);
  return { success: "Plan saved." };
}
