import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { verifySession } from "@/lib/firebase/session";
import { db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getPlaceDetails, slugifyCourseName } from "@/lib/places";
import { fetchNwsPoints } from "@/lib/nws-points";
import { EMBED_CONFIG_TAG } from "@/app/api/embed/[apiKey]/route";
import { logger } from "@/lib/logger";

// Tier-default course ceilings. Override per-business via business.maxCourses
// for paid customers who negotiated a higher limit.
const TIER_DEFAULT_MAX_COURSES: Record<string, number> = {
  free: 1,
  pro: 1,
  enterprise: 5, // multi-course
};

function maxCoursesFor(tier: string, businessOverride: number | undefined): number {
  if (typeof businessOverride === "number" && businessOverride > 0) return businessOverride;
  return TIER_DEFAULT_MAX_COURSES[tier] ?? 1;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get("__session")?.value;
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await verifySession(session);
  if (!user || user.role !== "business" || !user.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { placeId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const placeId = body.placeId?.trim();
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  // ─── Tier-limit check ────────────────────────────────────────────
  const bizDoc = await db.collection("businesses").doc(user.businessId).get();
  if (!bizDoc.exists) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  const biz = bizDoc.data()!;
  const tier: string = biz.subscription?.tier || "free";
  const currentCount = (biz.courseIds || []).length;
  const limit = maxCoursesFor(tier, biz.maxCourses);
  if (currentCount >= limit) {
    return NextResponse.json(
      {
        error: tier === "enterprise"
          ? `You've reached your course limit (${limit}). Contact us to raise it.`
          : `Your ${tier} plan allows ${limit} course${limit === 1 ? "" : "s"}. Upgrade to add more.`,
        code: "limit-reached",
      },
      { status: 403 }
    );
  }

  // ─── Server-side Place Details fetch (don't trust client lat/lon) ─
  const result = await getPlaceDetails(placeId);
  if (!result.ok) {
    if (result.reason === "not-configured") {
      return NextResponse.json(
        { error: "Course lookup is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }
    if (result.reason === "not-found") {
      return NextResponse.json({ error: "We couldn't find that place." }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not look up that place." }, { status: 502 });
  }
  const place = result.place;

  try {
    // ─── Dedupe by placeId ───────────────────────────────────────
    const existingSnap = await db
      .collection("courses")
      .where("placeId", "==", place.placeId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0];
      const existingData = existing.data();
      const claimedBy: string | null = existingData.claimedBy ?? null;

      // Already linked to *this* business → idempotent success.
      if (claimedBy === user.businessId) {
        return NextResponse.json({ ok: true, courseId: existing.id, existing: true });
      }
      // Claimed by someone else → reject. Customer can email support.
      if (claimedBy && claimedBy !== user.businessId) {
        return NextResponse.json(
          {
            error: "That course is already claimed by another account. If this is your course, contact hello@teeweathr.com.",
            code: "already-claimed",
          },
          { status: 409 }
        );
      }

      // Unclaimed (admin pre-populated, or demo etc.) → claim it. Also
      // backfill timezone if missing so the operator's first weather view
      // already renders in the course's tz.
      const needsTz = !existingData.timezone;
      const tz = needsTz ? (await fetchNwsPoints(place.lat, place.lon))?.timeZone : null;
      const batch = db.batch();
      batch.update(existing.ref, {
        claimedBy: user.businessId,
        claimStatus: "claimed",
        ...(needsTz && tz ? { timezone: tz } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(bizDoc.ref, {
        courseIds: FieldValue.arrayUnion(existing.id),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      revalidateTag(EMBED_CONFIG_TAG, "max");
      logger.info("course_claimed_existing", { businessId: user.businessId, courseId: existing.id, placeId: place.placeId });
      return NextResponse.json({ ok: true, courseId: existing.id, claimed: true });
    }

    // ─── Create new course doc ───────────────────────────────────
    const baseSlug = slugifyCourseName(place.name);
    const stateSuffix = place.state?.toLowerCase() || place.country?.toLowerCase() || "us";
    let courseId = `${baseSlug}-${stateSuffix}`;
    // Defensive: if slug collision happens to exist, suffix with placeId tail.
    const collision = await db.collection("courses").doc(courseId).get();
    if (collision.exists) {
      courseId = `${baseSlug}-${place.placeId.slice(-6).toLowerCase()}`;
    }

    // Resolve IANA timezone from NWS so every display op renders in the
    // course's local zone, not the viewer's. Non-fatal on failure — we
    // can backfill later if NWS hiccups.
    const nws = await fetchNwsPoints(place.lat, place.lon);

    const batch = db.batch();
    batch.set(db.collection("courses").doc(courseId), {
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      city: place.city ?? null,
      state: place.state ?? null,
      country: place.country ?? null,
      formattedAddress: place.formattedAddress,
      placeId: place.placeId,
      placeTypes: place.types,
      timezone: nws?.timeZone ?? null,
      claimedBy: user.businessId,
      claimStatus: "claimed",
      source: "places",
      featured: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.update(bizDoc.ref, {
      courseIds: FieldValue.arrayUnion(courseId),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    revalidateTag(EMBED_CONFIG_TAG, "max");
    logger.info("course_added", {
      businessId: user.businessId,
      courseId,
      placeId: place.placeId,
      tier,
    });

    return NextResponse.json({
      ok: true,
      courseId,
      course: {
        id: courseId,
        name: place.name,
        formattedAddress: place.formattedAddress,
        lat: place.lat,
        lon: place.lon,
        city: place.city,
        state: place.state,
      },
    });
  } catch (err) {
    logger.error("course_add_failed", {
      businessId: user.businessId,
      placeId: place.placeId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Could not add course" }, { status: 500 });
  }
}
