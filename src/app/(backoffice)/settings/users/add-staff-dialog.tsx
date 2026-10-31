"use client";

import { useActionState, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { PasswordChecklist } from "@/components/password-checklist";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createStaffUser } from "@/server/actions/users";

export function AddStaffDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createStaffUser, undefined);
  // Controlled so a rejected submission keeps what the admin typed.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STAFF");

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("STAFF");
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          Add staff
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff</DialogTitle>
          <DialogDescription>Set a temporary password and share it with them directly.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-4">
          <FormMessage state={state} />

          <FormField label="Name" htmlFor="staff-name" error={state?.fieldErrors?.name}>
            <Input
              id="staff-name"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(state?.fieldErrors?.name)}
            />
          </FormField>

          <FormField label="Email" htmlFor="staff-email" error={state?.fieldErrors?.email}>
            <Input
              id="staff-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(state?.fieldErrors?.email)}
            />
          </FormField>

          <FormField label="Temporary password" htmlFor="staff-password" error={state?.fieldErrors?.password}>
            <Input
              id="staff-password"
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

          <FormField label="Role" htmlFor="staff-role" error={state?.fieldErrors?.role}>
            <Select id="staff-role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pendingText="Adding…">Add staff</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
