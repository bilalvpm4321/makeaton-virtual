import { CircleCheck, TriangleAlert } from "lucide-react";
import type { ActionState } from "@/lib/action-state";

/** Shows the top-level error or success message of a server action result. Field errors render inline. */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5 text-sm text-danger">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <span>{state.error}</span>
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
        <CircleCheck className="mt-0.5 size-4 shrink-0" />
        <span>{state.success}</span>
      </p>
    );
  }
  return null;
}
