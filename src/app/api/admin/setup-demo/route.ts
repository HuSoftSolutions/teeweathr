import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verifySession } from "@/lib/firebase/session";
import { db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  DEMO_API_KEY,
  DEMO_BUSINESS_ID,
  DEMO_COURSE_ID,
  DEMO_COURSE,
} from "@/lib/demo";
import { EMBED_CONFIG_TAG } from "@/app/api/embed/[apiKey]/route";
import { logger } from "@/lib/logger";

// Idempotent admin endpoint: provisions (or refreshes) the public demo
// business + course used on the landing page. Safe to re-run; uses
// merge-set semantics so it never clobbers fields we don't manage.
export async function POST() {
  const cookieStore = await cookies();
  const session = cookieStore.get("__session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await verifySession(session);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const batch = db.batch();

    batch.set(
      db.collection("businesses").doc(DEMO_BUSINESS_ID),
      {
        name: "TeeWeathr Demo",
        email: "demo@teeweathr.com",
        embedApiKey: DEMO_API_KEY,
        courseIds: [DEMO_COURSE_ID],
        subscription: { tier: "free", status: "active" },
        // Flag used by analytics + future quota code to skip writes for
        // demo traffic so landing-page views don't pollute real metrics.
        isDemo: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    batch.set(
      db.collection("courses").doc(DEMO_COURSE_ID),
      {
        ...DEMO_COURSE,
        claimedBy: DEMO_BUSINESS_ID,
        claimStatus: "claimed",
        source: "demo",
        featured: false,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();

    // The keyed embed config endpoint caches by apiKey — bust it so the
    // demo key resolves on the very next request, even if a stale cache
    // entry was populated against a previous (broken) version of these
    // docs during dev.
    revalidateTag(EMBED_CONFIG_TAG, "max");

    logger.info("demo_provisioned", {
      businessId: DEMO_BUSINESS_ID,
      courseId: DEMO_COURSE_ID,
      apiKey: DEMO_API_KEY,
    });

    return NextResponse.json({
      ok: true,
      businessId: DEMO_BUSINESS_ID,
      courseId: DEMO_COURSE_ID,
      apiKey: DEMO_API_KEY,
    });
  } catch (err) {
    logger.error("demo_setup_failed", {
      route: "/api/admin/setup-demo",
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
