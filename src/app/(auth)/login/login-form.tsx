"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormField } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { login } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(login, undefined);
  // Controlled so the email survives a failed attempt (React resets uncontrolled fields after an action).
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="mt-8 grid gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
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

      <FormField
        label="Password"
        htmlFor="password"
        error={state?.fieldErrors?.password}
        action={
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        }
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state?.fieldErrors?.password)}
        />
      </FormField>

      <SubmitButton size="lg" className="w-full" pendingText="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}
