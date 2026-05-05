import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { isDemoApiKey } from "@/lib/demo";
import { logger } from "@/lib/logger";

// Helper for the GET path — kept narrow so a single failure mode
// (e.g. a missing Firestore composite index) returns a real JSON
// response instead of an empty 500 body that breaks client `.json()`.

const VALID_EVENTS = new Set(["view", "interaction", "referral"]);
const MAX_BATCH = 100;

type SinglePayload = { apiKey: string; courseId: string; event: string };
type BatchPayload = { apiKey: string; courseId: string; events: string[] };

function isBatch(p: SinglePayload | BatchPayload): p is BatchPayload {
  return Array.isArray((p as BatchPayload).events);
}

export async function POST(req: NextRequest) {
  let body: SinglePayload | BatchPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { apiKey, courseId } = body;
  if (!apiKey || !courseId) {
    return NextResponse.json({ error: "Missing apiKey or courseId" }, { status: 400 });
  }

  // Demo key: short-circuit before any Firestore work. Landing-page traffic
  // shouldn't pollute customer analytics or burn write quota.
  if (isDemoApiKey(apiKey)) {
    return new NextResponse(null, { status: 204 });
  }

  // Normalize single → batch shape.
  const rawEvents: string[] = isBatch(body) ? body.events : [body.event];
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    return NextResponse.json({ error: "No events" }, { status: 400 });
  }
  if (rawEvents.length > MAX_BATCH) {
    return NextResponse.json({ error: "Batch too large" }, { status: 400 });
  }

  // Tally counts; silently drop unknown event types so a bad client can't
  // pollute the doc with arbitrary fields.
  const counts: Record<string, number> = {};
  for (const e of rawEvents) {
    if (typeof e === "string" && VALID_EVENTS.has(e)) {
      counts[e] = (counts[e] || 0) + 1;
    }
  }
  if (Object.keys(counts).length === 0) {
    return NextResponse.json({ error: "No valid events" }, { status: 400 });
  }

  const now = new Date();
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const docPath = `analytics/${month}_${apiKey}_${courseId}`;

  // Build a single merged update — one Firestore write regardless of batch
  // size. FieldValue.increment lets multiple counters move in lockstep.
  const updates: Record<string, FirebaseFirestore.FieldValue | string> = {
    apiKey,
    courseId,
    month,
  };
  for (const [event, count] of Object.entries(counts)) {
    const cap = event.charAt(0).toUpperCase() + event.slice(1);
    updates[`total${cap}s`] = FieldValue.increment(count);
    updates[`daily.${day}.${event}s`] = FieldValue.increment(count);
  }

  await db.doc(docPath).set(updates, { merge: true });

  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const apiKey = searchParams.get("apiKey");
  const monthsBack = Math.max(1, Math.min(12, parseInt(searchParams.get("months") || "1", 10) || 1));

  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  try {
    const snapshot = await db
      .collection("analytics")
      .where("apiKey", "==", apiKey)
      .where("month", "in", months)
      .orderBy("month", "desc")
      .get();
    const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ analytics: docs });
  } catch (err) {
    // Firestore can throw FAILED_PRECONDITION here if the composite index
    // for (apiKey + month + orderBy month) hasn't been built yet, plus any
    // transient infra error. Either way, return a real JSON response so
    // the dashboard's .json() doesn't blow up on an empty body.
    logger.error("analytics_query_failed", {
      route: "/api/embed/analytics",
      apiKey,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ analytics: [], error: "analytics-temporarily-unavailable" });
  }
}
