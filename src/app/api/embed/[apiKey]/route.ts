import { NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/firebase/admin";
import { logger } from "@/lib/logger";

// Tag for revalidating cached configs from dashboard mutations.
// Call revalidateTag(EMBED_CONFIG_TAG) after a customer updates branding,
// accent, course list, or tier — otherwise stale config can serve for up
// to CONFIG_REVALIDATE_SEC.
export const EMBED_CONFIG_TAG = "embed-config";
const CONFIG_REVALIDATE_SEC = 600; // 10 minutes — matches CDN s-maxage

type EmbedConfigData = {
  businessId: string;
  courseId: string;
  course: {
    name: string;
    lat: number;
    lon: number;
    holes?: number;
    par?: number;
    city?: string;
    state?: string;
  };
  tier: string;
  features: {
    showBranding: boolean;
    showAds: boolean;
    customColors: boolean;
    customLogo: boolean;
    whiteLabelable: boolean;
  };
  embedParams: Record<string, string>;
  embedUrl: string;
};

type EmbedConfigResult =
  | { kind: "ok"; data: EmbedConfigData }
  | { kind: "invalid-key" }
  | { kind: "course-not-found" };

// Pure Firestore-touching function — wrapped in unstable_cache below.
// Throws on internal errors (those bypass the cache so we don't memoize
// transient infra failures); returns a discriminated result for known
// outcomes (those are safe to cache).
async function loadEmbedConfigUncached(
  apiKey: string,
  requestedCourseId: string | null
): Promise<EmbedConfigResult> {
  const bizSnap = await db
    .collection("businesses")
    .where("embedApiKey", "==", apiKey)
    .limit(1)
    .get();

  if (bizSnap.empty) {
    return { kind: "invalid-key" };
  }

  const bizDoc = bizSnap.docs[0];
  const biz = bizDoc.data();
  const businessId = bizDoc.id;

  const courseIds: string[] = biz.courseIds || [];
  const targetCourseId = requestedCourseId || courseIds[0];

  if (!targetCourseId || !courseIds.includes(targetCourseId)) {
    return { kind: "course-not-found" };
  }

  const courseDoc = await db.collection("courses").doc(targetCourseId).get();
  if (!courseDoc.exists) {
    return { kind: "course-not-found" };
  }

  const course = courseDoc.data()!;
  const tier: string = biz.subscription?.tier || "free";

  const configId = `${businessId}_${targetCourseId}`;
  const configDoc = await db.collection("embedConfigs").doc(configId).get();
  const embedConfig = configDoc.exists ? configDoc.data() : {};

  const embedParams: Record<string, string> = {
    lat: String(course.lat),
    lon: String(course.lon),
    name: course.name,
    holes: String(course.holes || 18),
    theme: (embedConfig?.theme as string) || "dark",
  };

  if (course.par) embedParams.par = String(course.par);
  if (embedConfig?.accent) embedParams.accent = embedConfig.accent;

  const features = {
    showBranding: tier === "free" || tier === "pro",
    showAds: tier === "free",
    customColors: tier === "pro" || tier === "enterprise",
    customLogo: tier === "pro" || tier === "enterprise",
    whiteLabelable: tier === "enterprise",
  };

  if (tier === "enterprise" && embedConfig?.hideBranding) {
    embedParams.branding = "false";
  }

  return {
    kind: "ok",
    data: {
      businessId,
      courseId: targetCourseId,
      course: {
        name: course.name,
        lat: course.lat,
        lon: course.lon,
        holes: course.holes,
        par: course.par,
        city: course.city,
        state: course.state,
      },
      tier,
      features,
      embedParams,
      embedUrl: `/embed?${new URLSearchParams(embedParams).toString()}`,
    },
  };
}

const loadEmbedConfig = unstable_cache(
  loadEmbedConfigUncached,
  ["embed-config-v1"], // Bump suffix when changing the cache shape.
  {
    revalidate: CONFIG_REVALIDATE_SEC,
    tags: [EMBED_CONFIG_TAG],
  }
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ apiKey: string }> }
) {
  const { apiKey } = await params;
  const courseId = request.nextUrl.searchParams.get("course");

  if (!apiKey) {
    return Response.json({ error: "Missing API key" }, { status: 400 });
  }

  try {
    const result = await loadEmbedConfig(apiKey, courseId);

    if (result.kind === "invalid-key") {
      // Cache invalid keys briefly so attackers probing random keys hit our
      // Firestore once, not once per probe — but short enough that a customer
      // who just rotated their key isn't locked out.
      return Response.json(
        { error: "Invalid API key" },
        {
          status: 401,
          headers: { "Cache-Control": "public, s-maxage=60" },
        }
      );
    }

    if (result.kind === "course-not-found") {
      return Response.json(
        { error: "Course not found for this business" },
        {
          status: 404,
          headers: { "Cache-Control": "public, s-maxage=60" },
        }
      );
    }

    return Response.json(result.data, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    logger.error("embed_config_load_failed", {
      route: "/api/embed/[apiKey]",
      apiKey,
      courseId,
      err: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
