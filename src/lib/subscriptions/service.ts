import type { Prisma } from "@prisma/client";
import type { Role } from "@/lib/auth/jwt";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { expiryFor, periodStart } from "@/lib/billing/period";
import { formatDate, today } from "@/lib/dates";
import { quotationEmail } from "@/lib/email/templates";
import { sendMail } from "@/lib/mail";
import {
  ACTION_LABELS,
  allowedActions,
  type SubAction,
  type SubStatus,
} from "@/lib/subscriptions/state";

const STATUS_LABEL: Record<SubStatus, string> = {
  DRAFT: "Draft",
  QUOTATION: "Quotation",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

/** Recomputes Subscription.recurringTotal = sum(quantity * unitPrice) over its lines. Call after any line change. */
export async function recomputeRecurringTotal(
  tx: Prisma.TransactionClient,
  subscriptionId: string,
): Promise<void> {
  const lines = await tx.subscriptionLine.findMany({
    where: { subscriptionId },
    select: { quantity: true, unitPrice: true },
  });
  const recurringTotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  await tx.subscription.update({ where: { id: subscriptionId }, data: { recurringTotal } });
}

/**
 * Applies a lifecycle action (PLAN.md §6.2) in one transaction and writes an Activity row.
 * Callers must check permissions first; this function only checks the state machine and plan flags.
 */
export async function transitionSubscription(
  subscriptionId: string,
  action: SubAction,
  actor: { id: string; role: Role },
  opts: { reason?: string } = {},
): Promise<void> {
  const todayDate = today();
  let quoteEmail: { to: string; subject: string; html: string; text: string } | null = null;

  await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        customer: { select: { name: true, email: true } },
        _count: { select: { lines: true } },
      },
    });
    if (!sub) throw new Error("Subscription not found.");

    const allowed = allowedActions(
      {
        status: sub.status,
        validUntil: sub.validUntil,
        termPeriods: sub.termPeriods,
        lineCount: sub._count.lines,
      },
      sub.plan,
      todayDate,
    );
    if (!allowed.includes(action)) {
      throw new Error(
        `${ACTION_LABELS[action]} is not available for this subscription (status: ${STATUS_LABEL[sub.status]}).`,
      );
    }

    const from: SubStatus = sub.status;
    const now = new Date();
    let nextStatus: SubStatus = from;
    let data: Prisma.SubscriptionUpdateInput = {};
    let message = "";

    switch (action) {
      case "SEND_QUOTE":
        nextStatus = "QUOTATION";
        break;

      case "CONFIRM":
        nextStatus = "CONFIRMED";
        break;

      case "ACTIVATE":
        nextStatus = "ACTIVE";
        data = { periodsBilled: 0, nextInvoiceDate: sub.startDate };
        break;

      case "PAUSE":
        nextStatus = "PAUSED";
        data = { pausedAt: now };
        break;

      case "RESUME": {
        // Paused time is free: skip every period that starts before today.
        const period = sub.plan.billingPeriod;
        let k = sub.periodsBilled;
        while (periodStart(sub.startDate, period, k) < todayDate) k += 1;
        nextStatus = "ACTIVE";
        data = {
          pausedAt: null,
          periodsBilled: k,
          nextInvoiceDate: periodStart(sub.startDate, period, k),
        };
        break;
      }

      case "CLOSE":
        nextStatus = "CLOSED";
        data = { closedAt: now, closeReason: opts.reason ?? "Closed", nextInvoiceDate: null };
        break;

      case "CANCEL":
        nextStatus = "CLOSED";
        data = {
          closedAt: now,
          closeReason: opts.reason ?? "Cancelled quotation",
          nextInvoiceDate: null,
        };
        break;

      case "RENEW": {
        const newTerm = (sub.termPeriods ?? 0) + (sub.plan.termLength ?? 1);
        const newExpiry = expiryFor(sub.startDate, sub.plan.billingPeriod, newTerm);
        data = { termPeriods: newTerm, expiryDate: newExpiry };
        message = `Renewed until ${formatDate(newExpiry)}`;
        break;
      }
    }

    await tx.subscription.update({
      where: { id: subscriptionId },
      data: { ...data, status: nextStatus },
    });

    if (action !== "RENEW") {
      message = `Status: ${STATUS_LABEL[from]} → ${STATUS_LABEL[nextStatus]}`;
    }
    await logActivity(tx, {
      entityType: "subscription",
      entityId: subscriptionId,
      message,
      userId: actor.id,
    });

    if (action === "SEND_QUOTE") {
      const mail = quotationEmail({
        customerName: sub.customer.name,
        number: sub.number,
        planName: sub.plan.name,
        total: sub.recurringTotal,
        validUntil: sub.validUntil,
        url: `${process.env.APP_URL ?? "http://localhost:3000"}/portal/subscriptions/${sub.id}`,
      });
      quoteEmail = { to: sub.customer.email, ...mail };
    }
  });

  if (quoteEmail) await sendMail(quoteEmail);
}
