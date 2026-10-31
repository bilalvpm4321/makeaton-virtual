"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/lib/auth/guards";
import { runBilling } from "@/lib/billing/run";
import { parseDateInput, today } from "@/lib/dates";

const schema = z.object({ asOf: z.string().trim().optional() });

/** Runs the billing engine as of a date (default today). Guarded by billing.run. */
export async function runBillingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("billing.run");

  const parsed = schema.safeParse({ asOf: String(formData.get("asOf") ?? "") });
  if (!parsed.success) return { error: "Invalid date." };

  let asOf = today();
  if (parsed.data.asOf) {
    const d = parseDateInput(parsed.data.asOf);
    if (!d) return { error: "Enter a valid 'as of' date." };
    asOf = d;
  }

  try {
    const run = await runBilling(asOf, user.id);

    revalidatePath("/billing");
    revalidatePath("/invoices");
    revalidatePath("/subscriptions");
    revalidatePath("/dashboard");

    return {
      success: `Billing run complete: ${run.invoiced} invoices created, ${run.activated} activated, ${run.closed} closed, ${run.skipped} skipped, ${run.errors} errors.`,
    };
  } catch (err) {
    console.error("runBillingAction failed", err);
    return { error: "The billing run failed. Check the server log and try again." };
  }
}
