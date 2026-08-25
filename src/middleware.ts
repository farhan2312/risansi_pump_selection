import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/** Server-side route gate — runs before any protected page is served, so
 * direct URL entry, client-side navigation, and the back button are all
 * covered the same way (unlike the old client-only localStorage check,
 * which only ran after the page had already mounted). */
const AUTH_COOKIE_NAME = "auth_token";

/** Forced-password-change screen — reachable only by a flagged user, and the
 * only protected page they can reach. */
const CHANGE_PASSWORD_PATH = "/change-password";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/projects",
  "/pump-selection",
  "/pump-details",
  "/selection-summary",
  "/admin",
];

/** Verifies the session cookie, returning its payload or null when absent,
 * expired, or otherwise invalid. */
async function verifySession(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login page ("/"): an already-signed-in user has no reason to see the
  // form again — send them straight to the dashboard. Done here rather than
  // in the page component so there's no flash of the login screen before a
  // client-side redirect kicks in. An expired/invalid cookie falls through
  // to the form (and gets cleared) instead of bouncing.
  if (pathname === "/") {
    const session = await verifySession(req);
    if (session) {
      return NextResponse.redirect(
        new URL(
          session.mustChangePassword === true ? CHANGE_PASSWORD_PATH : "/dashboard",
          req.url,
        ),
      );
    }
    if (req.cookies.get(AUTH_COOKIE_NAME)) {
      const res = NextResponse.next();
      res.cookies.delete(AUTH_COOKIE_NAME);
      return res;
    }
    return NextResponse.next();
  }

  // Forced password change: a user with an admin-issued password can't reach
  // any protected page until they've set their own. Checked before the
  // role gates below so it can't be side-stepped by deep-linking.
  if (pathname === CHANGE_PASSWORD_PATH) {
    const session = await verifySession(req);
    if (!session) return NextResponse.redirect(new URL("/", req.url));
    // Already changed it — no reason to sit on this screen.
    if (session.mustChangePassword !== true) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!isProtected) return NextResponse.next();

  const payload = await verifySession(req);
  if (!payload) {
    // No session (or a stale one) — back to the login page, dropping the dead
    // cookie so the next request doesn't re-run a doomed verify.
    const res = NextResponse.redirect(new URL("/", req.url));
    if (req.cookies.get(AUTH_COOKIE_NAME)) res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
  }

  if (payload.mustChangePassword === true) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, req.url));
  }

  // Users & Access (formerly "access requests") and Bug Tracker are
  // system_admin only; the other /admin/* pages (the master-data tables)
  // are open to admin and system_admin alike.
  const role = payload.role;
  const isAdminLevel = role === "admin" || role === "system_admin";
  if (pathname.startsWith("/admin/users") || pathname.startsWith("/admin/bug-tracker")) {
    if (role !== "system_admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  } else if (pathname.startsWith("/admin") && !isAdminLevel) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/change-password",
    "/dashboard/:path*",
    "/projects/:path*",
    "/pump-selection/:path*",
    "/pump-details/:path*",
    "/selection-summary/:path*",
    "/admin/:path*",
  ],
};
