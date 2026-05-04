import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { EMBED_CONFIG_TAG } from "@/app/api/embed/[apiKey]/route";
import { verifySession } from "@/lib/firebase/session";
import { getPlaceDetails, slugifyCourseName } from "@/lib/places";
import { logger } from "@/lib/logger";

async function requireAdmin(): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const cookieStore = await cookies();
  const session = cookieStore.get("__session")?.value;
  if (!session) return { ok: false, status: 401, error: "Not authenticated" };
  const user = await verifySession(session);
  if (!user || user.role !== "admin") return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const snapshot = await db.collection("courses").get();

    const featured: FirebaseFirestore.DocumentData[] = [];
    const claimed: FirebaseFirestore.DocumentData[] = [];
    const all: FirebaseFirestore.DocumentData[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const entry = { id: doc.id, ...data };
      all.push(entry);
      if (data.featured) featured.push(entry);
      if (data.claimStatus === "claimed") claimed.push(entry);
    });

    return NextResponse.json({ featured, claimed, all });
  } catch (error) {
    console.error("Failed to fetch admin courses:", error);
    return NextResponse.json({ featured: [], claimed: [], all: [] });
  }
}

// Create a new course. Two paths:
//   - { placeId } → server fetches Place Details, dedupes by placeId
//   - { name, lat, lon, ... } → legacy manual fields (back-compat for cases
//     where the admin needs a course Places can't find)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ─── Places path ─────────────────────────────────────────────────
  if (typeof body.placeId === "string" && body.placeId) {
    const placeId = body.placeId;
    const result = await getPlaceDetails(placeId);
    if (!result.ok) {
      const status = result.reason === "not-configured" ? 503 : result.reason === "not-found" ? 404 : 502;
      return NextResponse.json({ error: `Could not look up place (${result.reason})` }, { status });
    }
    const place = result.place;

    // Dedupe by placeId — admin creating a course that already exists is
    // probably a mis-click; return the existing one rather than duplicate.
    const existing = await db.collection("courses").where("placeId", "==", place.placeId).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ id: existing.docs[0].id, existing: true });
    }

    const baseSlug = slugifyCourseName(place.name);
    const stateSuffix = place.state?.toLowerCase() || place.country?.toLowerCase() || "us";
    let courseId = `${baseSlug}-${stateSuffix}`;
    if ((await db.collection("courses").doc(courseId).get()).exists) {
      courseId = `${baseSlug}-${place.placeId.slice(-6).toLowerCase()}`;
    }

    await db.collection("courses").doc(courseId).set({
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      city: place.city ?? null,
      state: place.state ?? null,
      country: place.country ?? null,
      formattedAddress: place.formattedAddress,
      placeId: place.placeId,
      placeTypes: place.types,
      featured: !!body.featured,
      claimStatus: "unclaimed",
      source: "places",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateTag(EMBED_CONFIG_TAG, "max");
    logger.info("admin_course_added_places", { courseId, placeId: place.placeId });
    return NextResponse.json({ id: courseId });
  }

  // ─── Legacy manual path ──────────────────────────────────────────
  try {
    const { name, city, state, lat, lon, holes, par, style, featured } = body as {
      name?: string; city?: string; state?: string; lat?: number; lon?: number;
      holes?: number; par?: number; style?: string; featured?: boolean;
    };
    if (!name || lat === undefined || lon === undefined) {
      return NextResponse.json({ error: "Provide either placeId or { name, lat, lon }" }, { status: 400 });
    }

    const slug = slugifyCourseName(name);
    const courseId = `${slug}-${state?.toLowerCase() || "us"}`;

    await db.collection("courses").doc(courseId).set({
      name,
      city: city || "",
      state: state || "",
      lat,
      lon,
      holes: holes ?? null,
      par: par ?? null,
      style: style ?? null,
      featured: featured || false,
      claimStatus: "unclaimed",
      source: "manual",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateTag(EMBED_CONFIG_TAG, "max");
    return NextResponse.json({ id: courseId });
  } catch (error) {
    logger.error("admin_course_create_failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}

// Update a course
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db.collection("courses").doc(id).update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateTag(EMBED_CONFIG_TAG, "max");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update course:", error);
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }
}

// Delete a course
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db.collection("courses").doc(id).delete();
    revalidateTag(EMBED_CONFIG_TAG, "max");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete course:", error);
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}
