"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setUserActive } from "@/server/actions/users";

/** Activates or deactivates one user. Result shows as a toast. */
export function UserStatusButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [state, formAction, pending] = useActionState(setUserActive, undefined);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className={cn(isActive && "text-danger hover:bg-danger/10 hover:text-danger")}
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </Button>
    </form>
  );
}
