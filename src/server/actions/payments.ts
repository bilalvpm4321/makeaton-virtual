"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { parseDateInput } from "@/lib/dates";
import { formatMoney, toMinor } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from "@/app/(backoffice)/invoices/_shared/payment-methods";

// PLAN.md §6.9. Partial payments allowed. Full payment flips the invoice to PAID.

const schema = z.object({
  invoiceId: z.string().min(1, "Missing invoice."),
  method: z.enum(PAYMENT_METHODS, { message: "Choose a payment method." }),
  amount: z.string().min(1, "Enter an amount."),
  date: z.string().min(1, "Choose a date."),
  note: z.string().max(200, "Note must be 200 characters or fewer.").optional(),
});

class UserError extends Error {}

function messageFor(err: unknown): string {
  if (err instanceof UserError) return err.message;
  console.error("recordPayment failed", err);
  return "Something went wrong. Please try again.";
}

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function recordPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("payments.record");

  const parsed = schema.safeParse({
    invoiceId: field(formData, "invoiceId"),
    method: field(formData, "method"),
    amount: field(formData, "amount"),
    date: field(formData, "date"),
    note: field(formData, "note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the payment details." };

  const { invoiceId, method, note } = parsed.data;

  const amountText = parsed.data.amount.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    return { error: "Enter an amount in rupees, for example 1500 or 1500.50." };
  }
  const amount = toMinor(amountText);
  if (amount <= 0) return { error: "Amount must be greater than zero." };

  const date = parseDateInput(parsed.data.date);
  if (!date) return { error: "Enter a valid date." };

  try {
    const now = new Date();
    let fullyPaid = false;

    await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { number: true, status: true, total: true, amountPaid: true },
      });
      if (!inv) throw new UserError("Invoice not found.");
      if (inv.status !== "CONFIRMED") {
        throw new UserError("Payments can only be recorded on confirmed invoices.");
      }

      const due = inv.total - inv.amountPaid;
      if (amount > due) throw new UserError(`Amount is more than the amount due (${formatMoney(due)}).`);

      const paidAfter = inv.amountPaid + amount;
      fullyPaid = paidAfter === inv.total;

      // Optimistic lock on amountPaid so two concurrent payments cannot both pass the due check.
      const data = fullyPaid
        ? { amountPaid: paidAfter, status: "PAID" as const, paidAt: now }
        : { amountPaid: paidAfter };
      const res = await tx.invoice.updateMany({
        where: { id: invoiceId, status: "CONFIRMED", amountPaid: inv.amountPaid },
        data,
      });
      if (res.count === 0) throw new UserError("This invoice was just updated. Try again.");

      await tx.payment.create({
        data: {
          invoiceId,
          method,
          amount,
          date,
          note: note ?? null,
          recordedById: user.id,
        },
      });

      await logActivity(tx, {
        entityType: "invoice",
        entityId: invoiceId,
        message: `Payment of ${formatMoney(amount)} recorded (${PAYMENT_METHOD_LABELS[method]})`,
        userId: user.id,
      });
      if (fullyPaid) {
        await logActivity(tx, {
          entityType: "invoice",
          entityId: invoiceId,
          message: "Status: Confirmed → Paid",
          userId: user.id,
        });
      }
    });

    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath(`/portal/invoices/${invoiceId}`);
    revalidatePath("/invoices");
    revalidatePath("/payments");
    revalidatePath("/dashboard");
    revalidatePath("/portal");

    return {
      success: `Payment of ${formatMoney(amount)} recorded.${fullyPaid ? " The invoice is now paid in full." : ""}`,
    };
  } catch (err) {
    return { error: messageFor(err) };
  }
}
