"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Copy, Check, Share2, Loader2, Image as ImageIcon, Link2 } from "lucide-react";

type ShareFormat = "daily" | "weekly" | "hourly";
type ShareSize = "square" | "landscape" | "story";
type Theme = "dark" | "light";

const FORMATS: { id: ShareFormat; label: string; desc: string }[] = [
  { id: "daily", label: "Daily", desc: "Today + time blocks" },
  { id: "weekly", label: "Weekly", desc: "7-day overview" },
  { id: "hourly", label: "Hourly", desc: "Hour-by-hour grades" },
];

const SIZES: { id: ShareSize; label: string; ratio: string; useFor: string }[] = [
  { id: "square", label: "Square", ratio: "1:1", useFor: "Facebook · Instagram feed" },
  { id: "landscape", label: "Landscape", ratio: "16:9", useFor: "Twitter · LinkedIn · web" },
  { id: "story", label: "Story", ratio: "9:16", useFor: "IG/FB Stories · Reels" },
];

const ACCENTS = [
  { id: "default", label: "Default", color: "#10b981" },
  { id: "blue", label: "Blue", color: "#3b82f6" },
  { id: "purple", label: "Purple", color: "#8b5cf6" },
  { id: "red", label: "Red", color: "#ef4444" },
  { id: "orange", label: "Orange", color: "#f97316" },
  { id: "zinc", label: "Neutral", color: "#71717a" },
];

interface BusinessShape {
  id: string;
  tier: string;
  embedApiKey: string;
}

interface CourseShape {
  id: string;
  name: string;
}

export default function SharePage() {
  const [biz, setBiz] = useState<BusinessShape | null>(null);
  const [courses, setCourses] = useState<CourseShape[]>([]);
  const [loading, setLoading] = useState(true);

  const [format, setFormat] = useState<ShareFormat>("daily");
  const [size, setSize] = useState<ShareSize>("square");
  const [theme, setTheme] = useState<Theme>("dark");
  const [accent, setAccent] = useState("default");
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD; "" = today
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/business")
      .then((r) => r.json())
      .then((data) => {
        setBiz(data.business || null);
        setCourses(data.courses || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const apiKey = biz?.embedApiKey || "";
  const courseName = courses[0]?.name || "your course";

  // Live preview URL — server-side image route, key + params on the URL.
  const imageUrl = useMemo(() => {
    if (!apiKey) return null;
    const params = new URLSearchParams({ key: apiKey, format, size, theme, accent });
    if (date) params.set("date", date);
    return `/api/share?${params.toString()}`;
  }, [apiKey, format, size, theme, accent, date]);

  // Public share URL with OG meta tags. Pasting this into Facebook / X /
  // LinkedIn lets those platforms render a card preview using the image.
  // Built on the client so we use the actual deployed origin (no env vars).
  const shareUrl = useMemo(() => {
    if (!apiKey) return null;
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams({ format, size, theme, accent });
    if (date) params.set("date", date);
    return `${window.location.origin}/share/${encodeURIComponent(apiKey)}?${params.toString()}`;
  }, [apiKey, format, size, theme, accent, date]);

  // Pre-built caption for copy-paste into a social post.
  const caption = useMemo(() => {
    const tag = "#golf";
    const dateLabel = date
      ? new Date(date + "T00:00").toLocaleDateString("en-US", { weekday: "long" })
      : "Today";
    if (format === "weekly") {
      return `7-day forecast at ${courseName}. Find your tee window. ${tag}`;
    }
    if (format === "hourly") {
      return `${dateLabel}'s hourly forecast at ${courseName}. ${tag}`;
    }
    return `${dateLabel} at ${courseName} — see the real golf forecast, hour by hour. ${tag}`;
  }, [format, date, courseName]);

  function copyCaption() {
    navigator.clipboard.writeText(caption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  }

  function copyShareUrl() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // Date picker options: today + next 6 days. Cap at the NWS forecast window.
  // Build the YYYY-MM-DD value from local components — toISOString()
  // returns the UTC date, which in negative-offset timezones (EST after
  // ~7 PM) is already the *next* day, so a button labeled "Wed, May 6"
  // would send "2026-05-07" to the server.
  const dateOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: "", label: "Today" }];
    for (let i = 1; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      opts.push({
        value: `${yyyy}-${mm}-${dd}`,
        label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      });
    }
    return opts;
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  if (!biz || !courses.length) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Share to social</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Generate a share-ready image of your forecast — perfect for Facebook, Instagram, X, and SMS.
        </p>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
          <p className="text-sm text-amber-200">
            Add a course before generating share images.{" "}
            <a href="/dashboard/courses" className="underline hover:text-amber-100">Add your course →</a>
          </p>
        </div>
      </div>
    );
  }

  const previewAspect =
    size === "square" ? "1 / 1" : size === "landscape" ? "1200 / 630" : "9 / 16";
  // Story is tall — keep the preview narrower so it doesn't dominate the
  // viewport. Square + landscape get a wider preview slot. Below xl,
  // the layout stacks and the preview centers above the controls; cap
  // the max-width so a stacked story preview doesn't go full bleed.
  const previewWidthClass =
    size === "story"
      ? "w-full max-w-[260px] xl:w-[260px]"
      : "w-full max-w-[400px] xl:w-[400px]";

  const isFree = biz.tier === "free";

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center gap-2 mb-1">
        <Share2 className="h-5 w-5 text-emerald-400" />
        <h1 className="text-2xl font-bold tracking-tight">Share to social</h1>
      </div>
      <p className="text-sm text-zinc-500 mb-8">
        Generate a forecast image, download it, and post to wherever your golfers hang out.
      </p>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* ─── Controls ─── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Format */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Format</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`text-left rounded-xl border px-4 py-3 transition-all ${
                    format === f.id
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <p className="text-sm font-semibold text-zinc-100">{f.label}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{f.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Size */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Size</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSize(s.id)}
                  className={`text-left rounded-xl border px-4 py-3 transition-all ${
                    size === s.id
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <p className="text-sm font-semibold text-zinc-100">
                    {s.label} <span className="text-zinc-500 text-[11px]">{s.ratio}</span>
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{s.useFor}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Date — only relevant for daily + hourly */}
          {(format === "daily" || format === "hourly") && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Date</h2>
              <div className="flex flex-wrap gap-2">
                {dateOptions.map((d) => (
                  <button
                    key={d.value || "today"}
                    onClick={() => setDate(d.value)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                      date === d.value
                        ? "border-emerald-500 bg-emerald-500/10 text-zinc-100"
                        : "border-zinc-800 text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Theme + accent */}
          <section className="grid grid-cols-2 gap-6">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Theme</h2>
              <div className="flex gap-2">
                {(["dark", "light"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                      theme === t
                        ? "border-emerald-500 bg-emerald-500/10 text-zinc-100"
                        : "border-zinc-800 text-zinc-500"
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-zinc-600"
                      style={{ background: t === "dark" ? "#18181b" : "#fafafa" }}
                    />
                    {t === "dark" ? "Dark" : "Light"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Accent</h2>
              <div className="flex gap-1.5">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAccent(a.id)}
                    title={a.label}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      accent === a.id ? "border-zinc-300 scale-110" : "border-transparent hover:border-zinc-600"
                    }`}
                    style={{ backgroundColor: a.color }}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Share URL — paste into Facebook / X / LinkedIn for an
              auto-rendered card preview using the OG image. */}
          {shareUrl && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="h-3.5 w-3.5 text-zinc-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Shareable link</h2>
              </div>
              <p className="text-[11px] text-zinc-500 mb-3">
                Paste this URL into Facebook, X, or LinkedIn — the platform shows a card preview with the image automatically.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-300 break-all">
                  {shareUrl}
                </code>
                <button
                  onClick={copyShareUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs text-zinc-200 transition-colors shrink-0"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedLink ? "Copied" : "Copy"}
                </button>
              </div>
            </section>
          )}

          {/* Caption + actions */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Caption</h2>
            <p className="text-sm text-zinc-200 mb-3">{caption}</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyCaption}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs text-zinc-200 transition-colors"
              >
                {copiedCaption ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCaption ? "Copied" : "Copy caption"}
              </button>
              {imageUrl && (
                <a
                  href={imageUrl}
                  download={`teeweathr-${format}-${size}.png`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> Download PNG
                </a>
              )}
              {imageUrl && (
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs text-zinc-200 transition-colors"
                >
                  Open full-size
                </a>
              )}
            </div>
            {isFree && (
              <p className="text-[11px] text-zinc-500 mt-3">
                Free tier images include a small &ldquo;Powered by TeeWeathr&rdquo; footer. Upgrade to Pro to remove it.
              </p>
            )}
          </section>
        </div>

        {/* ─── Preview ─── */}
        <div className={`${previewWidthClass} shrink-0 mx-auto xl:mx-0 xl:sticky xl:top-8 xl:self-start`}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Preview</h2>
          <div
            className="relative rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden w-full"
            style={{ aspectRatio: previewAspect }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={imageUrl}
                src={imageUrl}
                alt="Forecast preview"
                className="block w-full h-full"
                style={{ objectFit: "contain" }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2 text-center">
            Updates as you change settings · refreshes hourly with NWS data
          </p>
        </div>
      </div>
    </div>
  );
}
