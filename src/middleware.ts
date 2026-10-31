import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, type Role } from "@/lib/auth/jwt";

// Only checks the JWT and the role prefix for fast redirects. Pages still call requireRole/requireUser.
const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password"]);
const AUTH_PATHS = new Set(["/login", "/signup"]);
const BACKOFFICE_PREFIXES = [
  "/dashboard",
  "/subscriptions",
  "/customers",
  "/payments",
  "/billing",
  "/catalog",
  "/settings",
  "/outbox",
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isBackoffice(pathname: string): boolean {
  if (BACKOFFICE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return true;
  // /invoices is back-office, except /invoices/[id]/print, which any signed-in user may open (ownership is checked in the page).
  if (matchesPrefix(pathname, "/invoices")) return !/^\/invoices\/[^/]+\/print$/.test(pathname);
  return false;
}

function homeFor(role: Role): string {
  return role === "CUSTOMER" ? "/portal" : "/dashboard";
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (AUTH_PATHS.has(pathname)) {
    if (session) return NextResponse.redirect(new URL(homeFor(session.role), req.url));
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "CUSTOMER" && isBackoffice(pathname)) {
    return NextResponse.redirect(new URL("/portal", req.url));
  }

  if (session.role !== "CUSTOMER" && matchesPrefix(pathname, "/portal")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/|api/cron|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|txt|woff2?)$).*)",
  ],
};
