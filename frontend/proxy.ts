import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "brewai.session";
const ADMIN_LOGIN = "/admin/login";
const ADMIN_REGISTER = "/admin/register";

function b64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const fixed = pad ? padded + "=".repeat(4 - pad) : padded;
  const bin = atob(fixed);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Verify the HS256 session JWT (signed with AUTH_SECRET) and return claims. */
async function verifySession(token: string): Promise<{ sub: string; role: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const enc = new TextEncoder();
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(parts[2]),
      enc.encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(parts[1])),
    ) as { sub?: string; role?: string; exp?: number };
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (!payload.sub) return null;
    return { sub: payload.sub, role: payload.role ?? "customer" };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === ADMIN_LOGIN || pathname === ADMIN_REGISTER) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const claims = await verifySession(token);
    if (claims?.role === "admin") return NextResponse.next();
    if (claims?.role === "customer") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  const url = new URL(ADMIN_LOGIN, request.url);
  if (pathname !== ADMIN_LOGIN) url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
