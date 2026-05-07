"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import {
  Check, X, CheckCircle2, CloudRain,
  ArrowRight, ChevronLeft, ChevronRight, Code2, Flag,
  Sparkles, BarChart3, ShieldCheck, Clock,
  Monitor, Smartphone, MessageSquare, BellRing, PanelBottomClose,
} from "lucide-react";

// ─── Operator walkthrough ───────────────────────────────────────
// Salesy modal tour for golf-course operators arriving at /integration.
// Mirrors the on-page "Comparison" → "Embed" → "Pricing" arc but in a
// 60-second skim that ends with a clear CTA to sign up.

type Step = {
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  visual: React.ReactNode;
};

// ─── Embed format thumbnails ────────────────────────────────────
// Stylized mini-mockups of each embed shape — communicates the layout
// without needing pixel-perfect renders.

function FormatCard({
  Icon,
  name,
  blurb,
  preview,
}: {
  Icon: React.ElementType;
  name: string;
  blurb: string;
  preview: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3 w-3 text-emerald-600 shrink-0" />
        <span className="text-[11px] font-semibold text-zinc-800">{name}</span>
      </div>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 h-14 overflow-hidden relative">
        {preview}
      </div>
      <p className="mt-1.5 text-[10px] text-zinc-500 leading-tight">{blurb}</p>
    </div>
  );
}

function EmbedFormatsGrid() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <FormatCard
        Icon={Monitor}
        name="Full section"
        blurb="A dedicated weather page or hero block."
        preview={
          <div className="p-1.5 h-full">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] font-bold text-emerald-600">A-</span>
              <span className="h-0.5 flex-1 bg-zinc-200 rounded" />
            </div>
            <div className="space-y-0.5">
              <div className="h-1 w-full bg-zinc-200 rounded" />
              <div className="h-1 w-5/6 bg-zinc-200 rounded" />
              <div className="h-1 w-4/6 bg-zinc-200 rounded" />
            </div>
          </div>
        }
      />
      <FormatCard
        Icon={Smartphone}
        name="Compact card"
        blurb="Sidebar or widget-sized fixed card."
        preview={
          <div className="absolute inset-1.5 rounded border border-zinc-300 bg-white p-1 flex items-center gap-1">
            <span className="text-base font-bold text-emerald-600 leading-none">A-</span>
            <div className="flex-1 space-y-0.5">
              <div className="h-1 bg-zinc-200 rounded" />
              <div className="h-0.5 bg-zinc-100 rounded w-2/3" />
            </div>
          </div>
        }
      />
      <FormatCard
        Icon={MessageSquare}
        name="Corner popup"
        blurb="Floating chat-style button on every page."
        preview={
          <>
            <div className="absolute top-1 left-1 right-1 space-y-0.5">
              <div className="h-0.5 w-3/4 bg-zinc-200 rounded" />
              <div className="h-0.5 w-1/2 bg-zinc-100 rounded" />
            </div>
            <div className="absolute bottom-1 right-1 px-1.5 py-1 rounded-full bg-emerald-600 text-white text-[8px] font-bold leading-none flex items-center gap-1">
              <Flag className="h-2 w-2" />
              <span>A-</span>
            </div>
          </>
        }
      />
      <FormatCard
        Icon={BellRing}
        name="Top banner"
        blurb="Persistent strip across every page."
        preview={
          <>
            <div className="bg-emerald-600 text-white text-[8px] font-bold px-1.5 py-1 flex items-center gap-1">
              <Flag className="h-2 w-2" />
              <span>A-</span>
              <span className="font-medium">Pebble Beach · Mostly clear</span>
            </div>
            <div className="p-1 space-y-0.5">
              <div className="h-0.5 w-2/3 bg-zinc-200 rounded" />
              <div className="h-0.5 w-1/2 bg-zinc-100 rounded" />
            </div>
          </>
        }
      />
      <FormatCard
        Icon={PanelBottomClose}
        name="Inline badge"
        blurb="Tiny grade pill anywhere in your copy."
        preview={
          <div className="p-1.5 text-[9px] leading-tight text-zinc-500">
            Today is{" "}
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold align-middle">
              A- · 64°
            </span>
            {" "}— book a tee time online.
          </div>
        }
      />
      <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 p-2.5 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="h-3 w-3 text-emerald-600 shrink-0" />
          <span className="text-[11px] font-semibold text-emerald-700">+ your brand</span>
        </div>
        <p className="text-[10px] text-zinc-600 leading-tight">
          Light or dark theme. Custom accent color. Your logo on Pro.
        </p>
      </div>
    </div>
  );
}

const STEPS: Step[] = [
  // 1. The hook — same forecast, two outcomes (mirrors the screenshot)
  {
    eyebrow: "The problem",
    title: "Same forecast. Two very different decisions.",
    body: (
      <>
        Saturday at 9 a.m. A scattered shower passes through at 2 p.m. Here&rsquo;s
        what each tool tells your golfer.
      </>
    ),
    visual: (
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-red-200 bg-red-50/40 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <X className="h-3 w-3 text-red-600" />
            <p className="text-[11px] font-semibold text-red-700">Generic weather app</p>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <CloudRain className="h-6 w-6 text-blue-500 shrink-0" />
            <div>
              <p className="text-lg font-bold text-zinc-900 leading-none">70%</p>
              <p className="text-[10px] text-zinc-500">all day</p>
            </div>
          </div>
          <div className="pt-2 border-t border-red-100">
            <p className="text-[11px] font-medium text-red-700">Golfer cancels.</p>
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
              Four rounds at $85 — gone. The shower lasted 40 minutes.
            </p>
          </div>
        </div>
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Check className="h-3 w-3 text-emerald-600" />
            <p className="text-[11px] font-semibold text-emerald-700">TeeWeathr</p>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-[11px] font-medium text-zinc-800 flex-1 leading-tight">
              Mostly playable — pause around 2 p.m.
            </p>
            <span className="text-lg font-bold text-emerald-600">B+</span>
          </div>
          <div className="pt-2 border-t border-emerald-100">
            <p className="text-[11px] font-medium text-emerald-700">Books 9 a.m. tee.</p>
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
              You keep the round. They finish before the shower.
            </p>
          </div>
        </div>
      </div>
    ),
  },

  // 2. ROI — quantify the impact
  {
    eyebrow: "The math",
    title: "Every cancellation is a round you may have kept.",
    body: (
      <>
        Generic forecasts cost courses real money every weekend. TeeWeathr
        gives golfers a reason to say <span className="font-semibold text-zinc-900">yes</span> — instead
        of a reason to stay home.
      </>
    ),
    visual: (
      <div className="grid grid-cols-2 gap-2">
        {[
          { stat: "4", label: "rounds saved · one wet morning" },
          { stat: "$340", label: "kept revenue at $85/round" },
          { stat: "17×", label: "Pro plan paid for, that morning" },
          { stat: "Weekly", label: "this happens, all summer long" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-2xl font-bold text-emerald-600 leading-none">{s.stat}</p>
            <p className="mt-1.5 text-[11px] text-zinc-500 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>
    ),
  },

  // 3. Embed formats — flexibility story
  {
    eyebrow: "On your site",
    title: "Five ways to fit any layout.",
    body: (
      <>
        One snippet, five form factors. Drop a tiny grade badge in your header,
        a full forecast on your tee-time page, or a floating popup on every
        page — same data, sized for the space you give it.
      </>
    ),
    visual: <EmbedFormatsGrid />,
  },

  // 4. Install — kill the technical objection
  {
    eyebrow: "Setup",
    title: "Live on your site in 30 seconds.",
    body: (
      <>
        One <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">&lt;iframe&gt;</span> tag.
        Squarespace, Wix, WordPress, or custom — anywhere you can paste HTML.
        Hourly auto-updates from the National Weather Service. No plugin, no
        developer, no maintenance.
      </>
    ),
    visual: (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[
            { n: 1, label: "Add your course" },
            { n: 2, label: "Copy snippet" },
            { n: 3, label: "Paste it" },
          ].map((s) => (
            <div key={s.n} className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-center">
              <p className="text-base font-bold text-emerald-600 leading-none">{s.n}</p>
              <p className="mt-1 text-[10px] text-zinc-600 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-zinc-800 bg-zinc-950">
            <Code2 className="h-3 w-3 text-zinc-500" />
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">Embed snippet</span>
          </div>
          <pre className="px-3 py-2 text-[10px] text-zinc-200 font-mono leading-snug overflow-x-auto">
{`<iframe src="https://teeweathr.com/embed?key=..."
  width="100%" height="320"></iframe>`}
          </pre>
        </div>
      </div>
    ),
  },

  // 5. Pricing teaser
  {
    eyebrow: "Pricing",
    title: "Pays for itself in a single weekend.",
    body: (
      <>
        Start free, no card. Upgrade to Pro when you&rsquo;re ready to drop the
        ads, match your brand, and unlock 90-day analytics.
      </>
    ),
    visual: (
      <div className="grid grid-cols-3 gap-2">
        {[
          { name: "Free", price: "$0", note: "Ad-supported", featured: false },
          { name: "Pro", price: "$19.99", note: "Branded · ad-free", featured: true },
          { name: "Multi", price: "Custom", note: "Resorts · groups", featured: false },
        ].map((t) => (
          <div
            key={t.name}
            className={`rounded-xl p-3 text-center ${
              t.featured
                ? "border-2 border-emerald-500 bg-emerald-50/50"
                : "border border-zinc-200 bg-white"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-700">{t.name}</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 leading-none">{t.price}</p>
            <p className="mt-1.5 text-[10px] text-zinc-500 leading-tight">{t.note}</p>
          </div>
        ))}
      </div>
    ),
  },

  // 6. CTA — close
  {
    eyebrow: "Ready?",
    title: "Stop letting Weather.com decide when your tee sheet empties.",
    body: (
      <>
        Free tier, no card required. Pro is $19.99/mo and pays for itself the
        first time you keep a Saturday morning that would&rsquo;ve been written
        off.
      </>
    ),
    visual: (
      <div className="grid grid-cols-2 gap-2">
        {[
          { Icon: Clock, label: "30-sec install" },
          { Icon: Sparkles, label: "Branded for your course" },
          { Icon: BarChart3, label: "Built-in analytics" },
          { Icon: ShieldCheck, label: "NWS data, hourly" },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <Icon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="text-[11px] text-zinc-700">{label}</span>
          </div>
        ))}
      </div>
    ),
  },
];

const SEEN_KEY = "teeweathr-operator-walkthrough-seen";

export function OperatorWalkthrough() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-open on first visit. Brief delay so it doesn't feel like an
  // interrupt the moment the page paints.
  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Skipping or finishing both count as "seen" — manual trigger
      // still re-opens it any time after.
      try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
      setTimeout(() => setStep(0), 200);
    }
  }

  const s = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        render={(props) => (
          <button
            {...props}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Quick tour
          </button>
        )}
      />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-zinc-900/50 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white shadow-2xl outline-none transition duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-6 bg-emerald-600" : i < step ? "w-1.5 bg-emerald-300" : "w-1.5 bg-zinc-200"
                  }`}
                />
              ))}
            </div>
            <Dialog.Close
              render={(props) => (
                <button
                  {...props}
                  aria-label="Close"
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            />
          </div>

          {/* Body */}
          <div className="px-5 py-5">
            <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold mb-1.5">
              {s.eyebrow}
            </p>
            <Dialog.Title className="text-xl font-bold tracking-tight text-zinc-900 leading-tight">
              {s.title}
            </Dialog.Title>
            <Dialog.Description
              render={<div />}
              className="mt-2 text-sm leading-relaxed text-zinc-600"
            >
              {s.body}
            </Dialog.Description>
            <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
              {s.visual}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-zinc-100 bg-zinc-50/40 rounded-b-2xl">
            {isFirst ? (
              <Dialog.Close
                render={(props) => (
                  <button
                    {...props}
                    className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
                  >
                    Skip
                  </button>
                )}
              />
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            {!isLast && (
              <span className="text-[11px] text-zinc-400">
                {step + 1} of {STEPS.length}
              </span>
            )}
            {isLast ? (
              <div className="flex items-center gap-2">
                <Dialog.Close
                  nativeButton={false}
                  render={(props) => (
                    <Link
                      {...props}
                      href="/"
                      className="inline-flex items-center text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors px-2 py-1.5"
                    >
                      Back to home
                    </Link>
                  )}
                />
                <Dialog.Close
                  nativeButton={false}
                  render={(props) => (
                    <Link
                      {...props}
                      href="/signup"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      Embed it <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
