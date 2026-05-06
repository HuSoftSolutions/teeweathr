import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

interface BusinessRow {
  apiKey: string;
  businessId: string | null;
  businessName: string;
  courseNames: string[];
  totalViews: number;
  totalInteractions: number;
  totalReferrals: number;
}

export async function GET() {
  const now = new Date();
  const month = now.toISOString().slice(0, 7); // YYYY-MM

  // Pull this month's analytics docs.
  const snapshot = await db
    .collection("analytics")
    .where("month", "==", month)
    .get();

  let totalViews = 0;
  let totalInteractions = 0;
  let totalReferrals = 0;

  // Group analytics totals by apiKey first; we'll attach business name +
  // course names afterward via a single bulk businesses query.
  const byKey = new Map<string, { totalViews: number; totalInteractions: number; totalReferrals: number; courseIds: Set<string> }>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const views = data.totalViews || 0;
    const interactions = data.totalInteractions || 0;
    const referrals = data.totalReferrals || 0;

    totalViews += views;
    totalInteractions += interactions;
    totalReferrals += referrals;

    const key = data.apiKey as string;
    const courseId = data.courseId as string | undefined;
    const existing = byKey.get(key) ?? {
      totalViews: 0,
      totalInteractions: 0,
      totalReferrals: 0,
      courseIds: new Set<string>(),
    };
    existing.totalViews += views;
    existing.totalInteractions += interactions;
    existing.totalReferrals += referrals;
    if (courseId) existing.courseIds.add(courseId);
    byKey.set(key, existing);
  }

  // Resolve business names + course names. Single pass over businesses,
  // then a bulk fetch for every course we need to label.
  const businessesSnapshot = await db.collection("businesses").get();
  const bizByApiKey = new Map<string, { id: string; name: string; courseIds: string[] }>();
  const allCourseIds = new Set<string>();

  for (const doc of businessesSnapshot.docs) {
    const data = doc.data();
    const apiKey = data.embedApiKey as string | undefined;
    if (!apiKey) continue;
    const courseIds: string[] = Array.isArray(data.courseIds) ? data.courseIds : [];
    bizByApiKey.set(apiKey, {
      id: doc.id,
      name: data.name || data.email || doc.id,
      courseIds,
    });
    courseIds.forEach((id) => allCourseIds.add(id));
  }

  // Also include every courseId we saw on the analytics docs — covers
  // unmapped or stale business mappings so we still surface a name.
  for (const stats of byKey.values()) {
    stats.courseIds.forEach((id) => allCourseIds.add(id));
  }

  const courseDocs = await Promise.all(
    [...allCourseIds].map((id) => db.collection("courses").doc(id).get()),
  );
  const courseNameById = new Map<string, string>();
  for (const doc of courseDocs) {
    if (doc.exists) {
      const data = doc.data()!;
      courseNameById.set(doc.id, data.name || doc.id);
    }
  }

  const businesses: BusinessRow[] = Array.from(byKey.entries()).map(([apiKey, stats]) => {
    const biz = bizByApiKey.get(apiKey);
    // Prefer the analytics-doc courseIds (courses with actual events)
    // but fall back to the business's full course list if none recorded.
    const courseIds = stats.courseIds.size > 0 ? [...stats.courseIds] : (biz?.courseIds ?? []);
    const courseNames = courseIds
      .map((id) => courseNameById.get(id))
      .filter((n): n is string => Boolean(n));
    return {
      apiKey,
      businessId: biz?.id ?? null,
      businessName: biz?.name ?? "Unmapped business",
      courseNames,
      totalViews: stats.totalViews,
      totalInteractions: stats.totalInteractions,
      totalReferrals: stats.totalReferrals,
    };
  });

  businesses.sort((a, b) => b.totalViews - a.totalViews);

  return NextResponse.json({
    month,
    totals: {
      views: totalViews,
      interactions: totalInteractions,
      referrals: totalReferrals,
    },
    businesses,
  });
}
