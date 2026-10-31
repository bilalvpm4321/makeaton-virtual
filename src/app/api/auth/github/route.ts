import { NextResponse, type NextRequest } from "next/server";
import {
  appOrigin,
  GITHUB_STATE_COOKIE,
  GITHUB_STATE_COOKIE_OPTIONS,
  githubAuthorizeUrl,
  githubCallbackUrl,
  githubCredentials,
  newOAuthState,
  safeNext,
} from "@/lib/auth/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts "Continue with GitHub": sets a one-time state cookie, then sends the browser to GitHub's authorize page. */
export async function GET(req: NextRequest) {
  const base = appOrigin(req.url);
  const credentials = githubCredentials();
  if (!credentials) return NextResponse.redirect(new URL("/login?error=github_unavailable", base));

  const state = newOAuthState();
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const res = NextResponse.redirect(
    githubAuthorizeUrl(credentials.clientId, githubCallbackUrl(req.url), state),
  );
  res.cookies.set(GITHUB_STATE_COOKIE, JSON.stringify({ state, next }), GITHUB_STATE_COOKIE_OPTIONS);
  return res;
}
