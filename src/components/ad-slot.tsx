"use client";

import { useEffect, useState } from "react";

// Ad slot used by the embed widget (free tier) and the consumer forecast
// page. Both surfaces show ads on every render — we monetize the public
// view since it's not behind a paid customer's domain.
//
// Variants:
//   "micro"   — single-line strip pinned to the bottom of the inline badge
//   "compact" — smaller image + tighter padding for tight cards
//   "default" — standard layout with image + "Go" pill

export type AdVariant = "micro" | "compact" | "default";

interface ServedAd {
  sponsor: string;
  text: string;
  clickUrl: string;
  imageUrl?: string;
}

// Normalize the ad's click URL so a value like "pebblebeach.com/promo"
// (missing scheme) doesn't get treated as a path relative to the current
// host. Anchors, query strings, and mailto:/tel: links are preserved.
export function normalizeAdUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "#";
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(v)) return v;
  return `https://${v}`;
}

export function AdSlot({ isDark, variant = "default" }: { isDark: boolean; variant?: AdVariant }) {
  const [ad, setAd] = useState<ServedAd | null>(null);

  useEffect(() => {
    fetch("/api/ads/serve")
      .then((r) => r.json())
      .then((data) => { if (data.ad) setAd(data.ad); })
      .catch(() => {});
  }, []);

  if (!ad) return null;
  const href = normalizeAdUrl(ad.clickUrl);

  if (variant === "micro") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer sponsored"
        className={`flex items-center gap-1.5 px-3 py-1 border-t shrink-0 transition-colors ${
          isDark
            ? "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80"
            : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
        }`}
        title={`${ad.sponsor} · Sponsored`}>
        <span className={`text-[8px] font-semibold uppercase tracking-wider shrink-0 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Ad</span>
        {ad.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.imageUrl} alt="" className="h-3.5 w-auto max-w-[28px] rounded-sm object-contain shrink-0" />
        )}
        <span className={`text-[10px] font-medium truncate flex-1 min-w-0 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{ad.text}</span>
        <span className="text-[9px] shrink-0" style={{ color: "var(--accent)" }}>{ad.sponsor} ›</span>
      </a>
    );
  }

  if (variant === "compact") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer sponsored"
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
          isDark ? "bg-zinc-800/80 hover:bg-zinc-800" : "bg-zinc-100 hover:bg-zinc-200/80"
        }`}>
        {ad.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.imageUrl} alt={ad.sponsor} className="h-7 w-auto max-w-[44px] rounded object-contain shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-medium leading-tight truncate ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{ad.text}</p>
          <p className={`text-[8px] truncate ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{ad.sponsor} · Sponsored</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold tracking-wider" style={{ color: "var(--accent)" }}>›</span>
      </a>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer sponsored"
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors ${
        isDark ? "bg-zinc-800/80 hover:bg-zinc-800" : "bg-zinc-100 hover:bg-zinc-200/80"
      }`}>
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.imageUrl} alt={ad.sponsor} className="h-10 w-auto max-w-[80px] rounded object-contain shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{ad.text}</p>
        <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{ad.sponsor} · Sponsored</p>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
        isDark ? "bg-zinc-600 text-zinc-100" : "bg-zinc-800 text-white"
      }`}>Go</span>
    </a>
  );
}
