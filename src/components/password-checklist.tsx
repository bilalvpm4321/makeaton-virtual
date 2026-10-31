"use client";

import { Circle, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Mirrors PASSWORD_RULE in lib/auth/password.ts (client copy: that module imports bcrypt).
// PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/
const RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "More than 8 characters", test: (v) => v.length > 8 },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "One special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/** Live password rule checklist for signup and reset. */
export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs" aria-label="Password requirements">
      {RULES.map((rule) => {
        const met = rule.test(value);
        const Icon = met ? CircleCheck : Circle;
        return (
          <li
            key={rule.label}
            className={cn("flex items-center gap-1.5", met ? "text-success" : "text-muted-foreground")}
          >
            <Icon className="size-3.5 shrink-0" />
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
