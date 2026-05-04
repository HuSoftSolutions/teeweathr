import Link from "next/link";
import {
  Flag, ArrowRight, Check, X, ShieldX, CheckCircle2, AlertTriangle,
  Cloud, Sun, CloudSun, CloudRain, Wind, Code2, BarChart3,
  Palette, Zap, Smartphone, ShieldCheck,
} from "lucide-react";
import { LiveTry } from "@/components/marketing/live-try";
import { DEMO_API_KEY } from "@/lib/demo";

// ─── Nav ─────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-semibold text-zinc-900 tracking-tight">TeeWeathr</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-600">
          <a href="#how-it-works" className="hover:text-zinc-900 transition-colors">How it works</a>
          <a href="#embed" className="hover:text-zinc-900 transition-colors">Embed</a>
          <Link href="/pricing" className="hover:text-zinc-900 transition-colors">Pricing</Link>
          <Link href="/forecast" className="hover:text-zinc-900 transition-colors">Live demo</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden sm:inline-block text-sm text-zinc-600 hover:text-zinc-900 transition-colors px-3 py-1.5">
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors px-3.5 py-1.5 rounded-md"
          >
            Embed it
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Hero ────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 400px at 50% -10%, rgba(16,185,129,0.18), transparent 60%), radial-gradient(700px 300px at 90% 20%, rgba(16,185,129,0.10), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-5 pt-16 sm:pt-24 pb-12 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 uppercase tracking-wider mb-6">
          <Flag className="h-3 w-3" /> Built for golf courses
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-zinc-900 max-w-4xl mx-auto leading-[1.05]">
          Golf weather.<br />
          <span className="text-zinc-400">Not weather-app weather.</span>
        </h1>
        <p className="mt-6 text-base sm:text-lg text-zinc-600 max-w-2xl mx-auto leading-relaxed">
          Generic forecasts say <span className="text-zinc-900 font-medium">&ldquo;70% rain all day&rdquo;</span> for a thirty-minute morning shower. Golfers cancel. Your tee sheet empties.
          <span className="text-zinc-900 font-medium"> TeeWeathr</span> tells the truth — a golf-specific A–F grade so the rounds that should get played, get played.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors px-5 py-3 rounded-lg shadow-sm"
          >
            Embed on your course site <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#try-it"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 px-5 py-3 rounded-lg border border-zinc-300 hover:border-zinc-400 bg-white transition-colors"
          >
            Try it on a real course
          </a>
        </div>
        <p className="mt-5 text-xs text-zinc-500">
          National Weather Service data · 30-second install · Free tier available
        </p>
      </div>
    </section>
  );
}

// ─── Live Try ────────────────────────────────────────────────────

function TrySection() {
  return (
    <section id="try-it" className="mx-auto max-w-6xl px-5 pb-20">
      <div className="mb-6 text-center">
        <p className="text-[11px] uppercase tracking-wider text-emerald-600 font-semibold mb-1.5">Live</p>
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-900">See your course&rsquo;s grade right now</h2>
        <p className="text-sm text-zinc-600 mt-1.5">Powered by the same engine your golfers will see.</p>
      </div>
      <LiveTry />
    </section>
  );
}

// ─── Comparison ──────────────────────────────────────────────────

function Comparison() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 border-t border-zinc-200">
      <div className="text-center mb-12">
        <p className="text-[11px] uppercase tracking-wider text-emerald-600 font-semibold mb-2">The problem</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 max-w-3xl mx-auto leading-tight">
          The same forecast. Two very different decisions.
        </h2>
        <p className="mt-4 text-zinc-600 max-w-2xl mx-auto">
          Saturday at 9 a.m. A scattered shower passes through at 2 p.m. Here&rsquo;s what each tool tells your golfer.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Weather Channel side */}
        <div className="rounded-2xl border border-red-200 bg-red-50/30 p-6">
          <div className="flex items-center gap-2 mb-4">
            <X className="h-4 w-4 text-red-600" />
            <p className="text-sm font-semibold text-red-700">Generic weather app</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-zinc-800">
              <CloudRain className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">70%</p>
                <p className="text-xs text-zinc-500">Chance of rain · all day</p>
              </div>
            </div>
            <div className="text-sm text-zinc-600 space-y-1.5 pt-2">
              <p>Showers likely. Cloudy. High 68°.</p>
              <p>Wind 12 mph from the south.</p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-red-100">
            <p className="text-sm text-red-700 font-medium">Golfer cancels.</p>
            <p className="text-xs text-zinc-500 mt-1">You lose four rounds at $85. The shower lasted forty minutes.</p>
          </div>
        </div>

        {/* TeeWeathr side */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Check className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700">TeeWeathr</p>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-zinc-800">Mostly playable — pause around 2 p.m.</p>
            <span className="ml-auto text-3xl font-bold text-emerald-600">B+</span>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100">
            {[
              { name: "Morning", time: "7–11a", grade: "A", color: "text-emerald-600", note: "Cool, dry, light wind" },
              { name: "Midday", time: "11a–1p", grade: "A-", color: "text-emerald-600", note: "Warming up" },
              { name: "Afternoon", time: "1–5p", grade: "C", color: "text-amber-600", note: "Scattered shower 2–3p" },
              { name: "Evening", time: "5–8p", grade: "B", color: "text-emerald-600", note: "Clearing, breezy" },
            ].map((b) => (
              <div key={b.name} className="flex items-center gap-3 px-3 py-2.5">
                <span className={`text-lg font-bold w-8 text-center ${b.color}`}>{b.grade}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-800">{b.name}</span>
                    <span className="text-[11px] text-zinc-500">{b.time}</span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{b.note}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-emerald-100">
            <p className="text-sm text-emerald-700 font-medium">Golfer books a 9 a.m. tee time.</p>
            <p className="text-xs text-zinc-500 mt-1">You keep the round. They finish before the shower.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Golf-specific scoring",
    body:
      "Wind, precip, temperature, lightning risk, dew — all weighted the way golfers actually feel them. Not the way a TV weatherperson reads them.",
  },
  {
    icon: AlertTriangle,
    title: "Time-block intelligence",
    body:
      "Morning, midday, afternoon, evening — each gets its own grade. Your golfers find the playable window instead of writing off the whole day.",
  },
  {
    icon: Zap,
    title: "30-second install",
    body:
      "Paste a one-line snippet into your site. No plugins, no developer required, no maintenance. Updates hourly from NWS.",
  },
  {
    icon: Palette,
    title: "Branded for your course",
    body:
      "Pro tier matches your accent color, drops your logo, and removes ads — your weather widget feels like part of your site.",
  },
  {
    icon: BarChart3,
    title: "Analytics built in",
    body:
      "See views, clicks, and golfer interactions. Know exactly how the widget contributes to traffic — and to retained tee times.",
  },
  {
    icon: Smartphone,
    title: "Looks great everywhere",
    body:
      "Four embed sizes. Drop a tiny badge in your header, a full forecast in your booking flow, or anything in between.",
  },
];

function Features() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 border-t border-zinc-200">
      <div className="text-center mb-12">
        <p className="text-[11px] uppercase tracking-wider text-emerald-600 font-semibold mb-2">Why it works</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 max-w-3xl mx-auto leading-tight">
          Built for the way golfers think about weather.
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:shadow-sm transition-all">
            <f.icon className="h-5 w-5 text-emerald-600 mb-3" />
            <p className="text-base font-semibold text-zinc-900 mb-1.5">{f.title}</p>
            <p className="text-sm text-zinc-600 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Embed Showcase (light theme variant of the widget) ──────────

function MicroMock() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden w-full max-w-[320px]">
      <div className="flex items-center px-3 py-2 gap-2">
        <span className="text-2xl font-bold text-emerald-600">A</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-zinc-800 truncate">Pebble Beach Golf Links</p>
          <p className="text-[9px] text-zinc-500 truncate">Excellent · 64° · Sunny</p>
        </div>
        <span className="text-[10px] text-zinc-700">Today</span>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1 border-t border-zinc-200 bg-zinc-50">
        <span className="text-[8px] font-semibold uppercase tracking-wider text-zinc-500">Ad</span>
        <span className="text-[10px] text-zinc-700 truncate flex-1">15% off range balls this weekend</span>
        <span className="text-[9px] text-emerald-600">Pro Shop ›</span>
      </div>
    </div>
  );
}

function CompactMock() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-3 w-full max-w-[320px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl font-bold text-emerald-600">A-</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-800 truncate">Pebble Beach</p>
          <p className="text-[10px] text-zinc-500">Mostly clear, light wind</p>
        </div>
      </div>
      <div className="flex border-b border-zinc-200 mb-2">
        {["Tod", "Tmrw", "Sat", "Sun", "Mon"].map((d, i) => (
          <div key={d} className={`flex-1 py-1 flex flex-col items-center gap-0.5 ${i === 0 ? "border-b-2 border-emerald-600" : ""}`}>
            <span className="text-[8px] uppercase tracking-wider text-zinc-500">{d}</span>
            <span className="text-[11px] font-bold text-zinc-800">{["A", "B", "B+", "A", "C"][i]}</span>
            <span className="text-[10px] font-mono text-zinc-500">{[64, 67, 70, 68, 62][i]}°</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-zinc-500 mb-2">Best: Morning · 64°</p>
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-zinc-100">
        <div className="h-7 w-7 rounded bg-emerald-600/10 flex items-center justify-center shrink-0">
          <Flag className="h-3.5 w-3.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium leading-tight truncate text-zinc-800">15% off range balls this weekend</p>
          <p className="text-[8px] truncate text-zinc-500">Pro Shop · Sponsored</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-emerald-600">›</span>
      </div>
    </div>
  );
}

function MediumMock() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-4 w-full max-w-[420px]">
      <div className="flex items-center gap-2 mb-3">
        <Flag className="h-3.5 w-3.5 text-emerald-600" />
        <div>
          <p className="text-sm font-bold text-zinc-900">Pebble Beach Golf Links</p>
          <p className="text-[10px] text-zinc-500">18h · Par 72</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <p className="text-xs font-medium text-zinc-800 flex-1">Great morning, scattered showers later</p>
        <span className="text-xl font-bold text-emerald-600">A-</span>
      </div>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 divide-y divide-zinc-200">
        {[
          ["A", "Morning", "7-11a", "Sun", "62°"],
          ["B+", "Midday", "11a-1p", "Sun", "67°"],
          ["C", "Afternoon", "1-5p", "Rain", "65°"],
        ].map(([g, n, t, f, tp]) => (
          <div key={n} className="flex items-center gap-2.5 px-3 py-2">
            <span className={`text-base font-bold w-7 text-center ${g === "C" ? "text-amber-600" : "text-emerald-600"}`}>{g}</span>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-zinc-800">{n}</span>
                <span className="text-[10px] text-zinc-500">{t}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                {f === "Rain" ? <CloudRain className="h-2.5 w-2.5 text-blue-500" /> : <Sun className="h-2.5 w-2.5 text-amber-500" />}
                <span className="font-mono">{tp}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2.5 rounded-lg px-3 py-2 bg-zinc-100">
        <div className="h-9 w-9 rounded bg-emerald-600/10 flex items-center justify-center shrink-0">
          <Flag className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-zinc-800">Member tee times — 20% off Tuesdays</p>
          <p className="text-[9px] text-zinc-500">Pro Shop · Sponsored</p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium bg-zinc-900 text-white">Go</span>
      </div>
    </div>
  );
}

function FullMock() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-4 w-full max-w-[480px]">
      <div className="flex items-center gap-2.5 mb-3">
        <Flag className="h-4 w-4 text-emerald-600" />
        <div>
          <h3 className="text-base font-bold text-zinc-900">Pebble Beach Golf Links</h3>
          <p className="text-[11px] text-zinc-500">18 holes · Par 72 · Pebble Beach, CA</p>
        </div>
      </div>
      <div className="flex border-b border-zinc-200 mb-3">
        {["Today", "Tmrw", "Sat", "Sun", "Mon", "Tue", "Wed"].map((d, i) => (
          <div key={d} className={`flex-1 py-2 flex flex-col items-center gap-0.5 ${i === 0 ? "border-b-2 border-emerald-600" : ""}`}>
            <span className="text-[8px] uppercase tracking-wider text-zinc-500">{d}</span>
            <span className="text-[8px] text-zinc-400">May {2 + i}</span>
            <span className="text-sm font-bold text-zinc-800">{["A", "B", "B+", "A", "C", "B-", "A-"][i]}</span>
            <span className="text-[10px] font-mono text-zinc-500">{[64, 67, 70, 68, 62, 65, 66][i]}°</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mb-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-800">Great morning, scattered showers later</p>
          <p className="text-xs text-zinc-500 mt-0.5">Light wind, mid-60s. Pause around 2 p.m. for a passing shower.</p>
        </div>
        <span className="text-3xl font-bold text-emerald-600">A-</span>
      </div>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 divide-y divide-zinc-200">
        {[
          ["A", "Morning", "7-11a", "Sun", "62°", "5"],
          ["B+", "Midday", "11a-1p", "PartlyCloudy", "67°", "8"],
          ["C", "Afternoon", "1-5p", "Rain", "65°", "10"],
          ["B", "Evening", "5-8p", "PartlyCloudy", "61°", "12"],
        ].map(([g, n, t, f, tp, w]) => (
          <div key={n} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`text-xl font-bold w-9 text-center ${g === "C" ? "text-amber-600" : "text-emerald-600"}`}>{g}</span>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-zinc-800">{n}</span>
                <span className="text-[11px] text-zinc-500">{t}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
                {f === "Rain" ? <CloudRain className="h-3 w-3 text-blue-500" /> :
                 f === "PartlyCloudy" ? <CloudSun className="h-3 w-3 text-amber-500" /> :
                 <Sun className="h-3 w-3 text-amber-500" />}
                <span className="font-mono">{tp}</span>
                <span className="flex items-center gap-0.5"><Wind className="h-2.5 w-2.5" />{w}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2.5 rounded-lg px-3 py-2 bg-zinc-100">
        <div className="h-10 w-10 rounded bg-emerald-600/10 flex items-center justify-center shrink-0">
          <Flag className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-800">Member tee times — 20% off Tuesdays</p>
          <p className="text-[10px] text-zinc-500">Pro Shop · Sponsored</p>
        </div>
        <span className="shrink-0 rounded-full px-3 py-1 text-xs font-medium bg-zinc-900 text-white">Go</span>
      </div>
    </div>
  );
}

function EmbedShowcase() {
  return (
    <section id="embed" className="mx-auto max-w-6xl px-5 py-20 border-t border-zinc-200">
      <div className="text-center mb-12">
        <p className="text-[11px] uppercase tracking-wider text-emerald-600 font-semibold mb-2">Embed</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 max-w-3xl mx-auto leading-tight">
          One snippet. Four sizes. Anywhere on your site.
        </h2>
        <p className="mt-4 text-zinc-600 max-w-2xl mx-auto">
          The widget auto-detects the space it&rsquo;s given and adapts. Drop it in a sidebar, a hero banner, or a tee-time confirmation page.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          (Shown in light theme — a dark variant is also available.)
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Badge · header strip</p>
            <span className="text-[10px] text-zinc-400 font-mono">≤ 320px</span>
          </div>
          <div className="flex items-center justify-center min-h-[80px]"><MicroMock /></div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Compact · sidebar</p>
            <span className="text-[10px] text-zinc-400 font-mono">≤ 400px</span>
          </div>
          <div className="flex items-center justify-center"><CompactMock /></div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Medium · card</p>
            <span className="text-[10px] text-zinc-400 font-mono">≤ 500px</span>
          </div>
          <div className="flex items-center justify-center"><MediumMock /></div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Full · landing block</p>
            <span className="text-[10px] text-zinc-400 font-mono">500px+</span>
          </div>
          <div className="flex items-center justify-center"><FullMock /></div>
        </div>
      </div>
    </section>
  );
}

// ─── How it works ────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-20 border-t border-zinc-200">
      <div className="text-center mb-12">
        <p className="text-[11px] uppercase tracking-wider text-emerald-600 font-semibold mb-2">Setup</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900">Live on your site in three steps.</h2>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-3xl font-bold text-emerald-600 mb-3">1</p>
          <p className="text-base font-semibold text-zinc-900 mb-1.5">Add your course</p>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Find it on Google Places (we pull the address and coordinates for you). Takes 20 seconds.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-3xl font-bold text-emerald-600 mb-3">2</p>
          <p className="text-base font-semibold text-zinc-900 mb-1.5">Copy your snippet</p>
          <p className="text-sm text-zinc-600 leading-relaxed mb-3">
            One <code className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono text-[11px]">&lt;iframe&gt;</code> tag. Theme + accent color + size all configurable from the dashboard.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-3xl font-bold text-emerald-600 mb-3">3</p>
          <p className="text-base font-semibold text-zinc-900 mb-1.5">Paste it on your site</p>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Squarespace, Wix, WordPress, custom — anywhere you can paste HTML. It updates itself, hourly, forever.
          </p>
        </div>
      </div>

      <div className="mt-8 max-w-3xl mx-auto">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-lg">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950">
            <Code2 className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Your embed snippet</span>
          </div>
          <pre className="px-5 py-4 text-[12px] text-zinc-200 font-mono leading-relaxed overflow-x-auto">
{`<iframe
  src="https://teeweathr.com/embed?key=${DEMO_API_KEY}"
  width="100%" height="320"
  style="border:0; border-radius:12px"
  loading="lazy"
></iframe>`}
          </pre>
          <p className="px-5 py-3 text-[11px] text-zinc-500 border-t border-zinc-800 bg-zinc-950/60">
            This snippet is live — paste it on any page and you&rsquo;ll see Pebble Beach&rsquo;s weather render. After signup you&rsquo;ll get your own key for your course.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Owner ROI ───────────────────────────────────────────────────

function OwnerROI() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 border-t border-zinc-200">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-emerald-600 font-semibold mb-2">For course operators</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 leading-tight">
            Every weekend cancellation is a round you may have kept.
          </h2>
          <p className="mt-4 text-zinc-600 leading-relaxed">
            A weather widget isn&rsquo;t just a feature on your homepage. It&rsquo;s the difference between a golfer who reads &ldquo;rain all day&rdquo; on Weather.com and stays home — and a golfer who sees &ldquo;great until 2 p.m.&rdquo; and books a 9 a.m. tee time.
          </p>
          <p className="mt-3 text-zinc-600 leading-relaxed">
            Show your golfers the truth, on your site, in your colors. The conversation about weather happens before they pick up the phone — make sure it happens with you.
          </p>
          <Link href="/signup" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
            Start with the free tier <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { stat: "30s", label: "to install" },
            { stat: "20s", label: "to add your course" },
            { stat: "Hourly", label: "auto-updates" },
            { stat: "NWS", label: "data source" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-3xl font-bold text-emerald-600">{s.stat}</p>
              <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing teaser ──────────────────────────────────────────────

function PricingTeaser() {
  const tiers = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      pitch: "Test it on your course. Ad-supported.",
      bullets: ["1 course", "Ad-supported", "TeeWeathr branding", "Basic analytics"],
      cta: "Start free",
      href: "/signup",
      featured: false,
    },
    {
      name: "Pro",
      price: "$19.99",
      period: "/mo",
      pitch: "For the course ready to make it part of the brand.",
      bullets: ["1 course", "No ads", "Custom theme + accent", "90-day analytics", "Priority support"],
      cta: "Start Pro",
      href: "/signup?plan=pro",
      featured: true,
    },
    {
      name: "Multi-course",
      price: "Custom",
      period: "contact us",
      pitch: "Resorts, management groups, and multi-property operators.",
      bullets: ["Multiple courses", "White-label", "API access", "Custom contract"],
      cta: "Contact us",
      href: "mailto:hello@teeweathr.com?subject=Multi-course inquiry",
      featured: false,
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 border-t border-zinc-200">
      <div className="text-center mb-10">
        <p className="text-[11px] uppercase tracking-wider text-emerald-600 font-semibold mb-2">Pricing</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900">Built to pay for itself in a single weekend.</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`rounded-2xl p-6 ${
              t.featured
                ? "border-2 border-emerald-500 bg-emerald-50/40 shadow-md"
                : "border border-zinc-200 bg-white shadow-sm"
            }`}
          >
            {t.featured && (
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded mb-3">
                Most popular
              </span>
            )}
            <p className="text-sm font-semibold text-zinc-700">{t.name}</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-zinc-900">{t.price}</span>
              <span className="text-sm text-zinc-500">{t.period}</span>
            </div>
            <p className="mt-3 text-sm text-zinc-600">{t.pitch}</p>
            <ul className="mt-4 space-y-2">
              {t.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-zinc-700">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />{b}
                </li>
              ))}
            </ul>
            <Link
              href={t.href}
              className={`mt-6 inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                t.featured
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-zinc-500">
        <Link href="/pricing" className="hover:text-zinc-700 transition-colors">
          See full plan details <ArrowRight className="h-3.5 w-3.5 inline-block" />
        </Link>
      </p>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 border-t border-zinc-200">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-10 sm:p-14 text-center shadow-sm">
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 max-w-3xl mx-auto leading-tight">
          Stop letting Weather.com decide when your tee sheet empties.
        </h2>
        <p className="mt-4 text-zinc-600 max-w-2xl mx-auto">
          Free tier, no card required. Pro is $19.99/mo and pays for itself the first time you keep a Saturday morning that would&rsquo;ve been written off.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors px-6 py-3.5 rounded-lg shadow-sm">
            Embed on your course site <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/forecast" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 px-6 py-3.5 rounded-lg border border-zinc-300 hover:border-zinc-400 bg-white transition-colors">
            See it on a live course
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-zinc-200 mt-10">
      <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-zinc-800">TeeWeathr</span>
          <span className="text-[11px] text-zinc-500">· Honest weather for golfers</span>
        </div>
        <div className="flex items-center gap-5 text-xs text-zinc-500">
          <Link href="/pricing" className="hover:text-zinc-800 transition-colors">Pricing</Link>
          <Link href="/forecast" className="hover:text-zinc-800 transition-colors">Live demo</Link>
          <Link href="/login" className="hover:text-zinc-800 transition-colors">Log in</Link>
          <Link href="/signup" className="hover:text-zinc-800 transition-colors">Sign up</Link>
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
    <div className="min-h-screen bg-white text-zinc-900">
      <Nav />
      <main>
        <Hero />
        <TrySection />
        <Comparison />
        <Features />
        <EmbedShowcase />
        <HowItWorks />
        <OwnerROI />
        <PricingTeaser />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
