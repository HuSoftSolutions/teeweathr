import { NextRequest } from "next/server";
import { db } from "@/lib/firebase/admin";

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
    // Find business by API key
    const bizSnap = await db
      .collection("businesses")
      .where("embedApiKey", "==", apiKey)
      .limit(1)
      .get();

    if (bizSnap.empty) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    const bizDoc = bizSnap.docs[0];
    const biz = bizDoc.data();
    const businessId = bizDoc.id;

    // Determine which course to show
    const courseIds: string[] = biz.courseIds || [];
    const targetCourseId = courseId || courseIds[0];

    if (!targetCourseId || !courseIds.includes(targetCourseId)) {
      return Response.json({ error: "Course not found for this business" }, { status: 404 });
    }

    // Fetch the course
    const courseDoc = await db.collection("courses").doc(targetCourseId).get();
    if (!courseDoc.exists) {
      return Response.json({ error: "Course not found" }, { status: 404 });
    }

    const course = courseDoc.data()!;
    const tier: string = biz.subscription?.tier || "free";

    // Fetch embed config if it exists
    const configId = `${businessId}_${targetCourseId}`;
    const configDoc = await db.collection("embedConfigs").doc(configId).get();
    const embedConfig = configDoc.exists ? configDoc.data() : {};

    // Build the embed URL params based on tier
    const embedParams: Record<string, string> = {
      lat: String(course.lat),
      lon: String(course.lon),
      name: course.name,
      holes: String(course.holes || 18),
      theme: (embedConfig?.theme as string) || "dark",
    };

    if (course.par) embedParams.par = String(course.par);
    if (embedConfig?.accent) embedParams.accent = embedConfig.accent;

    // Tier-based feature flags
    const features = {
      showBranding: tier === "free" || tier === "pro", // enterprise can hide
      showAds: tier === "free",                        // only free tier
      customColors: tier === "pro" || tier === "enterprise",
      customLogo: tier === "pro" || tier === "enterprise",
      whiteLabelable: tier === "enterprise",
    };

    // If enterprise with custom branding disabled
    if (tier === "enterprise" && embedConfig?.hideBranding) {
      embedParams.branding = "false";
    }

    return Response.json({
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
    });
  } catch (error) {
    console.error("Embed API error:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
