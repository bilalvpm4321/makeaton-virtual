import type { Metadata } from "next";
import Link from "next/link";
import { House } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Page not found · Brightloop" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-6">
        <Link href="/" aria-label="Brightloop home">
          <BrandMark tone="light" />
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="font-display text-[88px] leading-none tracking-tight text-primary sm:text-[120px]">404</p>
        <h1 className="mt-4 text-[22px] font-semibold tracking-tight">This page is not in the loop</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The link may be out of date, or the page may have moved. Head back home and pick up from there.
        </p>
        <Link href="/" className={cn(buttonVariants(), "mt-8")}>
          <House />
          Go home
        </Link>
      </main>
    </div>
  );
}
