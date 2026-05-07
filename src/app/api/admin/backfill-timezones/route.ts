import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verifySession } from "@/lib/firebase/session";
import { db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { fetchNwsPoints } from "@/lib/nws-points";
import { EMBED_CONFIG_TAG } from "@/app/api/embed/[apiKey]/route";
import { logger } from "@/lib/logger";

// ─── Idempotent batched tz backfill ──────────────────────────────
//
// Walks course docs missing a `timezone` field, hits NWS /points/{lat},{lon}
// for each, and writes the IANA tz back. Designed to fit comfortably inside
// a serverless function's execution budget: each invocation processes at
// most BATCH_LIMIT docs and returns `remaining` so the admin re-triggers
// until it hits 0. Idempotent — only docs still missing the field are
// touched, so re-running is always safe.
//
// Throttled at ~5 req/sec to stay well inside NWS's "responsible use"
// guidance. Caller can override via `limit` (capped) or pass `dryRun: true`
// to preview without writing.
//
// POST /api/admin/backfill-timezones
//   { dryRun?: boolean, limit?: number }

// Per-invocation cap × per-call sleep keeps total wall time well below the
// 60s function ceiling (25 × 200ms = 5s of NWS work plus overhead).
const BATCH_LIMIT = 25;
const PAUSE_MS = 200;

export const maxDuration = 60;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get("__session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await verifySession(session);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let dryRun = false;
  let limit = BATCH_LIMIT;
  try {
    const body = await request.json();
    dryRun = !!body?.dryRun;
    if (typeof body?.limit === "number" && body.limit > 0 && body.limit <= BATCH_LIMIT) {
      limit = body.limit;
    }
  } catch {
    // empty body is fine
  }

  const snapshot = await db.collection("courses").get();
  const candidates = snapshot.docs
    .filter((doc) => {
      const data = doc.data();
      return !data.timezone && typeof data.lat === "number" && typeof data.lon === "number";
    })
    .slice(0, limit);

  const results: Array<{ id: string; tz?: string; status: "updated" | "skipped" | "failed" }> = [];
  let updated = 0;
  let failed = 0;

  for (const doc of candidates) {
    const data = doc.data();
    const points = await fetchNwsPoints(data.lat, data.lon);
    if (!points?.timeZone) {
      results.push({ id: doc.id, status: "failed" });
      failed++;
      await sleep(PAUSE_MS);
      continue;
    }
    if (dryRun) {
      results.push({ id: doc.id, tz: points.timeZone, status: "skipped" });
    } else {
      await doc.ref.update({
        timezone: points.timeZone,
        updatedAt: FieldValue.serverTimestamp(),
      });
      results.push({ id: doc.id, tz: points.timeZone, status: "updated" });
      updated++;
    }
    await sleep(PAUSE_MS);
  }

  if (updated > 0) {
    revalidateTag(EMBED_CONFIG_TAG, "max");
  }

  logger.info("backfill_timezones_run", {
    total: candidates.length,
    updated,
    failed,
    dryRun,
  });

  return NextResponse.json({
    ok: true,
    dryRun,
    totalScanned: snapshot.size,
    candidatesProcessed: candidates.length,
    updated,
    failed,
    remaining: snapshot.docs.filter((doc) => !doc.data().timezone).length - updated,
    results,
  });
}
