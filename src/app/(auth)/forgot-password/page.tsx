import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset password · Brightloop" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">We&apos;ll email you a reset link.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
