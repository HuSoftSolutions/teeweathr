import { NextRequest } from "next/server";
import { db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// Assign a course to a business
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { courseId } = await request.json();

  if (!courseId) {
    return Response.json({ error: "courseId required" }, { status: 400 });
  }

  try {
    const batch = db.batch();

    // Add courseId to business's courseIds array
    batch.update(db.collection("businesses").doc(id), {
      courseIds: FieldValue.arrayUnion(courseId),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Mark the course as assigned to this business
    batch.update(db.collection("courses").doc(courseId), {
      claimedBy: id,
      claimStatus: "claimed",
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Course assignment error:", error);
    return Response.json({ error: "Failed to assign course" }, { status: 500 });
  }
}

// Unassign a course from a business
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { courseId } = await request.json();

  if (!courseId) {
    return Response.json({ error: "courseId required" }, { status: 400 });
  }

  try {
    const batch = db.batch();

    batch.update(db.collection("businesses").doc(id), {
      courseIds: FieldValue.arrayRemove(courseId),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.update(db.collection("courses").doc(courseId), {
      claimedBy: null,
      claimStatus: "unclaimed",
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Course unassignment error:", error);
    return Response.json({ error: "Failed to unassign course" }, { status: 500 });
  }
}
