import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe, PLANS } from "@/lib/stripe";
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

    const { plan, interval } = await request.json() as { plan: "pro" | "enterprise"; interval: "monthly" | "annual" };
    if (!plan || !interval || !PLANS[plan]?.[interval]) {
      return NextResponse.json({ error: "Invalid plan or interval" }, { status: 400 });
    }

    const bizRef = db.collection("businesses").doc(session.businessId);
    const bizSnap = await bizRef.get();
    const biz = bizSnap.data();

    if (!bizSnap.exists || !biz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    let stripeCustomerId = biz.subscription?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.email,
        name: biz.name,
        metadata: { businessId: session.businessId },
      });
      stripeCustomerId = customer.id;
      await bizRef.update({ "subscription.stripeCustomerId": stripeCustomerId });
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";
    const price = PLANS[plan][interval];

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/dashboard/subscription?success=true`,
      cancel_url: `${origin}/dashboard/subscription?canceled=true`,
      subscription_data: {
        trial_period_days: 14,
        metadata: { businessId: session.businessId },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[checkout] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
