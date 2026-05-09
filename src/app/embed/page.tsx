"use client";

import { useState, useEffect, useMemo, useCallback, useRef, use } from "react";
import type { WeatherData, WeatherPeriod, WeatherAlert } from "@/lib/types";
import { trackEmbedEvent } from "@/lib/embed-analytics";
import {
  calculateGolfConditions, analyzeDayVerdict, getHourlyForDay, getGrade,
  analyzeTimeBlocks, type TimeBlock,
} from "@/lib/golf-scoring";
import { useCurrentDay } from "@/lib/use-current-day";
import { dayKeyInTz, formatInTz, hourInTz, todayKeyInTz, tomorrowKeyInTz, tzShortLabel } from "@/lib/course-time";
import { useViewerTz } from "@/lib/use-viewer-tz";
import {
  Wind, CloudRain, Sun, Cloud, CloudSun, Flag,
  CheckCircle2, AlertTriangle, Loader2,
  CloudLightning, CloudSnow, CloudFog, Snowflake,
} from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { pickWeatherIcon } from "@/components/weather-icon";

// ─── Size detection ─────────────────────────────────────────────

type WidgetSize = "micro" | "compact" | "medium" | "full";

function useWidgetSize(ref: React.RefObject<HTMLDivElement | null>): { size: WidgetSize; width: number } {
  const [state, setState] = useState<{ size: WidgetSize; width: number }>({ size: "full", width: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      let size: WidgetSize;
      if (width < 320 || height < 120) size = "micro";
      else if (width < 400 || height < 300) size = "compact";
      else if (width < 500 || height < 500) size = "medium";
      else size = "full";
      setState({ size, width });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return state;
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

// ─── Shared day tab logic ───────────────────────────────────────

function DayTabRow({ weather, dayPeriods, selectedDayIndex, onSelectDay, isDark, isCompact, todayStr, tmrwStr, tz }: {
  weather: WeatherData; dayPeriods: WeatherPeriod[]; selectedDayIndex: number;
  onSelectDay: (i: number) => void; isDark: boolean; isCompact?: boolean;
  todayStr: string; tmrwStr: string; tz: string | undefined | null;
}) {
  return (
    <div className={`flex ${isDark ? "border-zinc-800" : "border-zinc-200"} border-b overflow-x-auto`}>
      {dayPeriods.slice(0, isCompact ? 5 : undefined).map((period) => {
        const pIdx = weather.periods.indexOf(period);
        const sel = pIdx === selectedDayIndex;
        const periodKey = dayKeyInTz(period.startTime, tz);
        const label = periodKey === todayStr ? (isCompact ? "Tod" : "Today")
          : periodKey === tmrwStr ? "Tmrw"
          : formatInTz(period.startTime, tz, { weekday: "short" });
        const dh = getHourlyForDay(weather.hourly, period, tz);
        const db = analyzeTimeBlocks(dh, tz);
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
                {formatInTz(period.startTime, tz, { month: "short", day: "numeric" })}
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

// ─── Pill View (corner-popup trigger) ──────────────────────────
//
// Compact rounded badge used as the closed state of a corner-popup
// embed. Loaded inside its own tiny iframe (`?view=pill`) by the
// snippet — clicks fall through to the host page wrapper which
// toggles the main popup iframe.

function PillView({ score, isDark, forecast, danger }: {
  score: number;
  isDark: boolean;
  forecast: string;
  danger: boolean;
}) {
  const grade = getGrade(score);
  // Surface the rain/lightning icon when conditions are poor — same
  // logic the rest of the app uses, so a stormy day shows the cloud
  // glyph instead of an ambiguous "D" letter.
  const iconType = danger || score < 40 ? pickWeatherIcon(forecast) : null;
  const ratingNode = iconType
    ? (() => {
        const cls = "h-5 w-5 text-amber-500";
        switch (iconType) {
          case "lightning":
          case "severe": return <CloudLightning className={cls} />;
          case "heavyRain":
          case "rain": return <CloudRain className={cls} />;
          case "snow":
          case "hail": return <CloudSnow className={cls} />;
          case "fog": return <CloudFog className={cls} />;
          case "ice": return <Snowflake className={cls} />;
          case "wind": return <Wind className={cls} />;
        }
      })()
    : (
      <span className="text-lg font-bold leading-none" style={gradeStyle(score)}>
        {grade.letter}
      </span>
    );
  return (
    <div
      className={`flex items-center gap-2 h-full w-full px-3 ${
        isDark ? "bg-zinc-900" : "bg-white"
      }`}
    >
      <Flag className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
      <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
        TeeWeathr
      </span>
      <div className="flex-1" />
      {ratingNode}
    </div>
  );
}

// ─── Micro View (banner + inline badge) ─────────────────────────

function MicroView({ score, name, isDark, selectedPeriod, onPrev, onNext, hasPrev, hasNext, showAds, todayStr, tmrwStr, tz, alert, weather, dayPeriods, selectedDayIndex, onSelectDay, widgetWidth }: {
  score: number; name: string; isDark: boolean;
  selectedPeriod: WeatherPeriod; onPrev: () => void; onNext: () => void;
  hasPrev: boolean; hasNext: boolean; showAds: boolean;
  todayStr: string; tmrwStr: string; tz: string | undefined | null;
  alert?: WeatherAlert | null;
  weather: WeatherData;
  dayPeriods: WeatherPeriod[];
  selectedDayIndex: number;
  onSelectDay: (i: number) => void;
  widgetWidth: number;
}) {
  // Banner-shape (wide × short) micros get an inline day strip filling
  // the otherwise-empty middle — each chip shows weekday abbrev + grade
  // and is clickable. Narrow micros (mobile banner, inline badge) keep
  // the prev/next + date label since chips wouldn't fit.
  const wideEnoughForChips = widgetWidth >= 640;
  // Each chip is roughly 56px including padding/gap; reserve ~280px
  // for the grade + course-name column and ~24px for end padding.
  const dayChipCount = Math.max(0, Math.min(7, Math.floor((widgetWidth - 304) / 56)));
  const grade = getGrade(score);
  const m = isDark ? "text-zinc-500" : "text-zinc-400";
  const periodKey = dayKeyInTz(selectedPeriod.startTime, tz);
  const dateLabel = periodKey === todayStr ? "Today"
    : periodKey === tmrwStr ? "Tomorrow"
    : formatInTz(selectedPeriod.startTime, tz, { weekday: "short", month: "short", day: "numeric" });

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

        {wideEnoughForChips && dayChipCount > 0 ? (
          <div className="flex items-center gap-1 shrink-0">
            {dayPeriods.slice(0, dayChipCount).map((period) => {
              const pIdx = weather.periods.indexOf(period);
              const sel = pIdx === selectedDayIndex;
              const pKey = dayKeyInTz(period.startTime, tz);
              const isToday = pKey === todayStr;
              const isTmrw = pKey === tmrwStr;
              const label = isToday ? "Tod" : isTmrw ? "Tmrw" : formatInTz(period.startTime, tz, { weekday: "short" });
              const dh = getHourlyForDay(weather.hourly, period, tz);
              const db = analyzeTimeBlocks(dh, tz);
              const best = db.length > 0
                ? Math.max(...db.map((b) => b.score))
                : calculateGolfConditions(period).score;
              return (
                <button
                  key={period.number}
                  onClick={() => onSelectDay(pIdx)}
                  className={`flex flex-col items-center justify-center px-2 py-1 rounded-md transition-colors min-w-[44px] ${
                    sel
                      ? isDark ? "bg-zinc-800" : "bg-zinc-100"
                      : isDark ? "hover:bg-zinc-900/60" : "hover:bg-zinc-50"
                  }`}
                  aria-label={pKey}
                >
                  <span className={`text-[8px] uppercase tracking-wider font-medium ${m}`}>{label}</span>
                  <span className="text-[12px] font-bold leading-none mt-0.5" style={gradeStyle(best)}>
                    {getGrade(best).letter}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
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
        )}
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
    courseId: string; timezone?: string;
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
          timezone: data.course.timezone,
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
  // Course IANA tz — comes from the Firestore course doc when an API key
  // is present, otherwise we fall back to viewer tz (URL-param embeds are
  // a dev/preview path).
  const tz = serverConfig?.timezone || params.tz;
  // Forced view override — corner-popup embed snippet uses ?view=pill so
  // its closed-state pill always renders the compact badge regardless of
  // detected iframe size.
  const forcedView = params.view;
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
  const { size: widgetSize, width: widgetWidth } = useWidgetSize(containerRef);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const todayStr = useCurrentDay(tz, useCallback(() => { setRefreshKey((k) => k + 1); }, []));
  const tmrwStr = useMemo(() => (tz ? tomorrowKeyInTz(tz) : ""), [tz]);
  // "Course time · PST" hint — shown only on medium/full sizes when the
  // viewer's tz differs from the course's. Empty string until mount so SSR
  // and client agree (no hydration flicker).
  const viewerTz = useViewerTz();
  const tzHint = !!viewerTz && !!tz && viewerTz !== tz ? tzShortLabel(tz) : "";

  const fetchWeather = useCallback(async () => {
    try {
      const [wRes, aRes] = await Promise.all([
        fetch(`/api/weather?lat=${lat}&lon=${lon}`),
        fetch(`/api/alerts?lat=${lat}&lon=${lon}`),
      ]);
      if (!wRes.ok) throw new Error();
      const data: WeatherData = await wRes.json();
      setWeather(data);
      // Default-day pick. NWS frequently returns "Tonight" (the previous
      // night period) at index 0, so a naive selectedDayIndex=0 would
      // show yesterday's night period instead of today's daytime forecast.
      // Pick the first daytime period that matches today in the course's
      // tz; past 6 PM, jump to tomorrow's daytime.
      const periods = data.periods;
      const hour = hourInTz(new Date(), tz);
      const todayKey = todayKeyInTz(tz);
      const todayDaytimeIdx = periods.findIndex(
        (p) => p.isDaytime && dayKeyInTz(p.startTime, tz) === todayKey
      );
      const firstDaytimeIdx = periods.findIndex((p) => p.isDaytime);
      let nextIdx: number;
      if (hour >= 18 && todayDaytimeIdx >= 0) {
        const after = periods.findIndex((p, i) => i > todayDaytimeIdx && p.isDaytime);
        nextIdx = after >= 0 ? after : todayDaytimeIdx;
      } else {
        nextIdx = todayDaytimeIdx >= 0 ? todayDaytimeIdx : firstDaytimeIdx;
      }
      if (nextIdx >= 0) setSelectedDayIndex(nextIdx);
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
    return analyzeTimeBlocks(getHourlyForDay(weather.hourly, selectedPeriod, tz), tz);
  }, [weather, selectedPeriod, tz]);

  const verdict = useMemo(() => {
    if (!weather || !selectedPeriod) return null;
    return analyzeDayVerdict(selectedPeriod, getHourlyForDay(weather.hourly, selectedPeriod, tz), tz);
  }, [weather, selectedPeriod, tz]);

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

      {/* Loader covers the entire async window: keyed embeds wait on
          /api/embed/[key] before lat/lon are known, then on the weather
          fetch. Showing the loader for the whole window prevents the
          old behaviour where the "Add ?lat=…" instructional message
          flashed under the spinner during config load. */}
      {(configLoading || (loading && (apiKey || (lat && lon)))) && (
        <div className="flex items-center justify-center h-full">
          <Loader2 className={`h-4 w-4 animate-spin ${m}`} />
        </div>
      )}

      {/* Setup hint — only for raw (keyless) embeds where the
          developer literally hasn't filled in the URL yet. Keyed
          embeds get their coords from server config and should
          never see this message. */}
      {!apiKey && !configLoading && (!lat || !lon) && (
        <div className="flex items-center justify-center h-full p-3">
          <p className={`text-xs ${m} text-center`}>Add ?lat=XX&lon=YY&name=Course+Name</p>
        </div>
      )}

      {!loading && (error || !weather || !selectedPeriod || !verdict) && lat && lon && (
        <div className="flex items-center justify-center h-full p-3">
          <p className={`text-xs ${m}`}>{error || "Unavailable"}</p>
        </div>
      )}

      {/* ─── Pill view (corner-popup trigger) ─── */}
      {!loading && weather && selectedPeriod && verdict && forcedView === "pill" && (
        <PillView
          score={bestBlock?.score ?? verdict.dayScore}
          isDark={isDark}
          forecast={selectedPeriod.shortForecast}
          danger={bestBlock?.danger ?? false}
        />
      )}

      {!loading && weather && selectedPeriod && verdict && forcedView !== "pill" && (
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
              tz={tz}
              alert={topAlert}
              selectedPeriod={selectedPeriod}
              weather={weather}
              dayPeriods={dayPeriods}
              selectedDayIndex={selectedDayIndex}
              widgetWidth={widgetWidth}
              onSelectDay={(i) => { setSelectedDayIndex(i); trackInteraction(); }}
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
              </div>
              {topAlert && <AlertBanner alert={topAlert} isDark={isDark} size="compact" />}
              <DayTabRow weather={weather} dayPeriods={dayPeriods} selectedDayIndex={selectedDayIndex}
                onSelectDay={(i) => { setSelectedDayIndex(i); trackInteraction(); }} isDark={isDark} isCompact
                todayStr={todayStr} tmrwStr={tmrwStr} tz={tz} />
              {/* Per-chunk breakdown — same data the medium/full views show as
                  full rows, condensed to one line so smaller widgets convey
                  the same "why" without losing functionality. */}
              <CompactBlockStrip blocks={blocks} isDark={isDark} />
              <p className={`text-[9px] ${m}`}>
                Updated {formatInTz(weather.generatedAt, tz, { hour: "numeric", minute: "2-digit" })}
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
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{name}</p>
                    {(par || tzHint) && (
                      <p className={`text-[10px] ${m}`}>
                        {par ? `Par ${par}` : ""}
                        {par && tzHint ? " · " : ""}
                        {tzHint ? `Course time · ${tzHint}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <DayTabRow weather={weather} dayPeriods={dayPeriods} selectedDayIndex={selectedDayIndex}
                  onSelectDay={(i) => { setSelectedDayIndex(i); trackInteraction(); }} isDark={isDark}
                  todayStr={todayStr} tmrwStr={tmrwStr} tz={tz} />
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
                Updated {formatInTz(weather.generatedAt, tz, { hour: "numeric", minute: "2-digit" })}
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
                  <div className="min-w-0">
                    <h1 className="text-base font-bold truncate">{name}</h1>
                    <p className={`text-[11px] ${m}`}>
                      {holes} holes{par ? ` · Par ${par}` : ""} · {weather.location}
                      {tzHint ? ` · Course time · ${tzHint}` : ""}
                    </p>
                  </div>
                </div>
                <DayTabRow weather={weather} dayPeriods={dayPeriods} selectedDayIndex={selectedDayIndex}
                  onSelectDay={(i) => { setSelectedDayIndex(i); trackInteraction(); }} isDark={isDark}
                  todayStr={todayStr} tmrwStr={tmrwStr} tz={tz} />
              </div>
              {/* Scrollable: selected day content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
                <p className={`text-xs ${m}`}>
                  {formatInTz(selectedPeriod.startTime, tz, { weekday: "long", month: "long", day: "numeric" })}
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
                {verdict.bestWindow ? (
                  <p className={`text-center text-xs ${m}`}>
                    Best: <span className={isDark ? "text-zinc-300" : "text-zinc-700"}>{verdict.bestWindow.startLabel}–{verdict.bestWindow.endLabel}</span> ({getGrade(verdict.bestWindow.avgScore).letter})
                  </p>
                ) : bestBlock && bestBlock.score >= 30 ? (
                  <p className={`text-center text-xs ${m}`}>
                    Best: <span className={isDark ? "text-zinc-300" : "text-zinc-700"}>{bestBlock.name}</span> ({bestBlock.label})
                  </p>
                ) : null}
                <p className={`text-center text-[11px] ${m}`}>
                  Updated {formatInTz(weather.generatedAt, tz, { hour: "numeric", minute: "2-digit" })}
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
