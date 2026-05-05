import Link from "next/link";
import type { Metadata } from "next";
import { Flag, ArrowRight } from "lucide-react";
import { CourseSearch } from "@/components/marketing/course-search";

export const metadata: Metadata = {
  title: "TeeWeathr — Honest Golf Weather Forecasts",
  description:
    "Find your golf course's real forecast. Hour-by-hour playability graded A through F — wind, rain, lightning, dew. National Weather Service data.",
};

// ─── Consumer Nav ────────────────────────────────────────────────
// Minimal header — public users want to search and go, not browse.

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-semibold text-zinc-900 tracking-tight">TeeWeathr</span>
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link
            href="/integration"
            className="hidden sm:inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            For golf courses
          </Link>
          <Link
            href="/login"
            className="text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Hero ────────────────────────────────────────────────────────
// Public-facing course search. Type, pick, see the forecast.

function SearchHero() {
  return (
    <section className="relative">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 400px at 50% -10%, rgba(16,185,129,0.18), transparent 60%), radial-gradient(700px 300px at 90% 20%, rgba(16,185,129,0.10), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-4xl px-5 pt-20 sm:pt-32 pb-20 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 uppercase tracking-wider mb-6">
          <Flag className="h-3 w-3" /> Honest weather for golfers
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-zinc-900 max-w-3xl mx-auto leading-[1.05]">
          Find your course&rsquo;s<br />
          <span className="text-emerald-600">real golf forecast.</span>
        </h1>
        <p className="mt-6 text-base sm:text-lg text-zinc-600 max-w-xl mx-auto leading-relaxed">
          Hour-by-hour playability — wind, rain, lightning, dew — graded A through F so you know whether to tee it up or stay home.
        </p>
        <div className="mt-10">
          <CourseSearch />
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          National Weather Service data · No location services required
        </p>
      </div>
    </section>
  );
}

// ─── Bridge to operator landing ──────────────────────────────────
// Discrete, single-line CTA below the fold for the rare visitor who's
// here representing a course rather than looking for weather.

function OperatorBridge() {
  return (
    <section className="border-t border-zinc-200">
      <div className="mx-auto max-w-6xl px-5 py-6 flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-zinc-500 text-center">
        <span>Are you a golf course wanting to integrate?</span>
        <Link
          href="/integration"
          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium transition-colors"
        >
          See how it works for courses <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-zinc-200 mt-auto">
      <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-zinc-800">TeeWeathr</span>
          <span className="text-[11px] text-zinc-500">· Honest weather for golfers</span>
        </div>
        <div className="flex items-center gap-5 text-xs text-zinc-500">
          <Link href="/integration" className="hover:text-zinc-800 transition-colors">For golf courses</Link>
          <Link href="/login" className="hover:text-zinc-800 transition-colors">Log in</Link>
        </div>
      </div>
      <p className="text-center text-[11px] text-zinc-400 pb-6">
        Weather data: U.S. National Weather Service.
      </p>
    </footer>
  );
}

// ─── Page ────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900">
      <Nav />
      <main className="flex-1 flex flex-col">
        <SearchHero />
        <OperatorBridge />
      </main>
      <Footer />
    </div>
  );
}
