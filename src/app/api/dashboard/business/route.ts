import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/firebase/session";
import { db } from "@/lib/firebase/admin";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session")?.value;

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await verifySession(session);

    if (!user || user.role !== "business" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const businessDoc = await db.collection("businesses").doc(user.businessId).get();

    if (!businessDoc.exists) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const businessData = businessDoc.data()!;
    const business = {
      id: businessDoc.id,
      name: businessData.name || "",
      email: businessData.email || user.email,
      subscriptionTier: businessData.subscriptionTier || "free",
      embedApiKey: businessData.embedApiKey || "",
      courseIds: businessData.courseIds || [],
    };

    let courses: { id: string; name: string; city?: string; state?: string; holes?: number; lat?: number; lon?: number }[] = [];

    if (business.courseIds.length > 0) {
      const courseSnapshots = await Promise.all(
        business.courseIds.map((id: string) => db.collection("courses").doc(id).get())
      );
      courses = courseSnapshots
        .filter((snap) => snap.exists)
        .map((snap) => {
          const d = snap.data()!;
          return {
            id: snap.id,
            name: d.name || "",
            city: d.city,
            state: d.state,
            holes: d.holes,
            lat: d.lat,
            lon: d.lon,
          };
        });
    }

    return NextResponse.json({ business, courses });
  } catch (err) {
    console.error("Dashboard business API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
