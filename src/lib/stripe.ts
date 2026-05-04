import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export const PLANS = {
  pro: {
    monthly: process.env.STRIPE_PRO_PRICE_ID || "",
    annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || "",
  },
  enterprise: {
    monthly: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    annual: process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID || "",
  },
} as const;
