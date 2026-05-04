import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

const PROTECTED_PREFIXES = ["/admin", "/dashboard"];

// Public API routes that should be rate-limited at the edge. Cached responses
// served by the CDN do NOT pass through here, so this layer only kicks in on
// cache misses + writes — exactly where cost lives.
const RATE_LIMITED_PREFIXES = [
  "/api/weather",
  "/api/alerts",
  "/api/ads/serve",
  "/api/embed", // covers /api/embed/[apiKey] and /api/embed/analytics
];

function getClientIp(request: NextRequest): string {
  // Vercel sets x-forwarded-for; fall back to x-real-ip; final fallback is
  // a stable per-process placeholder so a missing header never collides
  // many real clients into one bucket.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Rate limiting on public API routes ─────────────────────────
  if (RATE_LIMITED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const ip = getClientIp(request);
    const verdict = await checkRateLimit(ip);
    if (!verdict.allowed) {
      logger.warn("rate_limit_blocked", {
        route: pathname,
        ip,
        reason: verdict.reason,
        limit: verdict.limit,
      });
      // Retry-After is a reasonable client signal; 60s matches our window.
      return NextResponse.json(
        { error: verdict.reason === "blocked-ip" ? "Forbidden" : "Too many requests" },
        {
          status: verdict.reason === "blocked-ip" ? 403 : 429,
          headers: {
            "Retry-After": "60",
            ...(verdict.limit != null ? { "X-RateLimit-Limit": String(verdict.limit) } : {}),
            ...(verdict.remaining != null ? { "X-RateLimit-Remaining": String(verdict.remaining) } : {}),
            ...(verdict.reset != null ? { "X-RateLimit-Reset": String(verdict.reset) } : {}),
          },
        }
      );
    }
    // Allowed — fall through to NextResponse.next() at the bottom.
  }

  // ─── Auth gate for /admin and /dashboard ────────────────────────
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const session = request.cookies.get("__session")?.value;
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Session exists — let the page handle role-based access via the layout.
  }

  return NextResponse.next();
}

export const config = {
  // Match both the protected pages AND the rate-limited API routes.
  // Skip /api/embed/analytics's GET (admin reads) by leaving it within
  // /api/embed; the rate limiter applies to the route regardless of method.
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/api/weather/:path*",
    "/api/alerts/:path*",
    "/api/ads/serve/:path*",
    "/api/embed/:path*",
  ],
};
