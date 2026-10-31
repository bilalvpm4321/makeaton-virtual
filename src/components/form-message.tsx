import type { ActionState } from "@/lib/action-state";

/** Shows the top-level error or success message of a server action result. Field errors render inline. */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        {state.success}
      </p>
    );
  }
  return null;
}
