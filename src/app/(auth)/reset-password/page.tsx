import { createHash } from "node:crypto";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password · Brightloop" };

/** Checks the emailed token before showing the form. A database error counts as an invalid link. */
async function isUsableToken(raw: string): Promise<boolean> {
  try {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: createHash("sha256").update(raw).digest("hex") },
      select: { usedAt: true, expiresAt: true },
    });
    return record !== null && record.usedAt === null && record.expiresAt > new Date();
  } catch {
    return false;
  }
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && token.length > 0 && (await isUsableToken(token));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      {valid && token ? (
        <>
          <p className="mt-1.5 text-sm text-muted-foreground">Your new password must meet every rule below.</p>
          <ResetForm token={token} />
        </>
      ) : (
        <div className="mt-6 space-y-4">
          <p role="alert" className="rounded-lg border border-danger/25 bg-danger/5 p-3 text-sm text-danger">
            This link is invalid or has expired.
          </p>
          <Link href="/forgot-password" className="inline-block text-sm font-medium text-primary hover:underline">
            Request a new link
          </Link>
        </div>
      )}
    </div>
  );
}
