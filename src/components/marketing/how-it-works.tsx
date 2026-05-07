"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Search, MapPin, CheckCircle2, AlertTriangle, CloudLightning,
  Wind, CloudRain, Droplets, Thermometer,
  ChevronLeft, ChevronRight, X, HelpCircle, Flag,
} from "lucide-react";

// ─── Public walkthrough ─────────────────────────────────────────
// Modal-based, card-by-card explainer for first-time visitors.
// Five steps: welcome → search → verdict → grades → what's graded.

type Step = {
  title: string;
  body: string;
  visual: React.ReactNode;
};

const STEPS: Step[] = [
  {
    title: "Honest weather, made for golfers",
    body:
      "TeeWeathr translates raw National Weather Service data into something you can actually plan a round around — no fluff, no hype, no ad-driven spin.",
    visual: (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 uppercase tracking-wider">
          <Flag className="h-3 w-3" /> Honest weather for golfers
        </div>
        <p className="text-[11px] text-zinc-500">
          Source: U.S. National Weather Service
        </p>
      </div>
    ),
  },
  {
    title: "Find your course",
    body:
      "Type your course's name, city, or state. We pull from a network of integrated U.S. courses — when you pick one, we jump straight to its forecast.",
    visual: (
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <div className="w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-3 py-2.5 text-sm text-zinc-500">
            Pebble Beach
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-emerald-50">
            <MapPin className="h-4 w-4 text-zinc-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-900 truncate">Pebble Beach Golf Links</p>
              <p className="text-[11px] text-zinc-500 truncate">Pebble Beach, CA</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Read the day's verdict",
    body:
      "Every day gets a single, honest call: Go if it's a golf day, Mixed if you'll need to dodge weather, No-go if you should stay home.",
    visual: (
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-[11px] font-semibold text-emerald-800">Go</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
          <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-[11px] font-semibold text-amber-800">Mixed</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center">
          <CloudLightning className="h-5 w-5 text-zinc-500 mx-auto mb-1" />
          <p className="text-[11px] font-semibold text-zinc-700">No-go</p>
        </div>
      </div>
    ),
  },
  {
    title: "Hourly playability grades",
    body:
      "Each time block of the day gets a letter grade — A through F. We weigh wind, rain, lightning, and morning dew so you can pick the best window to tee off.",
    visual: (
      <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
        {[
          { time: "Morning", grade: "A", color: "text-emerald-500", note: "Calm, clear" },
          { time: "Midday", grade: "B", color: "text-lime-500", note: "Light breeze" },
          { time: "Afternoon", grade: "D", color: "text-orange-500", note: "Gusty, scattered showers" },
        ].map((row) => (
          <div key={row.time} className="flex items-center gap-3 px-3 py-2.5">
            <span className={`text-xl font-bold w-6 text-center ${row.color}`}>{row.grade}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-900">{row.time}</p>
              <p className="text-[11px] text-zinc-500">{row.note}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "What we grade",
    body:
      "We pull every signal that actually affects a round and weigh them against each other — so a breezy day with no rain still grades better than a calm one with thunderstorms.",
    visual: (
      <div className="grid grid-cols-2 gap-2">
        {[
          { Icon: Wind, label: "Wind & gusts" },
          { Icon: CloudRain, label: "Rain chance" },
          { Icon: CloudLightning, label: "Lightning risk" },
          { Icon: Droplets, label: "Morning dew" },
          { Icon: Thermometer, label: "Temperature" },
          { Icon: CheckCircle2, label: "Daylight window" },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <Icon className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-xs text-zinc-700">{label}</span>
          </div>
        ))}
      </div>
    ),
  },
];

const SEEN_KEY = "teeweathr-public-walkthrough-seen";

export function HowItWorks() {
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
      // Once dismissed (X, Esc, outside-click, or "Got it"), don't auto-open
      // again. Manual trigger always works regardless.
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
            <HelpCircle className="h-3.5 w-3.5" />
            How it works
          </button>
        )}
      />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white shadow-2xl outline-none transition duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
        >
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
            <Dialog.Title className="text-lg font-semibold tracking-tight text-zinc-900">
              {s.title}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-zinc-600">
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
            <span className="text-[11px] text-zinc-400">
              {step + 1} of {STEPS.length}
            </span>
            {isLast ? (
              <Dialog.Close
                render={(props) => (
                  <button
                    {...props}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                  >
                    Got it
                  </button>
                )}
              />
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
