"use client";

import { useState, useEffect, useMemo, useCallback, useRef, use } from "react";
import type { WeatherData, WeatherPeriod, WeatherAlert } from "@/lib/types";
import { trackEmbedEvent } from "@/lib/embed-analytics";
import {
  calculateGolfConditions, analyzeDayVerdict, getHourlyForDay, getGrade,
  analyzeTimeBlocks, type TimeBlock,
} from "@/lib/golf-scoring";
import { useCurrentDay } from "@/lib/use-current-day";
import {
  Wind, CloudRain, Sun, Cloud, CloudSun, Flag,
  CheckCircle2, AlertTriangle, Loader2,
  CloudLightning, CloudSnow, CloudFog, Snowflake,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { pickWeatherIcon } from "@/components/weather-icon";

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
  // No red even at heavy rain — golfers don't need an emergency alert
  // for "rain expected", just the level of severity.
  if (precip >= 80) return <span className="text-amber-500 font-semibold">{label}</span>;
  if (precip >= 60) return <span className="text-orange-400">{label}</span>;
  if (precip >= 40) return <span className="text-amber-400">{label}</span>;
  return <span className="opacity-50">{precip}%</span>;
}

// Verdict glyph for the embed widget. Routes no-go status to a specific
// weather icon (rain cloud / lightning / snow / fog) so the visual
// matches the cause — replaces a generic red shield. Always amber, never
// red, since the embed displays inside customer pages where red would
// read as an emergency alert rather than golf weather.
function VerdictGlyph({ status, forecast, hasBlocking, className }: {
  status: "go" | "mixed" | "no-go";
  forecast: string;
  hasBlocking: boolean;
  className: string;
}) {
  if (status === "go" && !hasBlocking) {
    return <CheckCircle2 className={className} style={{ color: "var(--accent)" }} />;
  }
  if (status === "mixed" && !hasBlocking) {
    return <AlertTriangle className={`${className} text-amber-400`} />;
  }
  const cls = `${className} text-amber-500`;
  switch (pickWeatherIcon(forecast)) {
    case "lightning":
    case "severe": return <CloudLightning className={cls} />;
    case "heavyRain":
    case "rain": return <CloudRain className={cls} />;
    case "snow":
    case "hail": return <CloudSnow className={cls} />;
    case "fog": return <CloudFog className={cls} />;
    case "ice": return <Snowflake className={cls} />;
    case "wind": return <Wind className={cls} />;
    default: return <AlertTriangle className={cls} />;
  }
}

const ACCENT_COLORS: Record<string, string> = {
  default: "#10b981", blue: "#3b82f6", purple: "#8b5cf6",
  red: "#ef4444", orange: "#f97316", zinc: "#71717a",
};

// Banner shown above the verdict when NWS has an active alert. Both
// blocking and warning level alerts now use amber — blocking just gets
// a heavier weight + filled background so the severity is still clear
// without resorting to red (which read as an emergency alert in a
// customer's golf-weather widget).
function AlertBanner({ alert, isDark, size }: {
  alert: WeatherAlert;
  isDark: boolean;
  size: "compact" | "medium" | "full";
}) {
  const blocking = alert.level === "blocking";
  const bgClass = blocking
    ? (isDark ? "bg-amber-950/60 border-amber-700" : "bg-amber-100 border-amber-400")
    : (isDark ? "bg-amber-950/40 border-amber-900" : "bg-amber-50 border-amber-200");
  const textClass = isDark ? "text-amber-200" : "text-amber-800";
  const subTextClass = isDark ? "text-amber-300/70" : "text-amber-700/80";
  const Icon = pickWeatherIcon(alert.event) === "lightning" ? CloudLightning : AlertTriangle;
  const fontWeight = blocking ? "font-bold" : "font-semibold";

  if (size === "compact") {
    return (
      <div className={`rounded-md border ${bgClass} px-2 py-1.5 flex items-center gap-1.5`}>
        <Icon className={`h-3 w-3 shrink-0 ${textClass}`} />
        <p className={`text-[10px] ${fontWeight} truncate ${textClass}`}>{alert.event}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${bgClass} px-3 py-2 flex items-start gap-2`}>
      <Icon className={`${size === "full" ? "h-4 w-4 mt-0.5" : "h-3.5 w-3.5 mt-0.5"} shrink-0 ${textClass}`} />
      <div className="flex-1 min-w-0">
        <p className={`${size === "full" ? "text-sm" : "text-xs"} ${fontWeight} ${textClass}`}>
          {alert.event}
        </p>
        <p className={`${size === "full" ? "text-[11px]" : "text-[10px]"} ${subTextClass} line-clamp-2`}>
          {alert.headline}
        </p>
      </div>
    </div>
  );
}

// Embed-specific: accent for good scores, amber for bad. Never red — the
// embed renders inside customer pages and a red letter grade reads as an
// alert rather than a poor weather rating.
function gradeStyle(score: number): React.CSSProperties {
  if (score >= 60) return { color: "var(--accent)" };
  if (score >= 40) return { color: "#fbbf24" };
  return { color: "#f59e0b" };
}

function statusStyle(status: string): React.CSSProperties {
  if (status === "go") return { color: "var(--accent)" };
  if (status === "mixed") return { color: "#fbbf24" };
  return { color: "#f59e0b" };
}

// ─── Collapsed view ─────────────────────────────────────────────
//
// End-user collapse — an iframe widget on a third-party page should never
// be a permanent fixture. The button hides the body of the widget and
// leaves only a thin "Show forecast" bar so the visitor can reclaim
// vertical space without losing access to the forecast.
//
// State persists in localStorage (scoped to the iframe origin, keyed by
// apiKey+courseId) so a user who collapses on one visit stays collapsed
// on the next. The widget also posts a `teeweathr:resize` message to its
// parent in case the embedding page wants to resize the iframe — listening
// is optional. Without a listener the collapse is purely visual; with a
// listener (a few lines of JS in the embed snippet) the iframe height
// shrinks to ~44px and frees real page space.
function useCollapsed(storageKey: string) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    try {
      setCollapsedState(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // localStorage may be blocked in 3p iframes (Safari ITP, etc.) —
      // collapse remains in-memory only.
    }
  }, [storageKey]);

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next);
      if (typeof window === "undefined") return;
      if (storageKey) {
        try {
          if (next) window.localStorage.setItem(storageKey, "1");
          else window.localStorage.removeItem(storageKey);
        } catch {
          // ignore — see comment above
        }
      }
      try {
        window.parent?.postMessage(
          { source: "teeweathr", type: "resize", collapsed: next },
          "*",
        );
      } catch {
        // parent unreachable / cross-origin — no-op
      }
    },
    [storageKey],
  );

  return [collapsed, setCollapsed] as const;
}

function CollapsedBar({ name, score, isDark, onExpand }: {
  name: string;
  score: number;
  isDark: boolean;
  onExpand: () => void;
}) {
  const grade = getGrade(score);
  return (
    <button
      onClick={onExpand}
      className={`flex items-center gap-2 w-full h-full px-3 transition-colors ${
        isDark ? "hover:bg-zinc-900" : "hover:bg-zinc-50"
      }`}
      title="Show forecast"
    >
      <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />
      <span className={`text-xs font-medium truncate flex-1 text-left ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
        {name}
      </span>
      <span className="text-sm font-bold shrink-0" style={gradeStyle(score)}>{grade.letter}</span>
      <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
    </button>
  );
}

function CollapseButton({ isDark, onClick }: { isDark: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full p-1 transition-colors ${
        isDark ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
      }`}
      title="Hide forecast"
      aria-label="Hide forecast"
    >
      <ChevronUp className="h-3.5 w-3.5" />
    </button>
  );
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

// ─── Compact block strip ────────────────────────────────────────
// One-line summary of the four time-of-day blocks for the *selected* day.
// Used in the compact view so smaller widgets still convey the per-chunk
// breakdown that the medium/full views show as full rows.

function CompactBlockStrip({ blocks, isDark }: { blocks: TimeBlock[]; isDark: boolean }) {
  if (blocks.length === 0) return null;
  return (
    <div className={`flex rounded-md border overflow-hidden ${isDark ? "border-zinc-800 divide-zinc-800" : "border-zinc-200 divide-zinc-200"} divide-x`}>
      {blocks.map((block) => (
        <div
          key={block.name}
          className={`flex-1 flex flex-col items-center py-1 ${isDark ? "bg-zinc-900/40" : "bg-zinc-50"}`}
          title={`${block.name} ${block.label} · ${block.grade.label}`}
        >
          <span className={`text-[8px] uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {block.name.slice(0, 3)}
          </span>
          <span className="text-sm font-bold leading-none mt-0.5" style={gradeStyle(block.score)}>
            {block.grade.letter}
          </span>
          <span className={`text-[9px] font-mono mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {block.temp.high}°
          </span>
        </div>
      ))}
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
          {block.danger ? <span className="text-amber-500 font-medium">{block.rain}</span> :
           block.rain ? <RainLabel precip={block.precip.peak} label={block.rain} /> :
           <span style={{ color: "var(--accent)", opacity: 0.7 }}>Dry</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Micro View (banner + inline badge) ─────────────────────────

function MicroView({ score, name, isDark, selectedPeriod, onPrev, onNext, hasPrev, hasNext, showAds, todayStr, tmrwStr, alert }: {
  score: number; name: string; isDark: boolean;
  selectedPeriod: WeatherPeriod; onPrev: () => void; onNext: () => void;
  hasPrev: boolean; hasNext: boolean; showAds: boolean;
  todayStr: string; tmrwStr: string;
  alert?: WeatherAlert | null;
}) {
  const grade = getGrade(score);
  const m = isDark ? "text-zinc-500" : "text-zinc-400";
  const date = new Date(selectedPeriod.startTime);
  const dateLabel = date.toDateString() === todayStr ? "Today"
    : date.toDateString() === tmrwStr ? "Tomorrow"
    : date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  const blocking = alert?.level === "blocking";
  const warning = alert?.level === "warning";
  // Blocking alerts (lightning, tornado) override the normal grade color
  // so a green "A" doesn't sit next to a tornado warning. Amber, not red.
  const gradeOverride: React.CSSProperties | undefined = blocking ? { color: "#f59e0b" } : undefined;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center flex-1 min-h-0 px-3 gap-2">
        {/* Grade — colored amber when an alert blocks play. */}
        <span className="text-2xl font-bold shrink-0" style={gradeOverride ?? gradeStyle(score)}>{grade.letter}</span>

        {/* Course + status */}
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-medium truncate flex items-center gap-1 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
            {blocking && <AlertTriangle className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
            <span className="truncate">{name}</span>
          </p>
          {blocking ? (
            <p className="text-[9px] text-amber-500 font-semibold truncate">
              {alert!.event} · {selectedPeriod.temperature}°
            </p>
          ) : warning ? (
            <p className="text-[9px] text-amber-400 truncate">
              {alert!.event} · {selectedPeriod.temperature}°
            </p>
          ) : (
            <p className={`text-[9px] ${m} truncate`}>
              {grade.label} · {selectedPeriod.temperature}° · {selectedPeriod.shortForecast}
            </p>
          )}
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

  // Analytics — events queue in memory and flush as a batch (debounced or
  // on pagehide), so 1M views ≠ 1M Firestore writes. See @/lib/embed-analytics.
  const viewTracked = useRef(false);
  useEffect(() => {
    if (!apiKey || viewTracked.current || configLoading) return;
    viewTracked.current = true;
    trackEmbedEvent(apiKey, resolvedCourseId, "view");
  }, [apiKey, resolvedCourseId, configLoading]);

  const trackInteraction = useCallback(() => {
    if (!apiKey) return;
    trackEmbedEvent(apiKey, resolvedCourseId, "interaction");
  }, [apiKey, resolvedCourseId]);

  const trackReferral = useCallback(() => {
    if (!apiKey) return;
    trackEmbedEvent(apiKey, resolvedCourseId, "referral");
  }, [apiKey, resolvedCourseId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const widgetSize = useWidgetSize(containerRef);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
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
    try {
      const [wRes, aRes] = await Promise.all([
        fetch(`/api/weather?lat=${lat}&lon=${lon}`),
        fetch(`/api/alerts?lat=${lat}&lon=${lon}`),
      ]);
      if (!wRes.ok) throw new Error();
      const data: WeatherData = await wRes.json();
      setWeather(data);
      if (new Date().getHours() >= 18) {
        const tmrwIdx = data.periods.findIndex((p, i) => i > 0 && p.isDaytime);
        if (tmrwIdx > 0) setSelectedDayIndex(tmrwIdx);
      }
      // Alerts are best-effort — silently fall back to no banner on failure.
      if (aRes.ok) {
        const alertData: { alerts?: WeatherAlert[] } = await aRes.json();
        setAlerts(alertData.alerts ?? []);
      }
    } catch { setError("Weather unavailable"); }
    finally { setLoading(false); }
  }, [lat, lon, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // When a key is provided, lat/lon arrive asynchronously from
    // /api/embed/[key]. Wait for that fetch before declaring coords missing,
    // otherwise we flash "Missing lat/lon" on every keyed embed load.
    if (apiKey && configLoading) return;

    if (!lat || !lon) {
      queueMicrotask(() => { setError("Missing lat/lon"); setLoading(false); });
      return;
    }
    // Clear any prior "missing" error from a render before serverConfig arrived.
    setError(null);
    queueMicrotask(() => { fetchWeather(); });
  }, [fetchWeather, lat, lon, apiKey, configLoading]);

  const topAlert = alerts[0] ?? null;
  const hasBlockingAlert = topAlert?.level === "blocking";

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

  // Collapse persists per (apiKey, course) so a visitor who's hidden the
  // widget on one course's page doesn't see it pop back open on the next.
  const [collapsed, setCollapsed] = useCollapsed(
    apiKey ? `tw-collapsed:${apiKey}:${resolvedCourseId}` : `tw-collapsed:raw:${lat},${lon}`,
  );

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

      {/* Collapsed view — intercepts compact/medium/full and renders a thin
          bar with course name + grade + an expand button. Skipped for
          micro since that view is already minimal. */}
      {!loading && weather && selectedPeriod && verdict && collapsed && widgetSize !== "micro" && (
        <CollapsedBar
          name={name}
          score={bestBlock?.score ?? verdict.dayScore}
          isDark={isDark}
          onExpand={() => setCollapsed(false)}
        />
      )}

      {!loading && weather && selectedPeriod && verdict && !(collapsed && widgetSize !== "micro") && (
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
              alert={topAlert}
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
                  <p className={`text-[10px] ${m} truncate`}>{verdict.headline}</p>
                </div>
                <CollapseButton isDark={isDark} onClick={() => setCollapsed(true)} />
              </div>
              {topAlert && <AlertBanner alert={topAlert} isDark={isDark} size="compact" />}
              <DayTabRow weather={weather} dayPeriods={dayPeriods} selectedDayIndex={selectedDayIndex}
                onSelectDay={(i) => { setSelectedDayIndex(i); trackInteraction(); }} isDark={isDark} isCompact
                todayStr={todayStr} tmrwStr={tmrwStr} />
              {/* Per-chunk breakdown — same data the medium/full views show as
                  full rows, condensed to one line so smaller widgets convey
                  the same "why" without losing functionality. */}
              <CompactBlockStrip blocks={blocks} isDark={isDark} />
              <p className={`text-[9px] ${m}`}>
                Updated {new Date(weather.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
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
            <div className="flex flex-col h-full">
              {/* Pinned: course header + day tabs always visible. Day
                  selection should never scroll out of view just because
                  the user scrolled to read time-block details. */}
              <div className={`shrink-0 px-4 pt-4 pb-3 flex flex-col gap-3 border-b ${brd}`}>
                <div className="flex items-center gap-2">
                  <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{name}</p>
                    <p className={`text-[10px] ${m}`}>{holes}h{par ? ` · Par ${par}` : ""}</p>
                  </div>
                  <CollapseButton isDark={isDark} onClick={() => setCollapsed(true)} />
                </div>
                <DayTabRow weather={weather} dayPeriods={dayPeriods} selectedDayIndex={selectedDayIndex}
                  onSelectDay={(i) => { setSelectedDayIndex(i); trackInteraction(); }} isDark={isDark}
                  todayStr={todayStr} tmrwStr={tmrwStr} />
              </div>
              {/* Scrollable: alert + verdict + time blocks + footer */}
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {topAlert && <AlertBanner alert={topAlert} isDark={isDark} size="medium" />}
              <div className="flex items-center gap-2">
                <VerdictGlyph
                  status={verdict.status}
                  forecast={selectedPeriod.shortForecast}
                  hasBlocking={hasBlockingAlert}
                  className="h-4 w-4 shrink-0"
                />
                <p className="text-xs font-medium flex-1">{verdict.headline}</p>
                {bestBlock && <span className="text-xl font-bold" style={gradeStyle(bestBlock.score)}>{bestBlock.grade.letter}</span>}
              </div>
              <div className={`rounded-xl border ${brd} ${cardBg} divide-y ${divider}`}>
                {blocks.map((block) => <BlockRow key={block.name} block={block} isDark={isDark} compact />)}
              </div>
              <p className={`text-center text-[10px] ${m}`}>
                Updated {new Date(weather.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
              {showAds && <AdSlot isDark={isDark} />}
              {showBranding && (
                <p className={`text-center text-[9px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}>
                  <a href="/" target="_blank" rel="noopener" className="hover:underline" style={{ color: "var(--accent)" }}
                    onClick={trackReferral}>Powered by TeeWeathr</a>
                </p>
              )}
              </div>
            </div>
          )}

          {/* ─── Full ─── */}
          {widgetSize === "full" && (
            <div className="flex flex-col h-full">
              {/* Pinned: course header + day tabs always visible. */}
              <div className={`shrink-0 px-4 pt-4 pb-3 flex flex-col gap-3 border-b ${brd}`}>
                <div className="flex items-center gap-2.5">
                  <Flag className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base font-bold truncate">{name}</h1>
                    <p className={`text-[11px] ${m}`}>{holes} holes{par ? ` · Par ${par}` : ""} · {weather.location}</p>
                  </div>
                  <CollapseButton isDark={isDark} onClick={() => setCollapsed(true)} />
                </div>
                <DayTabRow weather={weather} dayPeriods={dayPeriods} selectedDayIndex={selectedDayIndex}
                  onSelectDay={(i) => { setSelectedDayIndex(i); trackInteraction(); }} isDark={isDark}
                  todayStr={todayStr} tmrwStr={tmrwStr} />
              </div>
              {/* Scrollable: selected day content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
                <p className={`text-xs ${m}`}>
                  {new Date(selectedPeriod.startTime).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                </p>
                {topAlert && <AlertBanner alert={topAlert} isDark={isDark} size="full" />}
                <div className="flex items-center gap-3">
                  <VerdictGlyph
                    status={verdict.status}
                    forecast={selectedPeriod.shortForecast}
                    hasBlocking={hasBlockingAlert}
                    className="h-5 w-5 shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{verdict.headline}</p>
                    <p className={`text-xs ${m} mt-0.5`}>{verdict.detail}</p>
                  </div>
                  {bestBlock && <span className="text-3xl font-bold" style={gradeStyle(bestBlock.score)}>{bestBlock.grade.letter}</span>}
                </div>
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
                <p className={`text-center text-[11px] ${m}`}>
                  Updated {new Date(weather.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
                {showAds && <AdSlot isDark={isDark} />}
                {showBranding && (
                  <p className={`text-center text-[10px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}>
                    <a href="/" target="_blank" rel="noopener" className="hover:underline" style={{ color: "var(--accent)" }}
                        onClick={trackReferral}>Powered by TeeWeathr</a>
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
