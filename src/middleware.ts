import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/** Server-side route gate — runs before any protected page is served, so
 * direct URL entry, client-side navigation, and the back button are all
 * covered the same way (unlike the old client-only localStorage check,
 * which only ran after the page had already mounted). */
const AUTH_COOKIE_NAME = "auth_token";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/projects",
  "/pump-selection",
  "/pump-details",
  "/selection-summary",
  "/admin",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

    if (pathname.startsWith("/admin") && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/", req.url));
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/pump-selection/:path*",
    "/pump-details/:path*",
    "/selection-summary/:path*",
    "/admin/:path*",
  ],
};
