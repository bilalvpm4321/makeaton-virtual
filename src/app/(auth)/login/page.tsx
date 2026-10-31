import Link from "next/link";
import { AuthErrorBanner, GithubSignIn } from "../_components/github-sign-in";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in · Brightloop" };

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@brightloop.test", password: "Admin@12345" },
  { role: "Staff", email: "staff@brightloop.test", password: "Staff@12345" },
  { role: "Customer", email: "customer@brightloop.test", password: "Customer@12345" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>;
}) {
  const { next, reset, error } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const githubHref = nextPath
    ? `/api/auth/github?next=${encodeURIComponent(nextPath)}`
    : "/api/auth/github";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Log in to your Brightloop account</p>

      {reset ? (
        <p role="status" className="mt-6 rounded-lg bg-success/10 p-3 text-sm text-success">
          Your password has been updated. Log in with your new password.
        </p>
      ) : null}

      <AuthErrorBanner code={typeof error === "string" ? error : undefined} />

      {process.env.GITHUB_CLIENT_ID ? <GithubSignIn href={githubHref} /> : null}

      <LoginForm next={nextPath} />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-border bg-subtle p-3 text-xs text-muted-foreground">
        <p className="mb-1.5 font-medium text-foreground">Demo accounts</p>
        <ul className="space-y-1">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email} className="flex flex-wrap gap-x-2">
              <span className="w-16 shrink-0 font-medium text-foreground">{account.role}</span>
              <span className="num">{account.email}</span>
              <span className="num">{account.password}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
