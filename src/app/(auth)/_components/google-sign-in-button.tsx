"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const GENERIC_ERROR = "Google sign-in failed. Please try again.";
const POPUP_BLOCKED_ERROR = "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
const NETWORK_ERROR = "Network error. Check your connection and try again.";
// The user closed the popup or opened another one. Neither is an error worth showing.
const SILENT_CODES = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

// Public web config, embedded at build time. Each NEXT_PUBLIC_ name is written out literally so Next can inline it.
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : undefined),
  projectId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

type ExchangeResult = { redirect: string } | { error: string };

function errorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err && typeof err.code === "string"
    ? err.code
    : undefined;
}

/** Sends the Firebase ID token to our server, which opens the session and says where to go next. */
async function exchangeIdToken(idToken: string, next: string | undefined): Promise<ExchangeResult> {
  const res = await fetch("/api/auth/firebase", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, next }),
  });
  const data: unknown = await res.json().catch(() => null);
  if (typeof data === "object" && data !== null) {
    if (res.ok && "redirect" in data && typeof data.redirect === "string") return { redirect: data.redirect };
    if ("error" in data && typeof data.error === "string") return { error: data.error };
  }
  return { error: GENERIC_ERROR };
}

/** "Continue with Google": Firebase popup, then our own session cookie. Renders its own "or" divider below. */
export function GoogleSignInButton({ next, label = "Continue with Google" }: { next?: string; label?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      const [{ getApp, getApps, initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup, signOut }] =
        await Promise.all([import("firebase/app"), import("firebase/auth")]);
      const auth = getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);

      let result: ExchangeResult;
      try {
        result = await exchangeIdToken(await credential.user.getIdToken(), next);
      } finally {
        // Our cookie session is the source of truth. The Firebase session is not kept in this browser.
        await signOut(auth).catch(() => undefined);
      }

      if ("error" in result) {
        setError(result.error);
        setPending(false);
        return;
      }
      window.location.assign(result.redirect);
    } catch (err) {
      setPending(false);
      const code = errorCode(err);
      if (code && SILENT_CODES.has(code)) return;
      console.error("Google sign-in failed", code ?? err);
      if (code === "auth/popup-blocked") setError(POPUP_BLOCKED_ERROR);
      else if (code === "auth/network-request-failed") setError(NETWORK_ERROR);
      // The Firebase code (e.g. auth/internal-error) is safe to show and tells support what went wrong.
      else setError(code ? `${GENERIC_ERROR} (${code})` : GENERIC_ERROR);
    }
  }

  return (
    <div className="mt-8 grid gap-4">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={signIn}
        disabled={pending}
        aria-busy={pending}
      >
        <GoogleMark />
        {pending ? "Signing in…" : label}
      </Button>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5 text-sm text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span>or</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

/** Multicolor Google "G" mark, drawn in the brand colours. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.8064 5.9564-2.1805l-2.9087-2.2581c-.8064.54-1.8373.859-3.0477.859-2.3441 0-4.3282-1.5832-5.0364-3.7105H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.9636 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.9636 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9636 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"
      />
    </svg>
  );
}
