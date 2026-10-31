import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

/** Server component. Keeps every other search param when building page links. */
export function Pagination({
  page,
  total,
  pageSize,
  basePath,
  searchParams,
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  searchParams: SearchParams;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page" || value === undefined) continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex flex-col gap-3 pt-4 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
      <span>{total === 0 ? "No results" : `${from}–${to} of ${total}`}</span>
      <div className="flex items-center gap-2">
        {prevDisabled ? (
          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}>
            Previous
          </span>
        ) : (
          <Link href={hrefFor(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Previous
          </Link>
        )}
        <span className="px-1">
          Page {page} of {totalPages}
        </span>
        {nextDisabled ? (
          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}>
            Next
          </span>
        ) : (
          <Link href={hrefFor(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
