import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  const { apiKey, courseId, event } = await req.json();

  if (!apiKey || !courseId || !event) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const now = new Date();
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const docPath = `analytics/${month}_${apiKey}_${courseId}`;

  const eventCapitalized = event.charAt(0).toUpperCase() + event.slice(1);

  await db.doc(docPath).set(
    {
      apiKey,
      courseId,
      month,
      [`total${eventCapitalized}s`]: FieldValue.increment(1),
      [`daily.${day}.${event}s`]: FieldValue.increment(1),
    },
    { merge: true }
  );

  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const apiKey = searchParams.get("apiKey");
  const monthsBack = parseInt(searchParams.get("months") || "1", 10);

  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  const snapshot = await db
    .collection("analytics")
    .where("apiKey", "==", apiKey)
    .where("month", "in", months)
    .orderBy("month", "desc")
    .get();

  const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return NextResponse.json({ analytics: docs });
}
