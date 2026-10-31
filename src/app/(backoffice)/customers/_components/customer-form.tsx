"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { createCustomer, updateCustomer } from "@/server/actions/customers";

export type CustomerValues = {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  taxId: string;
};

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Create and edit form for a customer. Keeps the submitted values so a failed save does not clear the inputs. */
export function CustomerForm({ id, defaults }: { id?: string; defaults?: Partial<CustomerValues> }) {
  const initial: CustomerValues = {
    name: defaults?.name ?? "",
    email: defaults?.email ?? "",
    phone: defaults?.phone ?? "",
    company: defaults?.company ?? "",
    address: defaults?.address ?? "",
    taxId: defaults?.taxId ?? "",
  };
  const [values, setValues] = useState<CustomerValues>(initial);

  async function submit(prev: ActionState, formData: FormData): Promise<ActionState> {
    setValues({
      name: read(formData, "name"),
      email: read(formData, "email"),
      phone: read(formData, "phone"),
      company: read(formData, "company"),
      address: read(formData, "address"),
      taxId: read(formData, "taxId"),
    });
    return id ? updateCustomer(prev, formData) : createCustomer(prev, formData);
  }

  const [state, formAction] = useActionState(submit, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <div className="grid gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={values.name} required aria-invalid={!!errors.name} />
        {errors.name ? <p className="text-xs text-red-600">{errors.name}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={values.email}
          required
          aria-invalid={!!errors.email}
        />
        {errors.email ? <p className="text-xs text-red-600">{errors.email}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={values.phone} aria-invalid={!!errors.phone} />
        {errors.phone ? <p className="text-xs text-red-600">{errors.phone}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="company">Company</Label>
        <Input id="company" name="company" defaultValue={values.company} aria-invalid={!!errors.company} />
        {errors.company ? <p className="text-xs text-red-600">{errors.company}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" name="address" rows={3} defaultValue={values.address} aria-invalid={!!errors.address} />
        {errors.address ? <p className="text-xs text-red-600">{errors.address}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="taxId">Tax ID (GSTIN)</Label>
        <Input id="taxId" name="taxId" defaultValue={values.taxId} aria-invalid={!!errors.taxId} />
        {errors.taxId ? <p className="text-xs text-red-600">{errors.taxId}</p> : null}
      </div>

      <FormMessage state={state} />

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link href={id ? `/customers/${id}` : "/customers"} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
        <SubmitButton pendingText="Saving…">{id ? "Save changes" : "Create customer"}</SubmitButton>
      </div>
    </form>
  );
}
