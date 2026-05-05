import type { Metadata } from "next";
import { headers } from "next/headers";

// Public OG-card landing page for a customer's forecast share URL.
//
// Flow:
//   1. Customer copies https://teeweathr.com/share/<apiKey>?format=...&size=...
//      from the /dashboard/share page.
//   2. Pastes into Facebook / X / LinkedIn.
//   3. Platform scrapes this page, finds <meta property="og:image">
//      pointing at /api/share?... and shows a card preview using that PNG.
//   4. Anyone clicking the link lands on this page — they see the same
//      image inline plus a CTA to the interactive forecast.

interface SearchParamsShape {
  format?: string;
  size?: string;
  date?: string;
  theme?: string;
  accent?: string;
}

interface Props {
  params: Promise<{ apiKey: string }>;
  searchParams: Promise<SearchParamsShape>;
}

// Resolve the canonical public origin for absolute URLs (og:image, og:url).
// Order of preference:
//   1. Inbound request host — matches whatever domain the scraper actually
//      hit (teeweathr.com, custom domain, etc.).
//   2. NEXT_PUBLIC_BASE_URL — explicit override.
//   3. VERCEL_PROJECT_PRODUCTION_URL — Vercel's primary production domain
//      (e.g. teeweathr.com), distinct from the per-deployment VERCEL_URL.
//   4. VERCEL_URL — last resort. Note: per-deployment URLs are gated by
//      Vercel deployment protection, so external scrapers can't fetch
//      assets behind them. Avoid for OG.
async function getBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch {
    // Request headers unavailable during static rendering — fall through.
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function buildImageUrl(apiKey: string, sp: SearchParamsShape): Promise<string> {
  const base = await getBaseUrl();
  const qs = new URLSearchParams();
  qs.set("key", apiKey);
  if (sp.format) qs.set("format", sp.format);
  if (sp.size) qs.set("size", sp.size);
  if (sp.date) qs.set("date", sp.date);
  if (sp.theme) qs.set("theme", sp.theme);
  if (sp.accent) qs.set("accent", sp.accent);
  return `${base}/api/share?${qs.toString()}`;
}

// Fetch course config for the title + CTA. Falls back gracefully on any
// failure since this page is public — we never want a 500 here.
async function loadCourse(apiKey: string): Promise<{
  name: string;
  lat: number | null;
  lon: number | null;
}> {
  try {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/api/embed/${encodeURIComponent(apiKey)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const cfg = (await res.json()) as {
      course?: { name?: string; lat?: number; lon?: number };
    };
    return {
      name: cfg.course?.name ?? "Golf course",
      lat: typeof cfg.course?.lat === "number" ? cfg.course.lat : null,
      lon: typeof cfg.course?.lon === "number" ? cfg.course.lon : null,
    };
  } catch {
    return { name: "Golf course", lat: null, lon: null };
  }
}

function buildPageUrl(base: string, apiKey: string, sp: SearchParamsShape): string {
  const qs = new URLSearchParams();
  if (sp.format) qs.set("format", sp.format);
  if (sp.size) qs.set("size", sp.size);
  if (sp.date) qs.set("date", sp.date);
  if (sp.theme) qs.set("theme", sp.theme);
  if (sp.accent) qs.set("accent", sp.accent);
  const query = qs.toString();
  return `${base}/share/${apiKey}${query ? `?${query}` : ""}`;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { apiKey } = await params;
  const sp = await searchParams;
  const { name } = await loadCourse(apiKey);
  const base = await getBaseUrl();
  const imageUrl = await buildImageUrl(apiKey, sp);
  const pageUrl = buildPageUrl(base, apiKey, sp);
  const format = sp.format || "daily";
  const description =
    format === "weekly"
      ? `7-day golf playability forecast for ${name}.`
      : format === "hourly"
        ? `Hourly golf playability forecast for ${name}.`
        : `Today's golf playability forecast for ${name}.`;
  const title = `${name} — Golf Forecast`;

  return {
    metadataBase: new URL(base),
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      type: "website",
      url: pageUrl,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function SharePage({ params, searchParams }: Props) {
  const { apiKey } = await params;
  const sp = await searchParams;
  const { name, lat, lon } = await loadCourse(apiKey);
  const imageUrl = await buildImageUrl(apiKey, sp);

  const forecastUrl =
    lat != null && lon != null
      ? `/forecast?lat=${lat}&lon=${lon}&name=${encodeURIComponent(name)}`
      : "/";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800">
        <div className="mx-auto max-w-3xl px-5 py-4 flex items-center justify-between">
          <a href="/" className="text-sm font-semibold text-zinc-100">TeeWeathr</a>
          <a
            href={forecastUrl}
            className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            See the interactive forecast →
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{name}</h1>
          <p className="text-sm text-zinc-400 mb-8">Golf forecast</p>

          <div className="rounded-2xl overflow-hidden border border-zinc-800 mb-6 bg-zinc-900">
            {/* Plain img is intentional — the image is dynamic and served
                from our own /api/share endpoint with caching headers. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`Forecast for ${name}`}
              className="w-full h-auto block"
              loading="eager"
            />
          </div>

          <a
            href={forecastUrl}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-5 py-3 text-sm font-semibold text-white transition-colors"
          >
            See the interactive forecast
          </a>
        </div>
      </main>

      <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-500">
        Forecast by{" "}
        <a href="/" className="text-emerald-400 hover:text-emerald-300">TeeWeathr</a>
      </footer>
    </div>
  );
}
