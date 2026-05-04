// Edge-friendly rate limiter backed by Upstash Redis.
//
// Fail-open by design: if env vars are missing, Upstash is unreachable, or
// the limiter throws, the request is allowed. Rate limiting is a cost
// defense, not an availability layer — a misconfigured limiter must never
// take the site down.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const RL_URL = process.env.UPSTASH_REDIS_REST_URL;
const RL_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Static IP block list, comma-separated. Use this as the immediate "block
// this jerk now" lever before standing up Vercel Firewall.
const BLOCKED_IPS: ReadonlySet<string> = new Set(
  (process.env.BLOCKED_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

let limiter: Ratelimit | null = null;

if (RL_URL && RL_TOKEN) {
  const redis = new Redis({ url: RL_URL, token: RL_TOKEN });
  // Sliding window: 60 requests / minute / identifier. Tune via env later
  // if needed — keep the limit in code for now so it's reviewable in PRs.
  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    analytics: false,
    prefix: "tw_rl",
  });
}

export type RateLimitVerdict =
  | { allowed: true; reason?: never; limit?: number; remaining?: number; reset?: number }
  | { allowed: false; reason: "blocked-ip" | "rate-exceeded"; limit?: number; remaining?: number; reset?: number };

export function isBlockedIp(ip: string | null): boolean {
  return ip != null && BLOCKED_IPS.has(ip);
}

export function isRateLimitConfigured(): boolean {
  return limiter != null;
}

export async function checkRateLimit(identifier: string): Promise<RateLimitVerdict> {
  if (isBlockedIp(identifier)) {
    return { allowed: false, reason: "blocked-ip" };
  }
  if (!limiter) {
    // Not configured — fail open.
    return { allowed: true };
  }
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    if (success) {
      return { allowed: true, limit, remaining, reset };
    }
    return { allowed: false, reason: "rate-exceeded", limit, remaining, reset };
  } catch {
    // Upstash unreachable / transient failure — fail open.
    return { allowed: true };
  }
}
