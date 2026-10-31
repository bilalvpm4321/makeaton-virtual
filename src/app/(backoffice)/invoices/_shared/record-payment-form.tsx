"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { recordPayment } from "@/server/actions/payments";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "./payment-methods";

export function RecordPaymentForm({
  invoiceId,
  amountDueMinor,
  amountDueLabel,
  amountDueInput,
  defaultDate,
}: {
  invoiceId: string;
  amountDueMinor: number;
  amountDueLabel: string;
  amountDueInput: string;
  defaultDate: string;
}) {
  const [state, formAction] = useActionState(recordPayment, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4" key={amountDueMinor}>
      <input type="hidden" name="invoiceId" value={invoiceId} />

      <div className="space-y-1.5">
        <Label htmlFor="method">Method</Label>
        <Select id="method" name="method" defaultValue="BANK_TRANSFER">
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount (₹)</Label>
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          defaultValue={amountDueInput}
          className="text-right tabular-nums"
          required
        />
        <p className="text-xs text-neutral-500">Up to {amountDueLabel}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" defaultValue={defaultDate} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" name="note" rows={2} placeholder="Reference, cheque number…" maxLength={200} />
      </div>

      <FormMessage state={state} />

      <SubmitButton pendingText="Recording…" className="w-full" disabled={amountDueMinor <= 0}>
        Record payment
      </SubmitButton>
    </form>
  );
}
