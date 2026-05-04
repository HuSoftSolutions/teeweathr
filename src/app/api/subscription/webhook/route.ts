import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS } from "@/lib/stripe";
import { db } from "@/lib/firebase/admin";
import Stripe from "stripe";

export const runtime = "nodejs";

function getTierFromPriceId(priceId: string): string {
  for (const [plan, intervals] of Object.entries(PLANS)) {
    for (const [, id] of Object.entries(intervals as Record<string, string>)) {
      if (id === priceId) return plan;
    }
  }
  return "free";
}

function mapStripeStatus(status: string): string {
  switch (status) {
    case "active":
    case "trialing":
      return status;
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return status;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error("[webhook] Signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const businessId =
          session.metadata?.businessId ||
          (session.subscription
            ? (await stripe.subscriptions.retrieve(session.subscription as string))
                .metadata?.businessId
            : null);

        if (businessId) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          const priceId = subscription.items.data[0]?.price.id;
          const tier = getTierFromPriceId(priceId);

          await db.collection("businesses").doc(businessId).update({
            "subscription.tier": tier,
            "subscription.stripeCustomerId": session.customer as string,
            "subscription.stripeSubscriptionId": session.subscription as string,
            "subscription.status": "active",
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } };
        const rawSub = invoice.subscription;
        const subscriptionId = typeof rawSub === "string" ? rawSub : rawSub?.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const businessId = subscription.metadata?.businessId;
          if (businessId) {
            await db.collection("businesses").doc(businessId).update({
              "subscription.status": "active",
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const businessId = subscription.metadata?.businessId;
        if (businessId) {
          const priceId = subscription.items.data[0]?.price.id;
          const tier = getTierFromPriceId(priceId);
          const status = mapStripeStatus(subscription.status);

          await db.collection("businesses").doc(businessId).update({
            "subscription.tier": tier,
            "subscription.status": status,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const businessId = subscription.metadata?.businessId;
        if (businessId) {
          await db.collection("businesses").doc(businessId).update({
            "subscription.tier": "free",
            "subscription.status": "canceled",
            "subscription.stripeSubscriptionId": null,
          });
        }
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[webhook] Error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
