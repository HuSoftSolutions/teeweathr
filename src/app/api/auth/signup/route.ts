import { NextRequest } from "next/server";
import { adminAuth, db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { logger } from "@/lib/logger";

const SESSION_EXPIRY_MS = 60 * 60 * 24 * 5 * 1000; // 5 days, matches /api/auth/session
const RECAPTCHA_ACTION = "signup";

type SignupBody = {
  idToken?: string;
  businessName?: string;
  recaptchaToken?: string;
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function uniqueBusinessId(base: string): Promise<string> {
  const baseSlug = slugify(base) || "business";
  // Probe up to 5 suffixes; if all taken, append a 4-char random suffix.
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`;
    const exists = await db.collection("businesses").doc(candidate).get();
    if (!exists.exists) return candidate;
  }
  return `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function POST(request: NextRequest) {
  let body: SignupBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { idToken, businessName, recaptchaToken } = body;
  if (!idToken || !businessName || businessName.trim().length < 2) {
    return Response.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  // ─── reCAPTCHA gate (first line of defense against signup bots) ─
  const captcha = await verifyRecaptcha(recaptchaToken, RECAPTCHA_ACTION);
  if (!captcha.allowed) {
    logger.warn("signup_recaptcha_rejected", { reason: captcha.reason, score: captcha.score });
    return Response.json(
      { error: "Could not verify you're human. Please try again." },
      { status: 403 }
    );
  }

  // ─── Verify the ID token created client-side by Firebase Auth ───
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    logger.warn("signup_invalid_token", { err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Invalid auth token" }, { status: 401 });
  }

  const uid = decoded.uid;
  const email = decoded.email;
  if (!email) {
    return Response.json({ error: "Email required on Firebase user" }, { status: 400 });
  }

  // Idempotency: if a business already exists for this user, return it
  // instead of creating a duplicate. This protects against double-submits.
  const existing = await db
    .collection("businesses")
    .where("firebaseUid", "==", uid)
    .limit(1)
    .get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    await setSessionCookie(idToken);
    return Response.json({
      ok: true,
      businessId: doc.id,
      apiKey: doc.data().embedApiKey,
      existing: true,
    });
  }

  try {
    const businessId = await uniqueBusinessId(businessName);
    const apiKey = crypto.randomUUID();

    await db.collection("businesses").doc(businessId).set({
      name: businessName.trim(),
      contactEmail: email,
      firebaseUid: uid,
      subscription: { tier: "free", status: "active" },
      courseIds: [],
      embedApiKey: apiKey,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await setSessionCookie(idToken);

    logger.info("signup_succeeded", {
      businessId,
      uid,
      recaptchaConfigured: "configured" in captcha ? captcha.configured : true,
    });

    return Response.json({ ok: true, businessId, apiKey });
  } catch (err) {
    logger.error("signup_failed", {
      uid,
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Could not complete signup" }, { status: 500 });
  }
}

async function setSessionCookie(idToken: string) {
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRY_MS,
  });
  const cookieStore = await cookies();
  cookieStore.set("__session", sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_EXPIRY_MS / 1000,
    path: "/",
  });
}
