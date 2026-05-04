import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/firebase/admin";
import { verifySession } from "@/lib/firebase/session";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await verifySession(sessionCookie);
    if (!session || session.role !== "business" || !session.businessId) {
      return NextResponse.json({ error: "Business account required" }, { status: 403 });
    }

    const bizSnap = await db.collection("businesses").doc(session.businessId).get();
    const biz = bizSnap.data();

    if (!bizSnap.exists || !biz?.subscription?.stripeCustomerId) {
      return NextResponse.json({ error: "No billing account found" }, { status: 400 });
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: biz.subscription.stripeCustomerId,
      return_url: `${origin}/dashboard/subscription`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("[portal] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
