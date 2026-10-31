import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Brightloop</h1>
        <p className="mt-2 text-neutral-600">Subscription management</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/login" className={buttonVariants()}>
          Log in
        </Link>
        <Link href="/signup" className={buttonVariants({ variant: "outline" })}>
          Sign up
        </Link>
      </div>
    </main>
  );
}
