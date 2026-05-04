import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verifySession } from "@/lib/firebase/session";
import { db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { EMBED_CONFIG_TAG } from "@/app/api/embed/[apiKey]/route";
import { logger } from "@/lib/logger";

const ALLOWED_THEMES = new Set(["dark", "light"]);
const ALLOWED_ACCENTS = new Set(["default", "blue", "purple", "red", "orange", "zinc"]);

type SavePayload = {
  courseId: string;
  theme?: string;
  accent?: string;
  hideBranding?: boolean;
};

// PATCH so the verb matches the partial-update semantics. Saves a customer's
// embed-config doc and immediately busts the embed-config cache so the next
// keyed embed load reflects the new branding without waiting for the 10-min
// CDN/Data Cache TTL.
export async function PATCH(request: NextRequest) {
  let body: SavePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const session = cookieStore.get("__session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await verifySession(session);
  if (!user || user.role !== "business" || !user.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { courseId, theme, accent, hideBranding } = body;
  if (!courseId || typeof courseId !== "string") {
    return NextResponse.json({ error: "courseId required" }, { status: 400 });
  }

  if (theme !== undefined && !ALLOWED_THEMES.has(theme)) {
    return NextResponse.json({ error: `theme must be one of ${[...ALLOWED_THEMES].join(", ")}` }, { status: 400 });
  }
  if (accent !== undefined && !ALLOWED_ACCENTS.has(accent)) {
    return NextResponse.json({ error: `accent must be one of ${[...ALLOWED_ACCENTS].join(", ")}` }, { status: 400 });
  }

  try {
    // Authorize: only the business that owns this courseId can write to its
    // embed config.
    const bizDoc = await db.collection("businesses").doc(user.businessId).get();
    if (!bizDoc.exists) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    const biz = bizDoc.data()!;
    const courseIds: string[] = biz.courseIds || [];
    if (!courseIds.includes(courseId)) {
      return NextResponse.json({ error: "Course not assigned to your business" }, { status: 403 });
    }

    // hideBranding is enterprise-only — silently ignore for other tiers
    // rather than 400, so a stale UI on a downgraded plan doesn't error.
    const tier: string = biz.subscription?.tier || "free";
    const allowHideBranding = tier === "enterprise";

    const updates: Record<string, unknown> = {
      businessId: user.businessId,
      courseId,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (theme !== undefined) updates.theme = theme;
    if (accent !== undefined) updates.accent = accent;
    if (hideBranding !== undefined && allowHideBranding) {
      updates.hideBranding = !!hideBranding;
    }

    const docId = `${user.businessId}_${courseId}`;
    await db.collection("embedConfigs").doc(docId).set(updates, { merge: true });

    // Bust every cached embed config so the customer sees their change on
    // the next render — coarse but correct, and config saves are rare.
    revalidateTag(EMBED_CONFIG_TAG, "max");

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("dashboard_embed_config_save_failed", {
      route: "/api/dashboard/embed-config",
      businessId: user.businessId,
      courseId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
