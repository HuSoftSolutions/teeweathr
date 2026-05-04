import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { EMBED_CONFIG_TAG } from "@/app/api/embed/[apiKey]/route";

export async function GET() {
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

// Create a new course
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, city, state, lat, lon, holes, par, style, featured } = body;

    if (!name || lat === undefined || lon === undefined) {
      return NextResponse.json({ error: "name, lat, lon required" }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const courseId = `${slug}-${state?.toLowerCase() || "us"}`;

    await db.collection("courses").doc(courseId).set({
      name,
      city: city || "",
      state: state || "",
      lat,
      lon,
      holes: holes || 18,
      par: par || null,
      style: style || null,
      featured: featured || false,
      claimStatus: "unclaimed",
      source: "manual",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: courseId });
  } catch (error) {
    console.error("Failed to create course:", error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}

// Update a course
export async function PUT(request: NextRequest) {
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
