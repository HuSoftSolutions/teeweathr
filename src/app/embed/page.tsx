"use client";

import { useState, useEffect, useMemo, useCallback, useRef, use } from "react";
import type { WeatherData, WeatherPeriod } from "@/lib/types";
import {
  calculateGolfConditions, analyzeDayVerdict, getHourlyForDay, getGrade,
  analyzeTimeBlocks, type TimeBlock,
} from "@/lib/golf-scoring";
import { useCurrentDay } from "@/lib/use-current-day";
import {
  Wind, CloudRain, Sun, Cloud, CloudSun, Flag,
  ShieldX, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";

// ─── Size detection ─────────────────────────────────────────────

type WidgetSize = "micro" | "compact" | "medium" | "full";

function useWidgetSize(ref: React.RefObject<HTMLDivElement | null>): WidgetSize {
  const [size, setSize] = useState<WidgetSize>("full");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width < 320 || height < 120) setSize("micro");
      else if (width < 400 || height < 300) setSize("compact");
      else if (width < 500 || height < 500) setSize("medium");
      else setSize("full");
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// ─── Helpers ────────────────────────────────────────────────────

function WeatherIcon({ forecast, className = "h-4 w-4" }: { forecast: string; className?: string }) {
  const f = forecast.toLowerCase();
  if (f.includes("rain") || f.includes("shower")) return <CloudRain className={`${className} text-blue-400`} />;
  if (f.includes("partly")) return <CloudSun className={`${className} text-amber-300`} />;
  if (f.includes("cloud")) return <Cloud className={`${className} text-zinc-400`} />;
  return <Sun className={`${className} text-amber-300`} />;
}

function RainLabel({ precip, label }: { precip: number; label: string }) {
  if (precip >= 80) return <span className="text-red-400 font-medium">{label}</span>;
  if (precip >= 60) return <span className="text-orange-400">{label}</span>;
  if (precip >= 40) return <span className="text-amber-400">{label}</span>;
  return <span className="opacity-50">{precip}%</span>;
}

// Ad slot for free-tier embeds — fetches from /api/ads/serve
type AdVariant = "micro" | "compact" | "default";

function AdSlot({ isDark, variant = "default" }: { isDark: boolean; variant?: AdVariant }) {
  const [ad, setAd] = useState<{ sponsor: string; text: string; clickUrl: string; imageUrl?: string } | null>(null);

  useEffect(() => {
    fetch("/api/ads/serve")
      .then((r) => r.json())
      .then((data) => { if (data.ad) setAd(data.ad); })
      .catch(() => {});
  }, []);

  if (!ad) return null;

  // Micro: single-line sponsor strip pinned to bottom of widget
  if (variant === "micro") {
    return (
      <a href={ad.clickUrl} target="_blank" rel="noopener noreferrer sponsored"
        className={`flex items-center gap-1.5 px-3 py-1 border-t shrink-0 transition-colors ${
          isDark
            ? "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80"
            : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
        }`}
        title={`${ad.sponsor} · Sponsored`}>
        <span className={`text-[8px] font-semibold uppercase tracking-wider shrink-0 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Ad</span>
        {ad.imageUrl && (
          <img src={ad.imageUrl} alt="" className="h-3.5 w-auto max-w-[28px] rounded-sm object-contain shrink-0" />
        )}
        <span className={`text-[10px] font-medium truncate flex-1 min-w-0 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{ad.text}</span>
        <span className={`text-[9px] shrink-0 ${isDark ? "text-zinc-500" : "text-zinc-500"}`} style={{ color: "var(--accent)" }}>{ad.sponsor} ›</span>
      </a>
    );
  }

  // Compact: smaller image, tighter padding, no big "Go" pill
  if (variant === "compact") {
    return (
      <a href={ad.clickUrl} target="_blank" rel="noopener noreferrer sponsored"
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
          isDark
            ? "bg-zinc-800/80 hover:bg-zinc-800"
            : "bg-zinc-100 hover:bg-zinc-200/80"
        }`}>
        {ad.imageUrl && (
          <img src={ad.imageUrl} alt={ad.sponsor} className="h-7 w-auto max-w-[44px] rounded object-contain shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-medium leading-tight truncate ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{ad.text}</p>
          <p className={`text-[8px] truncate ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{ad.sponsor} · Sponsored</p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold tracking-wider`} style={{ color: "var(--accent)" }}>›</span>
      </a>
    );
  }

  // Default (medium + full)
  return (
    <a href={ad.clickUrl} target="_blank" rel="noopener noreferrer sponsored"
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 mt-1 transition-colors ${
        isDark
          ? "bg-zinc-800/80 hover:bg-zinc-800"
          : "bg-zinc-100 hover:bg-zinc-200/80"
      }`}>
      {ad.imageUrl && (
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

const ACCENT_COLORS: Record<string, string> = {
  default: "#10b981", blue: "#3b82f6", purple: "#8b5cf6",
  red: "#ef4444", orange: "#f97316", zinc: "#71717a",
};

// Embed-specific: use accent color for good scores, amber/red for bad
function gradeStyle(score: number): React.CSSProperties {
  if (score >= 60) return { color: "var(--accent)" };
  if (score >= 40) return { color: "#fbbf24" }; // amber
  return { color: "#f87171" }; // red
}

function statusStyle(status: string): React.CSSProperties {
  if (status === "go") return { color: "var(--accent)" };
  if (status === "mixed") return { color: "#fbbf24" };
  return { color: "#f87171" };
}

// ─── Shared day tab logic ───────────────────────────────────────

function DayTabRow({ weather, dayPeriods, selectedDayIndex, onSelectDay, isDark, isCompact, todayStr, tmrwStr }: {
  weather: WeatherData; dayPeriods: WeatherPeriod[]; selectedDayIndex: number;
  onSelectDay: (i: number) => void; isDark: boolean; isCompact?: boolean;
  todayStr: string; tmrwStr: string;
}) {
  return (
    <div className={`flex ${isDark ? "border-zinc-800" : "border-zinc-200"} border-b overflow-x-auto`}>
      {dayPeriods.slice(0, isCompact ? 5 : undefined).map((period) => {
        const pIdx = weather.periods.indexOf(period);
        const sel = pIdx === selectedDayIndex;
        const date = new Date(period.startTime);
        const label = date.toDateString() === todayStr ? (isCompact ? "Tod" : "Today")
          : date.toDateString() === tmrwStr ? "Tmrw"
          : date.toLocaleDateString([], { weekday: "short" });
        const dh = getHourlyForDay(weather.hourly, period);
        const db = analyzeTimeBlocks(dh);
        const best = db.length > 0 ? Math.max(...db.map((b) => b.score)) : calculateGolfConditions(period).score;
        return (
          <button key={period.number} onClick={() => onSelectDay(pIdx)}
            className={`flex flex-col items-center gap-0.5 ${isCompact ? "py-1 px-2 flex-1" : "py-2 px-3 min-w-[52px]"} border-b-2 transition-all ${
              sel ? `${isDark ? "text-zinc-100" : "text-zinc-900"}` : `border-transparent ${isDark ? "text-zinc-600" : "text-zinc-400"}`
            }`}
            style={sel ? { borderBottomColor: "var(--accent)" } : undefined}>
            <span className={`${isCompact ? "text-[8px]" : "text-[9px]"} font-medium uppercase tracking-wider`}>{label}</span>
            {!isCompact && (
              <span className={`text-[8px] ${sel ? (isDark ? "text-zinc-400" : "text-zinc-500") : (isDark ? "text-zinc-700" : "text-zinc-300")} -mt-0.5`}>
                {date.toLocaleDateString([], { month: "short", day: "numeric" })}
              </span>
            )}
            <span className={`${isCompact ? "text-[11px]" : "text-sm"} font-bold`} style={sel ? gradeStyle(best) : undefined}>{getGrade(best).letter}</span>
            <span className="text-[10px] font-mono">{period.temperature}°</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Block row ──────────────────────────────────────────────────

function BlockRow({ block, isDark, compact }: { block: TimeBlock; isDark: boolean; compact?: boolean }) {
  const m = isDark ? "text-zinc-500" : "text-zinc-400";
  return (
    <div className={`flex items-center gap-${compact ? "2.5" : "3"} ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}>
      <span className={`${compact ? "text-lg w-8" : "text-xl w-10"} font-bold text-center`} style={gradeStyle(block.score)}>{block.grade.letter}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`${compact ? "text-xs" : "text-sm"} font-medium`}>{block.name}</span>
          <span className={`text-[11px] ${m}`}>{block.label}</span>
        </div>
        <div className={`flex items-center gap-2 mt-0.5 text-${compact ? "[11px]" : "xs"} ${m}`}>
          <WeatherIcon forecast={block.forecast} className="h-3 w-3" />
          <span className="font-mono">{block.temp.high}°</span>
          <span className="flex items-center gap-0.5"><Wind className="h-2.5 w-2.5" />{block.wind.avg}</span>
          {block.danger ? <span className="text-red-400">{block.rain}</span> :
           block.rain ? <RainLabel precip={block.precip.peak} label={block.rain} /> :
           <span style={{ color: "var(--accent)", opacity: 0.7 }}>Dry</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Micro View (banner + inline badge) ─────────────────────────

function MicroView({ score, name, isDark, selectedPeriod, onPrev, onNext, hasPrev, hasNext, showAds, todayStr, tmrwStr }: {
  score: number; name: string; isDark: boolean;
  selectedPeriod: WeatherPeriod; onPrev: () => void; onNext: () => void;
  hasPrev: boolean; hasNext: boolean; showAds: boolean;
  todayStr: string; tmrwStr: string;
}) {
  const grade = getGrade(score);
  const m = isDark ? "text-zinc-500" : "text-zinc-400";
  const date = new Date(selectedPeriod.startTime);
  const dateLabel = date.toDateString() === todayStr ? "Today"
    : date.toDateString() === tmrwStr ? "Tomorrow"
    : date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center flex-1 min-h-0 px-3 gap-2">
        {/* Grade */}
        <span className="text-2xl font-bold shrink-0" style={gradeStyle(score)}>{grade.letter}</span>

        {/* Course + date */}
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-medium truncate ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{name}</p>
          <p className={`text-[9px] ${m} truncate`}>
            {grade.label} · {selectedPeriod.temperature}° · {selectedPeriod.shortForecast}
          </p>
        </div>

        {/* Date + nav arrows */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onPrev} disabled={!hasPrev}
            className={`p-0.5 rounded transition-colors ${hasPrev ? `${isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-100"} ${m}` : "opacity-20"}`}
            aria-label="Previous day">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span className={`text-[10px] font-medium min-w-[52px] text-center ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            {dateLabel}
          </span>
          <button onClick={onNext} disabled={!hasNext}
            className={`p-0.5 rounded transition-colors ${hasNext ? `${isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-100"} ${m}` : "opacity-20"}`}
            aria-label="Next day">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      {showAds && <AdSlot isDark={isDark} variant="micro" />}
    </div>
  );
}

// ─── Embed Page ─────────────────────────────────────────────────

export default function EmbedPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = use(searchParams);
  const apiKey = params.key;
  const courseParam = params.course;

  // If API key is present, config is fetched from server (tier-enforced)
  // If not, fall back to raw URL params (for preview/legacy)
  const [serverConfig, setServerConfig] = useState<{
    lat: string; lon: string; name: string; holes: number; par?: number;
    theme: string; accent: string; showAds: boolean; showBranding: boolean;
    courseId: string;
  } | null>(null);
  const [configLoading, setConfigLoading] = useState(!!apiKey);

  useEffect(() => {
    if (!apiKey) return;
    fetch(`/api/embed/${apiKey}${courseParam ? `?course=${courseParam}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setServerConfig({
          lat: String(data.course.lat),
          lon: String(data.course.lon),
          name: data.course.name,
          holes: data.course.holes || 18,
          par: data.course.par,
          theme: data.embedParams?.theme || "dark",
          accent: data.embedParams?.accent || "default",
          showAds: data.features.showAds,
          showBranding: data.features.showBranding,
          courseId: data.courseId,
        });
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, [apiKey, courseParam]);

  // Resolve config: server-controlled if API key, URL params otherwise
  const lat = serverConfig?.lat || params.lat;
  const lon = serverConfig?.lon || params.lon;
  const name = serverConfig?.name || params.name || "Golf Course";
  const holes = serverConfig?.holes || (params.holes ? parseInt(params.holes) : 18);
  const par = serverConfig?.par || (params.par ? parseInt(params.par) : undefined);
  const theme = serverConfig?.theme || params.theme || "dark";
  const accent = serverConfig?.accent || params.accent || "default";
  const accentHex = ACCENT_COLORS[accent] || ACCENT_COLORS.default;
  // Server-enforced: if API key is present, ONLY the server decides these
  const showBranding = apiKey ? (serverConfig?.showBranding ?? true) : params.branding !== "false";
  const showAds = apiKey ? (serverConfig?.showAds ?? false) : params.ads === "true";
  const resolvedCourseId = serverConfig?.courseId || courseParam || "unknown";

  // Analytics beacon
  const viewTracked = useRef(false);
  useEffect(() => {
    if (!apiKey || viewTracked.current || configLoading) return;
    viewTracked.current = true;
    fetch("/api/embed/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, courseId: resolvedCourseId, event: "view" }),
    }).catch(() => {});
  }, [apiKey, resolvedCourseId, configLoading]);

  const trackInteraction = useCallback(() => {
    if (!apiKey) return;
    fetch("/api/embed/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, courseId: resolvedCourseId, event: "interaction" }),
    }).catch(() => {});
  }, [apiKey, resolvedCourseId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const widgetSize = useWidgetSize(containerRef);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const todayStr = useCurrentDay(useCallback(() => { setRefreshKey((k) => k + 1); }, []));
  const tmrwStr = useMemo(() => {
    const d = new Date(todayStr);
    d.setDate(d.getDate() + 1);
    return d.toDateString();
  }, [todayStr]);

  const fetchWeather = useCallback(async () => {
    if (!lat || !lon) { setError("Missing lat/lon"); setLoading(false); return; }
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error();
      const data: WeatherData = await res.json();
      setWeather(data);
      if (new Date().getHours() >= 18) {
        const tmrwIdx = data.periods.findIndex((p, i) => i > 0 && p.isDaytime);
        if (tmrwIdx > 0) setSelectedDayIndex(tmrwIdx);
      }
    } catch { setError("Weather unavailable"); }
    finally { setLoading(false); }
  }, [lat, lon, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  const selectedPeriod = useMemo(() => {
    if (!weather) return null;
    return weather.periods[Math.min(selectedDayIndex, weather.periods.length - 1)];
  }, [weather, selectedDayIndex]);

  const blocks = useMemo(() => {
    if (!weather || !selectedPeriod) return [];
    return analyzeTimeBlocks(getHourlyForDay(weather.hourly, selectedPeriod));
  }, [weather, selectedPeriod]);

  const verdict = useMemo(() => {
    if (!weather || !selectedPeriod) return null;
    return analyzeDayVerdict(selectedPeriod, getHourlyForDay(weather.hourly, selectedPeriod));
  }, [weather, selectedPeriod]);

  const bestBlock = useMemo(() => {
    if (!blocks.length) return null;
    return blocks.reduce((a, b) => (b.score > a.score ? b : a));
  }, [blocks]);

  const dayPeriods = useMemo(() => {
    if (!weather) return [];
    return weather.periods.filter((p) => p.isDaytime);
  }, [weather]);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-zinc-950" : "bg-white";
  const text = isDark ? "text-zinc-100" : "text-zinc-900";
  const m = isDark ? "text-zinc-500" : "text-zinc-400";
  const brd = isDark ? "border-zinc-800" : "border-zinc-200";
  const cardBg = isDark ? "bg-zinc-900/50" : "bg-zinc-50";
  const divider = isDark ? "divide-zinc-800/60" : "divide-zinc-200";

  return (
    <div ref={containerRef} className={`h-screen w-screen overflow-hidden ${bg} ${text}`}
      style={{ "--accent": accentHex } as React.CSSProperties}>

      {(!lat || !lon) && (
        <div className="flex items-center justify-center h-full p-3">
          <p className={`text-xs ${m} text-center`}>Add ?lat=XX&lon=YY&name=Course+Name</p>
        </div>
      )}

      {(configLoading || (loading && lat && lon)) && (
        <div className="flex items-center justify-center h-full">
          <Loader2 className={`h-4 w-4 animate-spin ${m}`} />
        </div>
      )}

      {!loading && (error || !weather || !selectedPeriod || !verdict) && lat && lon && (
        <div className="flex items-center justify-center h-full p-3">
          <p className={`text-xs ${m}`}>{error || "Unavailable"}</p>
        </div>
      )}

      {!loading && weather && selectedPeriod && verdict && (
        <>
          {/* ─── Micro ─── */}
          {widgetSize === "micro" && (
            <MicroView
              score={bestBlock?.score ?? verdict.dayScore}
              name={name}
              isDark={isDark}
              showAds={showAds}
              todayStr={todayStr}
              tmrwStr={tmrwStr}
              selectedPeriod={selectedPeriod}
              hasPrev={dayPeriods.findIndex((p) => weather.periods.indexOf(p) === selectedDayIndex) > 0}
              hasNext={dayPeriods.findIndex((p) => weather.periods.indexOf(p) === selectedDayIndex) < dayPeriods.length - 1}
              onPrev={() => {
                const curIdx = dayPeriods.findIndex((p) => weather.periods.indexOf(p) === selectedDayIndex);
                if (curIdx > 0) setSelectedDayIndex(weather.periods.indexOf(dayPeriods[curIdx - 1]));
              }}
              onNext={() => {
                const curIdx = dayPeriods.findIndex((p) => weather.periods.indexOf(p) === selectedDayIndex);
                if (curIdx < dayPeriods.length - 1) setSelectedDayIndex(weather.periods.indexOf(dayPeriods[curIdx + 1]));
              }}
            />
          )}

          {/* ─── Compact ─── */}
          {widgetSize === "compact" && (
            <div className="flex flex-col h-full p-3 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={gradeStyle(bestBlock?.score ?? verdict.dayScore)}>{getGrade(bestBlock?.score ?? verdict.dayScore).letter}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{name}</p>
                  <p className={`text-[10px] ${m}`}>{verdict.headline}</p>
                </div>
              </div>
              <DayTabRow weather={weather} dayPeriods={dayPeriods} selectedDayIndex={selectedDayIndex}
                onSelectDay={(i) => { setSelectedDayIndex(i); trackInteraction(); }} isDark={isDark} isCompact
                todayStr={todayStr} tmrwStr={tmrwStr} />
              {bestBlock && (
                <p className={`text-[10px] ${m}`}>Best: {bestBlock.name} · {bestBlock.temp.high}°</p>
              )}
              {showAds && <AdSlot isDark={isDark} variant="compact" />}
              {showBranding && (
                <p className={`text-[8px] mt-auto ${isDark ? "text-zinc-700" : "text-zinc-300"}`}>
                  <a href="/" target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>TeeWeathr</a>
                </p>
              )}
            </div>
          )}

          {/* ─── Medium ─── */}
          {widgetSize === "medium" && (
            <div className="flex flex-col h-full p-4 gap-3 overflow-y-auto">
              <div className="flex items-center gap-2">
                <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{name}</p>
                  <p className={`text-[10px] ${m}`}>{holes}h{par ? ` · Par ${par}` : ""}</p>
                </div>
              </div>
              <DayTabRow weather={weather} dayPeriods={dayPeriods} selectedDayIndex={selectedDayIndex}
                onSelectDay={(i) => { setSelectedDayIndex(i); trackInteraction(); }} isDark={isDark}
                todayStr={todayStr} tmrwStr={tmrwStr} />
              <div className="flex items-center gap-2">
                {verdict.status === "go" ? <CheckCircle2 className="h-4 w-4 shrink-0" style={statusStyle("go")} /> :
                 verdict.status === "mixed" ? <AlertTriangle className="h-4 w-4 shrink-0" style={statusStyle("mixed")} /> :
                 <ShieldX className="h-4 w-4 text-red-400 shrink-0" />}
                <p className="text-xs font-medium flex-1">{verdict.headline}</p>
                {bestBlock && <span className="text-xl font-bold" style={gradeStyle(bestBlock.score)}>{bestBlock.grade.letter}</span>}
              </div>
              <div className={`rounded-xl border ${brd} ${cardBg} divide-y ${divider}`}>
                {blocks.map((block) => <BlockRow key={block.name} block={block} isDark={isDark} compact />)}
              </div>
              {showAds && <AdSlot isDark={isDark} />}
              {showBranding && (
                <p className={`text-center text-[9px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}>
                  <a href="/" target="_blank" rel="noopener" className="hover:underline" style={{ color: "var(--accent)" }}
                    onClick={() => { if (apiKey) fetch("/api/embed/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, courseId: resolvedCourseId, event: "referral" }) }).catch(() => {}); }}>Powered by TeeWeathr</a>
                </p>
              )}
            </div>
          )}

          {/* ─── Full ─── */}
          {widgetSize === "full" && (
            <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
              <div className="flex items-center gap-2.5">
                <Flag className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
                <div className="min-w-0">
                  <h1 className="text-base font-bold truncate">{name}</h1>
                  <p className={`text-[11px] ${m}`}>{holes} holes{par ? ` · Par ${par}` : ""} · {weather.location}</p>
                </div>
              </div>
              <DayTabRow weather={weather} dayPeriods={dayPeriods} selectedDayIndex={selectedDayIndex}
                onSelectDay={(i) => { setSelectedDayIndex(i); trackInteraction(); }} isDark={isDark}
                todayStr={todayStr} tmrwStr={tmrwStr} />
              {/* Selected date */}
              <p className={`text-xs ${m} -mt-2`}>
                {new Date(selectedPeriod.startTime).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
              </p>
              {/* Verdict */}
              <div className="flex items-center gap-3">
                {verdict.status === "go" ? <CheckCircle2 className="h-5 w-5 shrink-0" style={statusStyle("go")} /> :
                 verdict.status === "mixed" ? <AlertTriangle className="h-5 w-5 shrink-0" style={statusStyle("mixed")} /> :
                 <ShieldX className="h-5 w-5 text-red-400 shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm font-medium">{verdict.headline}</p>
                  <p className={`text-xs ${m} mt-0.5`}>{verdict.detail}</p>
                </div>
                {bestBlock && <span className="text-3xl font-bold" style={gradeStyle(bestBlock.score)}>{bestBlock.grade.letter}</span>}
              </div>
              {/* Blocks */}
              <div className={`rounded-xl border ${brd} ${cardBg} divide-y ${divider}`}>
                {blocks.map((block) => <BlockRow key={block.name} block={block} isDark={isDark} />)}
                {blocks.length === 0 && (
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <WeatherIcon forecast={selectedPeriod.shortForecast} />
                      <p className="text-sm">{selectedPeriod.shortForecast} · {selectedPeriod.temperature}°</p>
                    </div>
                    <p className={`text-xs ${m} mt-1`}>{selectedPeriod.detailedForecast}</p>
                  </div>
                )}
              </div>
              {bestBlock && bestBlock.score >= 30 && (
                <p className={`text-center text-xs ${m}`}>
                  Best: <span className={isDark ? "text-zinc-300" : "text-zinc-700"}>{bestBlock.name}</span> ({bestBlock.label})
                </p>
              )}
              {showAds && <AdSlot isDark={isDark} />}
              {showBranding && (
                <p className={`text-center text-[10px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}>
                  <a href="/" target="_blank" rel="noopener" className="hover:underline" style={{ color: "var(--accent)" }}
                      onClick={() => { if (apiKey) fetch("/api/embed/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, courseId: resolvedCourseId, event: "referral" }) }).catch(() => {}); }}>Powered by TeeWeathr</a>
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
