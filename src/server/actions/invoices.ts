"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { invoiceEmail } from "@/lib/email/templates";
import { sendMail } from "@/lib/mail";

// Invoice lifecycle actions (PLAN.md §6.8). Each one: permission first, zod second, one transaction, Activity row.

const idSchema = z.object({ invoiceId: z.string().min(1, "Missing invoice.") });
const BATCH = 200;

/** Errors we want to show to the user verbatim. Anything else gets a generic message. */
class UserError extends Error {}

function messageFor(err: unknown): string {
  if (err instanceof UserError) return err.message;
  console.error("invoice action failed", err);
  return "Something went wrong. Please try again.";
}

function readId(formData: FormData) {
  return idSchema.safeParse({ invoiceId: String(formData.get("invoiceId") ?? "") });
}

function revalidateInvoice(invoiceId: string) {
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/invoices/${invoiceId}/print`);
  revalidatePath(`/portal/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
}

export async function confirmInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("invoices.manage");
  const parsed = readId(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid invoice." };
  const { invoiceId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const res = await tx.invoice.updateMany({
        where: { id: invoiceId, status: "DRAFT" },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      if (res.count === 0) throw new UserError("Only draft invoices can be confirmed.");
      await logActivity(tx, {
        entityType: "invoice",
        entityId: invoiceId,
        message: "Status: Draft → Confirmed",
        userId: user.id,
      });
    });
    revalidateInvoice(invoiceId);
    return { success: "Invoice confirmed." };
  } catch (err) {
    return { error: messageFor(err) };
  }
}

/** Cancel: DRAFT, or CONFIRMED with nothing paid. Releases discount usage. The period stays consumed. */
export async function cancelInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("invoices.manage");
  const parsed = readId(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid invoice." };
  const { invoiceId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          status: true,
          amountPaid: true,
          redemptions: { select: { discountId: true } },
        },
      });
      if (!inv) throw new UserError("Invoice not found.");
      const cancellable = inv.status === "DRAFT" || (inv.status === "CONFIRMED" && inv.amountPaid === 0);
      if (!cancellable) {
        throw new UserError("Only drafts, or confirmed invoices with no payments, can be cancelled.");
      }

      for (const r of inv.redemptions) {
        await tx.discountRule.updateMany({
          where: { id: r.discountId, usageCount: { gt: 0 } },
          data: { usageCount: { decrement: 1 } },
        });
      }
      await tx.discountRedemption.deleteMany({ where: { invoiceId } });

      const res = await tx.invoice.updateMany({
        where: { id: invoiceId, status: inv.status, amountPaid: 0 },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      if (res.count === 0) throw new UserError("This invoice changed. Reload and try again.");

      const from = inv.status === "DRAFT" ? "Draft" : "Confirmed";
      await logActivity(tx, {
        entityType: "invoice",
        entityId: invoiceId,
        message: `Status: ${from} → Cancelled`,
        userId: user.id,
      });
    });
    revalidateInvoice(invoiceId);
    return { success: "Invoice cancelled." };
  } catch (err) {
    return { error: messageFor(err) };
  }
}

/** Emails the customer a summary with a portal link. Allowed for CONFIRMED and PAID invoices. */
export async function sendInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("invoices.manage");
  const parsed = readId(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid invoice." };
  const { invoiceId } = parsed.data;

  try {
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        number: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        customer: { select: { name: true, email: true } },
      },
    });
    if (!inv) return { error: "Invoice not found." };
    if (inv.status !== "CONFIRMED" && inv.status !== "PAID") {
      return { error: "Only confirmed or paid invoices can be sent." };
    }

    const to = inv.customer.email;
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: invoiceId }, data: { sentAt: new Date() } });
      await logActivity(tx, {
        entityType: "invoice",
        entityId: invoiceId,
        message: `Invoice emailed to ${to}`,
        userId: user.id,
      });
    });

    const mail = invoiceEmail({
      customerName: inv.customer.name,
      number: inv.number,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      total: inv.total,
      amountDue: inv.total - inv.amountPaid,
      url: `${process.env.APP_URL ?? "http://localhost:3000"}/portal/invoices/${invoiceId}`,
    });
    await sendMail({ to, ...mail });

    revalidateInvoice(invoiceId);
    return { success: `Invoice sent to ${to}.` };
  } catch (err) {
    return { error: messageFor(err) };
  }
}

/** Confirms every DRAFT invoice, in batches of 200. One Activity row per invoice. */
export async function confirmAllDrafts(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await requirePermission("invoices.manage");

  try {
    let confirmed = 0;
    const now = new Date();
    for (;;) {
      const batch = await prisma.invoice.findMany({
        where: { status: "DRAFT" },
        select: { id: true },
        orderBy: { id: "asc" },
        take: BATCH,
      });
      if (batch.length === 0) break;
      const ids = batch.map((b) => b.id);

      await prisma.$transaction(async (tx) => {
        const res = await tx.invoice.updateMany({
          where: { id: { in: ids }, status: "DRAFT" },
          data: { status: "CONFIRMED", confirmedAt: now },
        });
        confirmed += res.count;
        await tx.activity.createMany({
          data: ids.map((entityId) => ({
            entityType: "invoice",
            entityId,
            message: "Status: Draft → Confirmed",
            userId: user.id,
          })),
        });
      });
    }

    revalidatePath("/invoices");
    revalidatePath("/payments");
    revalidatePath("/dashboard");
    return {
      success: confirmed === 0 ? "There were no draft invoices to confirm." : `${confirmed} draft invoices confirmed.`,
    };
  } catch (err) {
    return { error: messageFor(err) };
  }
}
