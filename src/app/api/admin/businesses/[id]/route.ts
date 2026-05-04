import { NextRequest } from "next/server";
import { db } from "@/lib/firebase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const doc = await db.collection("businesses").doc(id).get();
    if (!doc.exists) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const data = doc.data()!;
    const business = {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
      updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    };

    // Fetch linked courses
    const courseIds: string[] = data.courseIds || [];
    const courses = [];
    for (const cid of courseIds) {
      const courseDoc = await db.collection("courses").doc(cid).get();
      if (courseDoc.exists) {
        courses.push({ id: courseDoc.id, ...courseDoc.data() });
      }
    }

    return Response.json({ business, courses });
  } catch (error) {
    console.error("Business detail error:", error);
    return Response.json({ error: "Failed to fetch business" }, { status: 500 });
  }
}
