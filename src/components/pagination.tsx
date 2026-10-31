import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

const PAGE_BTN = cn(buttonVariants({ variant: "outline", size: "sm" }), "aria-disabled:pointer-events-none aria-disabled:opacity-50");

/** Server component. Keeps every other search param when building page links. Sits inside the table Card. */
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
    <div className="flex flex-col gap-3 border-t border-border bg-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] text-muted-foreground">
        {total === 0 ? (
          "No results"
        ) : (
          <>
            Showing{" "}
            <span className="num font-medium text-foreground">
              {from}–{to}
            </span>{" "}
            of <span className="num font-medium text-foreground">{total}</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-1">
        {prevDisabled ? (
          <span aria-disabled="true" className={PAGE_BTN}>
            <ChevronLeft />
            Previous
          </span>
        ) : (
          <Link href={hrefFor(page - 1)} className={PAGE_BTN}>
            <ChevronLeft />
            Previous
          </Link>
        )}
        <span className="num px-3 text-[13px] text-muted-foreground">
          Page {page} / {totalPages}
        </span>
        {nextDisabled ? (
          <span aria-disabled="true" className={PAGE_BTN}>
            Next
            <ChevronRight />
          </span>
        ) : (
          <Link href={hrefFor(page + 1)} className={PAGE_BTN}>
            Next
            <ChevronRight />
          </Link>
        )}
      </div>
    </div>
  );
}
