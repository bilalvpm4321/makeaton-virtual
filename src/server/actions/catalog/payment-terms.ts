"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { fail, isPrismaError, num, text } from "./_form";

const paymentTermSchema = z.object({
  name: z.string().min(1, "Name is required.").max(80, "Name must be 80 characters or fewer."),
  dueDays: z
    .number({ error: "Enter a valid number of due days." })
    .int("Due days must be a whole number.")
    .min(0, "Due days cannot be negative.")
    .max(3650, "Due days must be 3650 or fewer."),
});

function readPaymentTerm(fd: FormData) {
  return { name: text(fd, "name"), dueDays: num(fd, "dueDays") ?? 0 };
}

export async function createPaymentTerm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = paymentTermSchema.safeParse(readPaymentTerm(formData));
  if (!parsed.success) return fail(parsed.error);

  await prisma.paymentTerm.create({ data: parsed.data });
  revalidatePath("/catalog/payment-terms");
  return { success: "Payment term created." };
}

export async function updatePaymentTerm(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("catalog.manage");
  const parsed = paymentTermSchema.safeParse(readPaymentTerm(formData));
  if (!parsed.success) return fail(parsed.error);

  try {
    await prisma.paymentTerm.update({ where: { id }, data: parsed.data });
  } catch (e) {
    if (isPrismaError(e, "P2025")) return { error: "Payment term not found." };
    throw e;
  }
  revalidatePath("/catalog/payment-terms");
  return { success: "Payment term saved." };
}
