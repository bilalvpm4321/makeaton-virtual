import { Card } from "@/components/ui/card";

const block = "animate-pulse rounded-md bg-muted";

/** Shown while a customer portal page loads. Same shape as the back-office skeleton, sized for the narrower portal. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">Loading</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className={`${block} h-6 w-44`} />
          <div className={`${block} h-4 w-64 max-w-full`} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center justify-between">
              <div className={`${block} h-3.5 w-24`} />
              <div className={`${block} size-8 rounded-lg`} />
            </div>
            <div className={`${block} mt-4 h-6 w-28`} />
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-subtle px-5 py-3">
          <div className={`${block} h-3.5 w-full max-w-sm`} />
        </div>
        <div className="divide-y divide-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className={`${block} h-4 flex-1`} />
              <div className={`${block} h-4 w-20`} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
