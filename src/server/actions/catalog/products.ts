"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { toMinor } from "@/lib/money";
import { checked, fail, isPrismaError, num, optionalText, text } from "./_form";

const productSchema = z.object({
  name: z.string().min(1, "Name is required.").max(120, "Name must be 120 characters or fewer."),
  type: z.enum(["SERVICE", "GOODS"], { error: "Choose a product type." }),
  salesPrice: z.number({ error: "Enter a valid sales price." }).min(0, "Sales price cannot be negative."),
  costPrice: z.number({ error: "Enter a valid cost price." }).min(0, "Cost price cannot be negative.").default(0),
  notes: z.string().max(2000, "Notes are too long.").nullable(),
  defaultTaxId: z.string().nullable(),
  isActive: z.boolean(),
});

const variantSchema = z.object({
  attribute: z.string().min(1, "Attribute is required.").max(60, "Attribute must be 60 characters or fewer."),
  value: z.string().min(1, "Value is required.").max(120, "Value must be 120 characters or fewer."),
  extraPrice: z.number({ error: "Enter a valid extra price." }),
});

function readProduct(fd: FormData) {
  return {
    name: text(fd, "name"),
    type: text(fd, "type"),
    salesPrice: num(fd, "salesPrice"),
    costPrice: num(fd, "costPrice"),
    notes: optionalText(fd, "notes"),
    defaultTaxId: optionalText(fd, "defaultTaxId"),
    isActive: checked(fd, "isActive"),
  };
}

function productData(d: z.infer<typeof productSchema>) {
  return {
    name: d.name,
    type: d.type,
    salesPrice: toMinor(d.salesPrice),
    costPrice: toMinor(d.costPrice),
    notes: d.notes,
    defaultTaxId: d.defaultTaxId,
    isActive: d.isActive,
  };
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = productSchema.safeParse(readProduct(formData));
  if (!parsed.success) return fail(parsed.error);

  const product = await prisma.product.create({ data: productData(parsed.data) });
  revalidatePath("/catalog/products");
  redirect(`/catalog/products/${product.id}`);
}

export async function updateProduct(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = productSchema.safeParse(readProduct(formData));
  if (!parsed.success) return fail(parsed.error);

  try {
    await prisma.product.update({ where: { id }, data: productData(parsed.data) });
  } catch (e) {
    if (isPrismaError(e, "P2025")) return { error: "Product not found." };
    throw e;
  }
  revalidatePath("/catalog/products");
  revalidatePath(`/catalog/products/${id}`);
  return { success: "Product saved." };
}

export async function addVariant(productId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = variantSchema.safeParse({
    attribute: text(formData, "attribute"),
    value: text(formData, "value"),
    extraPrice: num(formData, "extraPrice") ?? 0,
  });
  if (!parsed.success) return fail(parsed.error);

  try {
    await prisma.productVariant.create({
      data: {
        productId,
        attribute: parsed.data.attribute,
        value: parsed.data.value,
        extraPrice: toMinor(parsed.data.extraPrice),
      },
    });
  } catch (e) {
    if (isPrismaError(e, "P2002")) return { error: "This product already has that attribute value." };
    if (isPrismaError(e, "P2003")) return { error: "Product not found." };
    throw e;
  }
  revalidatePath(`/catalog/products/${productId}`);
  return { success: "Variant added." };
}

/** Deletes an unused variant. A variant already on a subscription or template line is deactivated instead, so history keeps its label. */
export async function removeVariant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const id = text(formData, "id");

  const variant = await prisma.productVariant.findUnique({
    where: { id },
    select: {
      productId: true,
      _count: { select: { subscriptionLines: true, templateLines: true } },
    },
  });
  if (!variant) return { error: "Variant not found." };
  revalidatePath(`/catalog/products/${variant.productId}`);

  const inUse = variant._count.subscriptionLines + variant._count.templateLines > 0;
  if (inUse) {
    await prisma.productVariant.update({ where: { id }, data: { isActive: false } });
    return { success: "Variant is used by subscriptions or templates, so it was deactivated instead." };
  }

  await prisma.productVariant.delete({ where: { id } });
  return { success: "Variant removed." };
}
