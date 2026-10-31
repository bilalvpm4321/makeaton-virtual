"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { toMinor } from "@/lib/money";
import { fail, isPrismaError, num, optionalText, text } from "./_form";

const templateSchema = z.object({
  name: z.string().min(1, "Name is required.").max(120, "Name must be 120 characters or fewer."),
  validityDays: z
    .number({ error: "Enter a valid validity in days." })
    .int("Validity must be a whole number of days.")
    .min(1, "Validity must be at least 1 day."),
  planId: z.string().min(1, "Choose a plan."),
  paymentTermId: z.string().nullable(),
  notes: z.string().max(2000, "Notes are too long.").nullable(),
});

const lineSchema = z.object({
  productId: z.string().min(1, "Choose a product."),
  variantId: z.string().nullable(),
  quantity: z
    .number({ error: "Enter a valid quantity." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1."),
  unitPrice: z.number({ error: "Enter a valid unit price." }).min(0, "Unit price cannot be negative.").nullable(),
  taxId: z.string().nullable(),
});

function readTemplate(fd: FormData) {
  return {
    name: text(fd, "name"),
    validityDays: num(fd, "validityDays") ?? 30,
    planId: text(fd, "planId"),
    paymentTermId: optionalText(fd, "paymentTermId"),
    notes: optionalText(fd, "notes"),
  };
}

export async function createTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = templateSchema.safeParse(readTemplate(formData));
  if (!parsed.success) return fail(parsed.error);

  let template: { id: string };
  try {
    template = await prisma.quotationTemplate.create({ data: parsed.data });
  } catch (e) {
    if (isPrismaError(e, "P2003")) return { error: "Selected plan or payment term not found." };
    throw e;
  }
  revalidatePath("/catalog/templates");
  redirect(`/catalog/templates/${template.id}`);
}

export async function updateTemplate(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = templateSchema.safeParse(readTemplate(formData));
  if (!parsed.success) return fail(parsed.error);

  try {
    await prisma.quotationTemplate.update({ where: { id }, data: parsed.data });
  } catch (e) {
    if (isPrismaError(e, "P2025")) return { error: "Template not found." };
    if (isPrismaError(e, "P2003")) return { error: "Selected plan or payment term not found." };
    throw e;
  }
  revalidatePath("/catalog/templates");
  revalidatePath(`/catalog/templates/${id}`);
  return { success: "Template saved." };
}

export async function addTemplateLine(templateId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = lineSchema.safeParse({
    productId: text(formData, "productId"),
    variantId: optionalText(formData, "variantId"),
    quantity: num(formData, "quantity") ?? 1,
    unitPrice: num(formData, "unitPrice") ?? null,
    taxId: optionalText(formData, "taxId"),
  });
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;

  if (d.variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: d.variantId },
      select: { productId: true },
    });
    if (!variant || variant.productId !== d.productId) {
      return { error: "The selected variant does not belong to that product." };
    }
  }

  try {
    await prisma.quotationTemplateLine.create({
      data: {
        templateId,
        productId: d.productId,
        variantId: d.variantId,
        quantity: d.quantity,
        unitPrice: d.unitPrice === null ? null : toMinor(d.unitPrice),
        taxId: d.taxId,
      },
    });
  } catch (e) {
    if (isPrismaError(e, "P2003")) return { error: "Template or product not found." };
    throw e;
  }
  revalidatePath(`/catalog/templates/${templateId}`);
  return { success: "Line added." };
}

export async function removeTemplateLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const id = text(formData, "id");

  const line = await prisma.quotationTemplateLine.findUnique({ where: { id }, select: { templateId: true } });
  if (!line) return { error: "Line not found." };

  await prisma.quotationTemplateLine.delete({ where: { id } });
  revalidatePath(`/catalog/templates/${line.templateId}`);
  return { success: "Line removed." };
}
