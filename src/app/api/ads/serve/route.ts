import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";

export async function GET() {
  const snapshot = await db
    .collection("adCreatives")
    .where("active", "==", true)
    .get();

  if (snapshot.empty) {
    return NextResponse.json({ ad: null });
  }

  const creatives = snapshot.docs.map((doc) => doc.data());

  // Weighted random selection
  const totalWeight = creatives.reduce((sum, c) => sum + (c.weight || 1), 0);
  let rand = Math.random() * totalWeight;
  let selected = creatives[0];

  for (const creative of creatives) {
    rand -= creative.weight || 1;
    if (rand <= 0) {
      selected = creative;
      break;
    }
  }

  return NextResponse.json({
    ad: {
      sponsor: selected.sponsor,
      imageUrl: selected.imageUrl || null,
      clickUrl: selected.clickUrl,
      text: selected.text,
    },
  });
}
