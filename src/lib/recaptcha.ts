// reCAPTCHA v3 server-side verification.
//
// Fail-open if RECAPTCHA_SECRET_KEY is not set so local dev / preview without
// the key still works. In production, set the env var. Failed verification
// returns a structured error so callers can decide how to react (signup
// rejects; less-sensitive routes could just log and allow).

import { logger } from "@/lib/logger";

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

// Score threshold for v3. 0.0 = bot, 1.0 = human. Google recommends 0.5 as a
// balanced default; tighten over time if abuse appears.
const MIN_SCORE = 0.5;

export type RecaptchaVerdict =
  | { allowed: true; configured: boolean; score?: number }
  | { allowed: false; reason: "missing-token" | "verify-failed" | "low-score" | "wrong-action"; score?: number };

export async function verifyRecaptcha(token: string | null | undefined, expectedAction: string): Promise<RecaptchaVerdict> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    // Not configured — fail open with a flag so the caller knows.
    return { allowed: true, configured: false };
  }

  if (!token) {
    return { allowed: false, reason: "missing-token" };
  }

  try {
    const params = new URLSearchParams({ secret, response: token });
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data: {
      success?: boolean;
      score?: number;
      action?: string;
      "error-codes"?: string[];
    } = await res.json();

    if (!data.success) {
      logger.warn("recaptcha_verify_failed", { errorCodes: data["error-codes"] ?? [] });
      return { allowed: false, reason: "verify-failed", score: data.score };
    }
    if (data.action && data.action !== expectedAction) {
      logger.warn("recaptcha_action_mismatch", { expected: expectedAction, got: data.action });
      return { allowed: false, reason: "wrong-action", score: data.score };
    }
    if (typeof data.score === "number" && data.score < MIN_SCORE) {
      logger.warn("recaptcha_low_score", { score: data.score, action: expectedAction });
      return { allowed: false, reason: "low-score", score: data.score };
    }

    return { allowed: true, configured: true, score: data.score };
  } catch (err) {
    // Network / parse failure — log, fail open. Better to let a real user
    // through than block everyone if Google is having a bad minute.
    logger.error("recaptcha_verify_error", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { allowed: true, configured: true };
  }
}
