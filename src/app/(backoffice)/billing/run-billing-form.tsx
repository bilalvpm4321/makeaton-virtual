"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runBillingAction } from "@/server/actions/billing";

export function RunBillingForm({ defaultAsOf }: { defaultAsOf: string }) {
  const [state, formAction] = useActionState(runBillingAction, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="asOf">As of date</Label>
        <Input id="asOf" name="asOf" type="date" defaultValue={defaultAsOf} />
        <p className="text-xs text-neutral-500">Demo time travel: bill as if today were this date.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Running billing…" className="w-full" size="lg">
        <Zap />
        Run billing now
      </SubmitButton>
    </form>
  );
}
