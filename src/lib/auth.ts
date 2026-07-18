/**
 * JWT auth, ported from azure-functions/shared/auth.py.
 * HS256 tokens with the same {sub, email, role, iat, exp} payload, so a
 * JWT_SECRET shared with the old deployment stays compatible.
 */
import jwt from "jsonwebtoken";

const JWT_ALGORITHM = "HS256" as const;
const JWT_EXPIRY_SECONDS = 60 * 60 * 12; // 12 hours

/** httpOnly cookie the session token lives in — not readable/settable from
 * client JS, so it can't be faked via localStorage the way the old
 * client-stored token could be. */
export const AUTH_COOKIE_NAME = "auth_token";
export const AUTH_COOKIE_MAX_AGE = JWT_EXPIRY_SECONDS;

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
  return secret;
}

export interface TokenClaims {
  sub: string;
  name: string | null;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AuthError";
  }
}

export interface TokenUser {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
}

export function createToken(user: TokenUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user.id),
    name: user.name ?? null,
    email: user.email,
    role: user.role ?? "user",
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
  };
  return jwt.sign(payload, getSecret(), { algorithm: JWT_ALGORITHM });
}

/** Extract and verify the session token — from the httpOnly auth cookie
 * (the normal path for browser requests), falling back to a Bearer
 * Authorization header for any direct/non-browser API callers. */
export function decodeToken(req: Request): TokenClaims {
  const header = req.headers.get("authorization") ?? "";
  const bearerToken = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  const token = bearerToken ?? readCookie(req, AUTH_COOKIE_NAME);
  if (!token) {
    throw new AuthError("Missing or invalid session", 401);
  }
  try {
    return jwt.verify(token, getSecret(), {
      algorithms: [JWT_ALGORITHM],
    }) as TokenClaims;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError("Token expired", 401);
    }
    throw new AuthError("Invalid token", 401);
  }
}

/** Same as decodeToken, but returns null instead of throwing — for routes
 * where being logged in is optional (e.g. attributing "created by"). */
export function tryDecodeToken(req: Request): TokenClaims | null {
  try {
    return decodeToken(req);
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request): TokenClaims {
  const claims = decodeToken(req);
  if (claims.role !== "admin") {
    throw new AuthError("Admin access required", 403);
  }
  return claims;
}
