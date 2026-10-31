import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

/** Split screen for every auth page. The left panel carries the brand; the form column stays single-column on phones. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" aria-label="Brightloop home" className="relative w-fit">
          <BrandMark tone="dark" />
        </Link>
        <div className="absolute -right-32 top-1/3 size-[480px] rounded-full border-[56px] border-primary/25" />
        <div className="absolute -right-10 top-[42%] size-24 rounded-full bg-accent/90 blur-[2px]" />
        <blockquote className="relative max-w-md font-display text-[34px] leading-[1.15]">
          &ldquo;Every period billed once. <em className="not-italic text-accent">Never twice, never skipped.</em>&rdquo;
        </blockquote>
        <p className="relative text-xs text-sidebar-muted">© Brightloop · Subscription billing</p>
      </aside>
      <main className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[380px]">
          <Link href="/" aria-label="Brightloop home" className="mb-10 inline-block lg:hidden">
            <BrandMark tone="light" />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
