import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-neutral-900">{title}</p>
      {description ? <p className="max-w-md text-sm text-neutral-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
