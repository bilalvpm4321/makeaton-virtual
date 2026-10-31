"use client";

import { useActionState, useState } from "react";
import { FormField } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { PasswordChecklist } from "@/components/password-checklist";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { resetPassword } from "@/server/actions/auth";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPassword, undefined);
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="mt-8 grid gap-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />

      <FormField label="New password" htmlFor="password" error={state?.fieldErrors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(state?.fieldErrors?.password)}
        />
        <PasswordChecklist value={password} />
      </FormField>

      <FormField label="Confirm new password" htmlFor="confirm" error={state?.fieldErrors?.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state?.fieldErrors?.confirm)}
        />
      </FormField>

      <SubmitButton size="lg" className="w-full" pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
