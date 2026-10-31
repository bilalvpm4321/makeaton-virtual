"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormField } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { PasswordChecklist } from "@/components/password-checklist";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { signup } from "@/server/actions/auth";

export function SignupForm() {
  const [state, formAction] = useActionState(signup, undefined);
  // Controlled fields keep what the user typed when the server returns an error.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="mt-8 grid gap-4">
      <FormMessage state={state} />

      <FormField label="Full name" htmlFor="name" error={state?.fieldErrors?.name}>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(state?.fieldErrors?.name)}
        />
      </FormField>

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

      <FormField label="Password" htmlFor="password" error={state?.fieldErrors?.password}>
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

      <FormField label="Confirm password" htmlFor="confirm" error={state?.fieldErrors?.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state?.fieldErrors?.confirm)}
        />
      </FormField>

      <SubmitButton size="lg" className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
