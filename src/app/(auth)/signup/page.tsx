import { envStatus } from "@/lib/env";
import { GoogleSignInButton } from "../_components/google-sign-in-button";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account · Brightloop" };
// Reads the sign-in configuration per request, so a changed environment never shows a stale page.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  const googleEnabled = envStatus().google;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Manage your subscriptions and invoices.</p>
      {googleEnabled ? <GoogleSignInButton /> : null}
      <SignupForm />
    </div>
  );
}
