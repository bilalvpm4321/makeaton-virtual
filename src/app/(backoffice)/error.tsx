"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function BackofficeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-danger/10 text-danger">
          <TriangleAlert className="size-5" />
        </span>
        <h1 className="mt-4 text-[20px] font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page could not load. It has been logged. Trying again usually fixes it.
        </p>
        {error.digest ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Reference <span className="num text-foreground">{error.digest}</span>
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Go home
          </Link>
          <Button type="button" onClick={() => reset()}>
            <RotateCcw />
            Try again
          </Button>
        </div>
      </Card>
    </div>
  );
}
