"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { createSubscription } from "@/server/actions/subscriptions";

type Option = { id: string; label: string };

export type NewSubscriptionDefaults = {
  customerId: string;
  planId: string;
  paymentTermId: string;
  startDate: string;
  notes: string;
};

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function SubscriptionForm({
  customers,
  plans,
  paymentTerms,
  templateId,
  defaults,
}: {
  customers: Option[];
  plans: Option[];
  paymentTerms: Option[];
  templateId: string | null;
  defaults: NewSubscriptionDefaults;
}) {
  const [values, setValues] = useState<NewSubscriptionDefaults>(defaults);

  async function submit(prev: ActionState, formData: FormData): Promise<ActionState> {
    setValues({
      customerId: read(formData, "customerId"),
      planId: read(formData, "planId"),
      paymentTermId: read(formData, "paymentTermId"),
      startDate: read(formData, "startDate"),
      notes: read(formData, "notes"),
    });
    return createSubscription(prev, formData);
  }

  const [state, formAction] = useActionState(submit, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-5">
      {templateId ? <input type="hidden" name="templateId" value={templateId} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="customerId">Customer</Label>
            <Link href="/customers/new" className="text-xs font-medium text-neutral-600 underline-offset-4 hover:underline">
              New customer
            </Link>
          </div>
          <Select
            id="customerId"
            name="customerId"
            defaultValue={values.customerId}
            required
            aria-invalid={!!errors.customerId}
          >
            <option value="">Choose a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          {errors.customerId ? <p className="text-xs text-red-600">{errors.customerId}</p> : null}
          <p className="text-xs text-neutral-500">Shows the first 300 customers by name.</p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="planId">Plan</Label>
          <Select id="planId" name="planId" defaultValue={values.planId} required aria-invalid={!!errors.planId}>
            <option value="">Choose a plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
          {errors.planId ? <p className="text-xs text-red-600">{errors.planId}</p> : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="paymentTermId">Payment term</Label>
          <Select
            id="paymentTermId"
            name="paymentTermId"
            defaultValue={values.paymentTermId}
            required
            aria-invalid={!!errors.paymentTermId}
          >
            <option value="">Choose a term…</option>
            {paymentTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          {errors.paymentTermId ? <p className="text-xs text-red-600">{errors.paymentTermId}</p> : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={values.startDate}
            required
            aria-invalid={!!errors.startDate}
          />
          {errors.startDate ? <p className="text-xs text-red-600">{errors.startDate}</p> : null}
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={3} defaultValue={values.notes} />
        </div>
      </div>

      <FormMessage state={state} />

      <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
        <Link href="/subscriptions" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
        <SubmitButton pendingText="Creating…">Create draft</SubmitButton>
      </div>
    </form>
  );
}
