import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account · Brightloop" };

export default function SignupPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Manage your subscriptions and invoices.</p>
      <SignupForm />
    </div>
  );
}
