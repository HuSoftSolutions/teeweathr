import { Flag, Check, X } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TeeWeathr — Pricing",
  description: "Golf weather embeds for your course website. Free, Pro, and Enterprise plans.",
};

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with weather on your site",
    cta: "Contact us",
    highlight: false,
    features: [
      { label: "Embeddable weather widget", included: true },
      { label: "All embed formats (full, card, popup, banner)", included: true },
      { label: "Dark & light themes", included: true },
      { label: "1 course", included: true },
      { label: "\"Powered by TeeWeathr\" branding", included: true },
      { label: "Sponsor ad slot in widget", included: true },
      { label: "Custom accent colors", included: false },
      { label: "Logo upload", included: false },
      { label: "Analytics dashboard", included: false },
      { label: "Remove branding", included: false },
    ],
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For courses that want a polished presence",
    cta: "Get started",
    highlight: true,
    features: [
      { label: "Everything in Free", included: true },
      { label: "Ad-free widget", included: true },
      { label: "Custom accent colors", included: true },
      { label: "Logo upload", included: true },
      { label: "Up to 3 courses", included: true },
      { label: "Daily analytics (90-day history)", included: true },
      { label: "Subtle \"Powered by\" branding", included: true },
      { label: "Priority support", included: true },
      { label: "Remove branding", included: false },
      { label: "API access", included: false },
    ],
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    description: "For resort groups and multi-course operations",
    cta: "Contact us",
    highlight: false,
    features: [
      { label: "Everything in Pro", included: true },
      { label: "White-label (remove all branding)", included: true },
      { label: "Unlimited courses", included: true },
      { label: "API access (JSON endpoint)", included: true },
      { label: "Custom domain for embeds", included: true },
      { label: "Full analytics + export", included: true },
      { label: "Multi-user dashboard access", included: true },
      { label: "Dedicated onboarding", included: true },
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="mx-auto max-w-5xl px-6 pt-12 pb-4">
        <div className="flex items-center gap-2.5 mb-12">
          <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
              <Flag className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="text-base font-semibold tracking-tight">TeeWeathr</span>
          </a>
        </div>

        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Weather that helps golfers<br />
            <span className="text-zinc-500">show up, not stay home</span>
          </h1>
          <p className="text-lg text-zinc-400 mt-4 max-w-2xl mx-auto">
            Your weather app puts a rain icon on the day. Ours tells golfers it&apos;s actually an A+ morning.
            Embed TeeWeathr on your course website and stop losing tee times to bad forecasts.
          </p>
        </div>
      </header>

      {/* Tiers */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((tier) => (
            <div key={tier.name}
              className={`rounded-2xl border p-6 flex flex-col ${
                tier.highlight
                  ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                  : "border-zinc-800 bg-zinc-900/50"
              }`}>
              {tier.highlight && (
                <div className="flex justify-center -mt-9 mb-4">
                  <span className="rounded-full bg-emerald-500 px-4 py-1 text-xs font-bold text-white uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}

              <h2 className="text-xl font-bold">{tier.name}</h2>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className="text-zinc-500 text-sm">{tier.period}</span>
              </div>
              <p className="text-sm text-zinc-400 mt-2 mb-6">{tier.description}</p>

              <a href="mailto:hello@teeweathr.com"
                className={`block text-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors mb-6 ${
                  tier.highlight
                    ? "bg-emerald-500 text-white hover:bg-emerald-400"
                    : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                }`}>
                {tier.cta}
              </a>

              <div className="space-y-3 flex-1">
                {tier.features.map((feat) => (
                  <div key={feat.label} className="flex items-start gap-2.5">
                    {feat.included ? (
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-4 w-4 text-zinc-700 shrink-0 mt-0.5" />
                    )}
                    <span className={`text-sm ${feat.included ? "text-zinc-300" : "text-zinc-600"}`}>
                      {feat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Annual discount */}
        <p className="text-center text-sm text-zinc-500 mt-8">
          Annual plans available — save ~17%. Contact us for details.
        </p>
      </section>

      {/* Value prop */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">The problem we solve</h2>
          <p className="text-zinc-400 leading-relaxed">
            Weather apps show a rain icon when there&apos;s a 20% chance of showers at 5 AM.
            Your potential customers see that icon, assume the day is a wash, and stay home.
            Meanwhile your course sits empty on a perfectly playable day.
          </p>
          <p className="text-zinc-300 font-medium mt-4">
            TeeWeathr shows golfers the actual playing conditions — hour by hour, rated by what matters.
            Morning, midday, and afternoon each get a grade. An A+ morning with afternoon rain?
            That&apos;s a go. And now your customers know it.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-5xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold text-zinc-400">TeeWeathr</span>
          </div>
          <div className="flex gap-6 text-xs text-zinc-600">
            <a href="/" className="hover:text-zinc-400">Home</a>
            <a href="/pricing" className="hover:text-zinc-400">Pricing</a>
            <a href="mailto:hello@teeweathr.com" className="hover:text-zinc-400">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
