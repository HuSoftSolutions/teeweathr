"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, X, CreditCard, ExternalLink, Loader2, Crown, Zap } from "lucide-react";

const plans = [
  {
    key: "free",
    name: "Free",
    price: 0,
    color: "zinc",
    features: [
      { text: "Embed widget", included: true },
      { text: "All forecast formats", included: true },
      { text: "Dark & light themes", included: true },
      { text: "1 course", included: true },
      { text: "TeeWeathr branding", included: true },
      { text: "Ad slot displayed", included: true },
      { text: "Custom colors", included: false },
      { text: "Analytics", included: false },
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 29,
    color: "emerald",
    features: [
      { text: "Ad-free widget", included: true },
      { text: "Custom brand colors", included: true },
      { text: "Custom logo upload", included: true },
      { text: "Up to 3 courses", included: true },
      { text: "Widget analytics", included: true },
      { text: "Subtle branding", included: true },
      { text: "API access", included: false },
      { text: "Custom domain", included: false },
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 99,
    color: "amber",
    features: [
      { text: "White-label widget", included: true },
      { text: "Unlimited courses", included: true },
      { text: "Full API access", included: true },
      { text: "Custom domain support", included: true },
      { text: "Priority support", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "SLA guarantee", included: true },
    ],
  },
];

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400",
  trialing: "bg-blue-500/10 text-blue-400",
  past_due: "bg-red-500/10 text-red-400",
  canceled: "bg-zinc-700/50 text-zinc-400",
};

export default function DashboardSubscription() {
  const searchParams = useSearchParams();
  const [business, setBusiness] = useState<{
    plan?: string;
    subscriptionStatus?: string;
    trialEnd?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setToast("Subscription activated successfully!");
    } else if (searchParams.get("canceled") === "true") {
      setToast("Checkout was canceled.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    fetch("/api/dashboard/business")
      .then((r) => r.json())
      .then((d) => setBusiness(d))
      .finally(() => setLoading(false));
  }, []);

  const currentPlan = business?.plan ?? "free";
  const subStatus = business?.subscriptionStatus;
  const trialEnd = business?.trialEnd;

  const handleUpgrade = async (plan: string) => {
    setActionLoading(plan);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: "monthly" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading("portal");
    try {
      const res = await fetch("/api/subscription/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setActionLoading(null);
    }
  };

  const planIndex = (key: string) => plans.findIndex((p) => p.key === key);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      {toast && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${searchParams.get("success") === "true" ? "border-emerald-800 bg-emerald-950/50 text-emerald-300" : "border-zinc-700 bg-zinc-900 text-zinc-300"}`}>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Subscription</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your plan and billing</p>
        </div>
        {currentPlan !== "free" && (
          <div className="flex items-center gap-3">
            {subStatus && (
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ${statusColors[subStatus] ?? statusColors.active}`}>
                {subStatus === "past_due" ? "Past Due" : subStatus}
              </span>
            )}
            <button onClick={handleManageBilling} disabled={actionLoading === "portal"} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50">
              {actionLoading === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Manage Billing
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {subStatus === "trialing" && trialEnd && (
        <div className="mb-6 rounded-lg border border-blue-800 bg-blue-950/30 px-4 py-3 text-sm text-blue-300">
          You are on a free trial. It ends on{" "}
          <span className="font-semibold">{new Date(trialEnd).toLocaleDateString()}</span>.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.key === currentPlan;
          const isUpgrade = planIndex(plan.key) > planIndex(currentPlan);
          const isDowngrade = planIndex(plan.key) < planIndex(currentPlan);

          const borderColor = isCurrent
            ? plan.color === "emerald" ? "border-emerald-600" : plan.color === "amber" ? "border-amber-600" : "border-zinc-600"
            : "border-zinc-800";
          const ringClass = isCurrent
            ? plan.color === "emerald" ? "ring-1 ring-emerald-600/30" : plan.color === "amber" ? "ring-1 ring-amber-600/30" : "ring-1 ring-zinc-600/30"
            : "";

          return (
            <div key={plan.key} className={`relative rounded-xl border bg-zinc-900/50 p-5 flex flex-col ${borderColor} ${ringClass}`}>
              {isCurrent && (
                <span className={`absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold ${plan.color === "emerald" ? "bg-emerald-500 text-white" : plan.color === "amber" ? "bg-amber-500 text-black" : "bg-zinc-600 text-zinc-100"}`}>
                  <Crown className="h-3 w-3" /> Current Plan
                </span>
              )}

              <div className="mb-4 mt-1">
                <h3 className="text-lg font-bold text-zinc-100">{plan.name}</h3>
                <div className="mt-1">
                  {plan.price === 0 ? (
                    <span className="text-2xl font-bold text-zinc-100">Free</span>
                  ) : (
                    <span className="text-2xl font-bold text-zinc-100">${plan.price}<span className="text-sm font-normal text-zinc-500">/mo</span></span>
                  )}
                </div>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2 text-sm">
                    {f.included ? (
                      <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.color === "emerald" ? "text-emerald-400" : plan.color === "amber" ? "text-amber-400" : "text-zinc-400"}`} />
                    ) : (
                      <X className="h-4 w-4 mt-0.5 shrink-0 text-zinc-700" />
                    )}
                    <span className={f.included ? "text-zinc-300" : "text-zinc-600"}>{f.text}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="rounded-lg bg-zinc-800/50 py-2 text-center text-sm font-medium text-zinc-500">
                  Current Plan
                </div>
              ) : isUpgrade ? (
                <button onClick={() => handleUpgrade(plan.key)} disabled={!!actionLoading} className={`inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${plan.color === "emerald" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-amber-600 hover:bg-amber-500 text-black"}`}>
                  {actionLoading === plan.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Upgrade
                </button>
              ) : isDowngrade ? (
                <button onClick={() => handleUpgrade(plan.key)} disabled={!!actionLoading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-50">
                  {actionLoading === plan.key && <Loader2 className="h-4 w-4 animate-spin" />}
                  Downgrade
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
