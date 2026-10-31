import { AuthErrorBanner, GithubSignIn } from "../_components/github-sign-in";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account · Brightloop" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Manage your subscriptions and invoices.</p>
      <AuthErrorBanner code={typeof error === "string" ? error : undefined} />
      {process.env.GITHUB_CLIENT_ID ? <GithubSignIn href="/api/auth/github" /> : null}
      <SignupForm />
    </div>
  );
}
