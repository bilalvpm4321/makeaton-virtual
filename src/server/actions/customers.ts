"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name.").max(120, "Keep the name under 120 characters."),
  email: z.string().trim().toLowerCase().regex(EMAIL_RE, "Enter a valid email address."),
  phone: z.string().trim().max(40, "Keep the phone under 40 characters."),
  company: z.string().trim().max(160, "Keep the company under 160 characters."),
  address: z.string().trim().max(500, "Keep the address under 500 characters."),
  taxId: z.string().trim().max(40, "Keep the tax ID under 40 characters."),
});

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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

const EMAIL_TAKEN: ActionState = {
  error: "Check the highlighted fields.",
  fieldErrors: { email: "A customer with this email already exists." },
};

function readCustomer(formData: FormData) {
  const parsed = customerSchema.safeParse({
    name: str(formData, "name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    company: str(formData, "company"),
    address: str(formData, "address"),
    taxId: str(formData, "taxId"),
  });
  if (!parsed.success) {
    return { ok: false as const, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const d = parsed.data;
  return {
    ok: true as const,
    data: {
      name: d.name,
      email: d.email,
      phone: d.phone || null,
      company: d.company || null,
      address: d.address || null,
      taxId: d.taxId || null,
    },
  };
}

export async function createCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("customers.manage");

  const input = readCustomer(formData);
  if (!input.ok) return { error: "Check the highlighted fields.", fieldErrors: input.fieldErrors };

  const taken = await prisma.customer.findUnique({ where: { email: input.data.email }, select: { id: true } });
  if (taken) return EMAIL_TAKEN;

  let id: string;
  try {
    const created = await prisma.customer.create({ data: input.data, select: { id: true } });
    id = created.id;
  } catch (e) {
    if (isUniqueViolation(e)) return EMAIL_TAKEN;
    throw e;
  }

  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function updateCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("customers.manage");

  const id = str(formData, "id");
  const existing = id ? await prisma.customer.findUnique({ where: { id }, select: { id: true } }) : null;
  if (!existing) return { error: "Customer not found." };

  const input = readCustomer(formData);
  if (!input.ok) return { error: "Check the highlighted fields.", fieldErrors: input.fieldErrors };

  const taken = await prisma.customer.findFirst({
    where: { email: input.data.email, NOT: { id } },
    select: { id: true },
  });
  if (taken) return EMAIL_TAKEN;

  try {
    await prisma.customer.update({ where: { id }, data: input.data });
  } catch (e) {
    if (isUniqueViolation(e)) return EMAIL_TAKEN;
    throw e;
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: "Customer details saved." };
}
