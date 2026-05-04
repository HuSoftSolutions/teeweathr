import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

export async function GET() {
  const now = new Date();
  const month = now.toISOString().slice(0, 7); // YYYY-MM

  const snapshot = await db
    .collection("analytics")
    .where("month", "==", month)
    .get();

  let totalViews = 0;
  let totalInteractions = 0;
  let totalReferrals = 0;

  const businessMap = new Map<string, { totalViews: number; totalInteractions: number; totalReferrals: number }>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const views = data.totalViews || 0;
    const interactions = data.totalInteractions || 0;
    const referrals = data.totalReferrals || 0;

    totalViews += views;
    totalInteractions += interactions;
    totalReferrals += referrals;

    const key = data.apiKey as string;
    const existing = businessMap.get(key) || { totalViews: 0, totalInteractions: 0, totalReferrals: 0 };
    existing.totalViews += views;
    existing.totalInteractions += interactions;
    existing.totalReferrals += referrals;
    businessMap.set(key, existing);
  }

  const businesses = Array.from(businessMap.entries()).map(([businessKey, stats]) => ({
    businessKey,
    ...stats,
  }));

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
