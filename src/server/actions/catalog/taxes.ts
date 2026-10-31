"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { checked, fail, isPrismaError, num, text } from "./_form";

const taxSchema = z.object({
  name: z.string().min(1, "Name is required.").max(80, "Name must be 80 characters or fewer."),
  rate: z
    .number({ error: "Enter a valid rate." })
    .min(0, "Rate cannot be negative.")
    .max(100, "Rate cannot exceed 100%."),
  isActive: z.boolean(),
});

function readTax(fd: FormData) {
  return {
    name: text(fd, "name"),
    rate: num(fd, "rate"),
    isActive: checked(fd, "isActive"),
  };
}

/** Rate is entered in percent (18 or 12.5) and stored in basis points. */
function taxData(d: z.infer<typeof taxSchema>) {
  return { name: d.name, rateBps: Math.round(d.rate * 100), isActive: d.isActive };
}

export async function createTax(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = taxSchema.safeParse(readTax(formData));
  if (!parsed.success) return fail(parsed.error);

  await prisma.tax.create({ data: taxData(parsed.data) });
  revalidatePath("/catalog/taxes");
  return { success: "Tax created." };
}

export async function updateTax(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = taxSchema.safeParse(readTax(formData));
  if (!parsed.success) return fail(parsed.error);

  try {
    await prisma.tax.update({ where: { id }, data: taxData(parsed.data) });
  } catch (e) {
    if (isPrismaError(e, "P2025")) return { error: "Tax not found." };
    throw e;
  }
  revalidatePath("/catalog/taxes");
  return { success: "Tax saved." };
}

/** Only unused taxes can be deleted. Existing invoices keep their own snapshot, so deactivating is the safe alternative. */
export async function deleteTax(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const id = text(formData, "id");

  const tax = await prisma.tax.findUnique({
    where: { id },
    select: {
      _count: { select: { products: true, subscriptionLines: true, templateLines: true } },
    },
  });
  if (!tax) return { error: "Tax not found." };

  const { products, subscriptionLines, templateLines } = tax._count;
  if (products + subscriptionLines + templateLines > 0) {
    return {
      error: `This tax is in use by ${products} product(s) and ${subscriptionLines + templateLines} line(s). Deactivate it instead.`,
    };
  }

  try {
    await prisma.tax.delete({ where: { id } });
  } catch (e) {
    if (isPrismaError(e, "P2003")) return { error: "This tax is still in use. Deactivate it instead." };
    throw e;
  }
  revalidatePath("/catalog/taxes");
  return { success: "Tax deleted." };
}
