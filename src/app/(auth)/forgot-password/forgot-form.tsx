"use client";

import { useActionState, useState } from "react";
import { FormField } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/server/actions/auth";

export function ForgotForm() {
  const [state, formAction] = useActionState(requestPasswordReset, undefined);
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="mt-8 grid gap-4">
      <FormMessage state={state} />

      <FormField label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(state?.fieldErrors?.email)}
        />
      </FormField>

      <SubmitButton size="lg" className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
