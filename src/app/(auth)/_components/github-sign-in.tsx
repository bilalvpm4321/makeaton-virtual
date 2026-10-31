import { TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ERROR_MESSAGES: Record<string, string> = {
  github_unavailable: "GitHub sign-in isn't set up yet.",
  github_failed: "GitHub sign-in failed. Please try again.",
  github_no_email: "Your GitHub account has no verified email.",
  account_disabled: "This account is disabled.",
};

/** Friendly text for the ?error= codes set by the GitHub routes and the login flow. Unknown codes show nothing. */
export function authErrorMessage(code: string | undefined): string | null {
  return code && Object.hasOwn(ERROR_MESSAGES, code) ? ERROR_MESSAGES[code] : null;
}

export function AuthErrorBanner({ code }: { code?: string }) {
  const message = authErrorMessage(code);
  if (!message) return null;
  return (
    <p role="alert" className="mt-6 flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5 text-sm text-danger">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/** Full-width outline button to the GitHub OAuth start route, followed by an "or" divider. Server-rendered; no client JS. */
export function GithubSignIn({ href }: { href: string }) {
  return (
    <div className="mt-8 grid gap-4">
      <a href={href} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
        <GithubMark />
        Continue with GitHub
      </a>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span>or</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

/** GitHub mark (Simple Icons path, 24x24 grid), so the button does not depend on lucide's brand icons. */
function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
