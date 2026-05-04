"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { WeatherData, WeatherPeriod, DayVerdict } from "@/lib/types";
import type { GolfCourse } from "@/lib/courses";
import { useFavorites } from "@/lib/use-favorites";
import {
  calculateGolfConditions,
  getScoreBg,
  analyzeDayVerdict,
  getHourlyForDay,
  getGrade,
} from "@/lib/golf-scoring";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wind,
  Thermometer,
  Droplets,
  CloudRain,
  Sun,
  Cloud,
  CloudSun,
  MapPin,
  Search,
  Flag,
  Loader2,
  Heart,
  ShieldAlert,
  ShieldX,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Navigation,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface CourseWithWeather {
  course: GolfCourse;
  weather: WeatherData;
  score: number;
  verdict: DayVerdict;
}

// ─── Helpers ────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-sky-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function scoreBorder(score: number) {
  if (score >= 80) return "border-emerald-400";
  if (score >= 60) return "border-sky-400";
  if (score >= 40) return "border-amber-400";
  return "border-red-400";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-sky-400";
  if (score >= 40) return "bg-amber-400";
  return "bg-red-400";
}

function scoreBgMuted(score: number) {
  if (score >= 80) return "bg-emerald-400/10";
  if (score >= 60) return "bg-sky-400/10";
  if (score >= 40) return "bg-amber-400/10";
  return "bg-red-400/10";
}

function statusLabel(status: DayVerdict["status"]) {
  if (status === "go") return "GO";
  if (status === "mixed") return "MIXED";
  return "SKIP";
}

function statusColor(status: DayVerdict["status"]) {
  if (status === "go") return "text-emerald-400";
  if (status === "mixed") return "text-amber-400";
  return "text-red-400";
}

function WeatherIcon({ forecast, className = "h-4 w-4" }: { forecast: string; className?: string }) {
  const f = forecast.toLowerCase();
  if (f.includes("rain") || f.includes("shower") || f.includes("drizzle")) return <CloudRain className={`${className} text-sky-400`} />;
  if (f.includes("partly")) return <CloudSun className={`${className} text-amber-300`} />;
  if (f.includes("cloud") || f.includes("overcast")) return <Cloud className={`${className} text-slate-400`} />;
  if (f.includes("wind")) return <Wind className={`${className} text-slate-400`} />;
  return <Sun className={`${className} text-amber-300`} />;
}

// ─── Score Ring ──────────────────────────────────────────────────

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const p = (score / 100) * c;
  const strokeCls = score >= 80 ? "stroke-emerald-400" : score >= 60 ? "stroke-sky-400" : score >= 40 ? "stroke-amber-400" : "stroke-red-400";
  const grade = getGrade(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} className="stroke-slate-700/50" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7}
          strokeDasharray={c} strokeDashoffset={c - p} strokeLinecap="round"
          className={`${strokeCls} transition-all duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-bold ${scoreColor(score)} transition-colors duration-500`}>{grade.letter}</span>
        <span className="text-xs text-slate-400 mt-0.5 tracking-wider uppercase">{grade.label}</span>
      </div>
    </div>
  );
}

// ─── Sidebar Course Row ─────────────────────────────────────────

function CourseRow({
  cw,
  isSelected,
  isFav,
  onSelect,
  onToggleFav,
}: {
  cw: CourseWithWeather;
  isSelected: boolean;
  isFav: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left border-l-2 transition-colors ${
        isSelected
          ? `${scoreBorder(cw.score)} bg-slate-800/80`
          : `border-transparent hover:bg-slate-800/50`
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isSelected ? "text-slate-100" : "text-slate-300"}`}>
          {cw.course.name}
        </p>
        <p className="text-[10px] text-slate-500 font-mono truncate">
          {cw.course.distance !== undefined ? `${cw.course.distance} mi` : ""}
          {cw.course.city ? ` · ${cw.course.city}` : ""}
        </p>
      </div>
      <span className={`text-sm font-bold ${scoreColor(cw.score)}`}>{getGrade(cw.score).letter}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        className="p-0.5 transition-colors"
        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart className={`h-3.5 w-3.5 ${isFav ? "fill-red-400 text-red-400" : "text-slate-600 hover:text-red-400/60"}`} />
      </button>
    </button>
  );
}

// ─── Day Picker (compact) ───────────────────────────────────────

function DayPicker({
  periods,
  hourly,
  selectedIndex,
  onSelect,
}: {
  periods: WeatherPeriod[];
  hourly: WeatherPeriod[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  const days = periods.map((p, i) => ({ period: p, index: i })).filter((d) => d.period.isDaytime);

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {days.map((d) => {
        const dh = getHourlyForDay(hourly, d.period);
        const v = analyzeDayVerdict(d.period, dh);
        const sel = d.index === selectedIndex;
        const date = new Date(d.period.startTime);
        const isToday = d.index === 0 || (d.index === 1 && !periods[0].isDaytime);
        const label = isToday ? "Today" : date.toLocaleDateString([], { weekday: "short" });

        return (
          <button
            key={d.period.number}
            onClick={() => onSelect(d.index)}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 min-w-[56px] transition-all text-xs ${
              sel
                ? "bg-slate-700 text-slate-100"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
            }`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
            <span className={`text-sm font-bold ${scoreColor(v.dayScore)}`}>{getGrade(v.dayScore).letter}</span>
            <span className="font-mono text-[10px]">{d.period.temperature}°</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Verdict Banner ─────────────────────────────────────────────

function VerdictBanner({ verdict }: { verdict: DayVerdict }) {
  const icon = verdict.status === "go"
    ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
    : verdict.status === "mixed"
    ? <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
    : <XCircle className="h-4 w-4 text-red-400 shrink-0" />;

  const borderCls = verdict.status === "go" ? "border-emerald-400/20" : verdict.status === "mixed" ? "border-amber-400/20" : "border-red-400/20";

  return (
    <div className={`rounded-lg border ${borderCls} bg-slate-800/60 p-3`}>
      <div className="flex items-start gap-2">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusColor(verdict.status)}`}>{statusLabel(verdict.status)}</span>
            {verdict.bestWindow && verdict.status !== "no-go" && (
              <span className="text-[10px] text-slate-500 font-mono">{verdict.bestWindow.startLabel}-{verdict.bestWindow.endLabel}</span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-200 leading-snug">{verdict.headline}</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{verdict.detail}</p>
        </div>
      </div>
      {verdict.danger !== "none" && verdict.dangerDetail && (
        <div className={`mt-2 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ${
          verdict.danger === "danger" ? "bg-red-400/10 text-red-400" : "bg-amber-400/10 text-amber-400"
        }`}>
          {verdict.danger === "danger" ? <ShieldX className="h-3.5 w-3.5 shrink-0" /> : <ShieldAlert className="h-3.5 w-3.5 shrink-0" />}
          <span>{verdict.dangerDetail}</span>
        </div>
      )}
    </div>
  );
}

// ─── Factor Grid (2x2) ─────────────────────────────────────────

function FactorGrid({ factors }: { factors: { name: string; value: string; impact: "positive" | "neutral" | "negative"; detail: string }[] }) {
  const icons: Record<string, React.ReactNode> = {
    Temperature: <Thermometer className="h-3.5 w-3.5" />,
    Wind: <Wind className="h-3.5 w-3.5" />,
    Precipitation: <CloudRain className="h-3.5 w-3.5" />,
    Humidity: <Droplets className="h-3.5 w-3.5" />,
  };

  const impactColor = (impact: string) =>
    impact === "positive" ? "text-emerald-400" : impact === "neutral" ? "text-amber-400" : "text-red-400";

  const impactBorder = (impact: string) =>
    impact === "positive" ? "border-emerald-400/20" : impact === "neutral" ? "border-amber-400/20" : "border-red-400/20";

  return (
    <div className="grid grid-cols-2 gap-2">
      {factors.map((f) => (
        <div key={f.name} className={`rounded-lg border ${impactBorder(f.impact)} bg-slate-800/50 p-2.5`}>
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            {icons[f.name] || <Flag className="h-3.5 w-3.5" />}
            <span className="text-[10px] font-medium uppercase tracking-wider">{f.name}</span>
          </div>
          <p className={`font-mono text-lg font-bold ${impactColor(f.impact)}`}>{f.value}</p>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{f.detail}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Hourly Bar Chart ───────────────────────────────────────────

function HourlyBarChart({ hourly, verdict }: { hourly: WeatherPeriod[]; verdict: DayVerdict }) {
  const golf = hourly.filter((h) => {
    const hr = new Date(h.startTime).getHours();
    return hr >= 6 && hr <= 20;
  });

  if (!golf.length) return null;

  const maxScore = 100;

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Clock className="h-3 w-3 text-slate-500" />
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Hourly</span>
        {verdict.bestWindow && (
          <span className="text-[10px] text-emerald-400/70 ml-auto font-mono">
            Best: {verdict.bestWindow.startLabel}-{verdict.bestWindow.endLabel}
          </span>
        )}
      </div>
      <div className="flex items-end gap-px h-20">
        {golf.map((hour) => {
          const sc = calculateGolfConditions(hour).score;
          const hrNum = new Date(hour.startTime).getHours();
          const precip = hour.probabilityOfPrecipitation?.value ?? 0;
          const inWindow = verdict.bestWindow && hrNum >= verdict.bestWindow.startHour && hrNum < verdict.bestWindow.endHour;
          const heightPct = Math.max(8, (sc / maxScore) * 100);

          return (
            <div key={hour.startTime} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10">
                <div className="bg-slate-700 rounded px-2 py-1 text-[10px] text-slate-200 whitespace-nowrap shadow-lg font-mono">
                  {hour.temperature}° · {precip}% · {getGrade(sc).letter}
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-700" />
              </div>
              <div
                className={`w-full rounded-sm transition-all ${
                  inWindow ? scoreBg(sc) : scoreBg(sc)
                }`}
                style={{
                  height: `${heightPct}%`,
                  opacity: inWindow ? 0.9 : 0.35,
                }}
              />
              {hrNum % 3 === 0 && (
                <span className="text-[8px] text-slate-600 font-mono">
                  {hrNum === 0 ? "12a" : hrNum === 12 ? "12p" : hrNum > 12 ? `${hrNum - 12}p` : `${hrNum}a`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Loading State ──────────────────────────────────────────────

function DashboardLoading() {
  return (
    <div className="flex h-screen bg-slate-950 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 text-slate-500 animate-spin" />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Navigation className="h-3.5 w-3.5 animate-pulse" />
          <span>Finding nearby courses...</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────

export default function DashboardLanding() {
  const [nearbyCourses, setNearbyCourses] = useState<CourseWithWeather[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GolfCourse[]>([]);
  const [searching, setSearching] = useState(false);
  const { favorites, isFavorite, toggleFavorite, loaded: favsLoaded } = useFavorites();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch weather for a course ───────────────────────────────

  const fetchWeatherForCourse = useCallback(async (course: GolfCourse): Promise<CourseWithWeather | null> => {
    try {
      const res = await fetch(`/api/weather?lat=${course.lat.toFixed(4)}&lon=${course.lon.toFixed(4)}`);
      if (!res.ok) return null;
      const weather: WeatherData = await res.json();
      const dh = getHourlyForDay(weather.hourly, weather.periods[0]);
      const verdict = analyzeDayVerdict(weather.periods[0], dh);
      return { course, weather, score: verdict.dayScore, verdict };
    } catch {
      return null;
    }
  }, []);

  // ─── Init: geolocate + fetch nearby ───────────────────────────

  useEffect(() => {
    if (!favsLoaded) return;

    async function init() {
      let loc: { lat: number; lon: number } | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(loc);
      } catch {
        loc = { lat: 39.8283, lon: -98.5795 };
      }

      try {
        const res = await fetch(`/api/courses?lat=${loc.lat}&lon=${loc.lon}`);
        const data = await res.json();
        const nearby: GolfCourse[] = (data.courses || []).slice(0, 10);

        const favCourses = favorites.filter((fav) => !nearby.some((n) => n.id === fav.id));
        const allCourses = [...favCourses, ...nearby];

        if (!allCourses.length) {
          setError("No golf courses found nearby.");
          setLoading(false);
          return;
        }

        const results = await Promise.all(allCourses.map(fetchWeatherForCourse));
        const valid = results.filter(Boolean) as CourseWithWeather[];

        if (!valid.length) {
          setError("Could not load weather data.");
          setLoading(false);
          return;
        }

        setNearbyCourses(valid);

        const favResults = valid.filter((cw) => isFavorite(cw.course.id));
        const selectFrom = favResults.length > 0 ? favResults : valid;
        setSelectedCourse(selectFrom.reduce((a, b) => (b.score > a.score ? b : a)));
      } catch {
        setError("Failed to find nearby courses.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [favsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Search ───────────────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({ q: searchQuery.trim() });
      if (userLocation) {
        params.set("lat", String(userLocation.lat));
        params.set("lon", String(userLocation.lon));
      }
      fetch(`/api/courses?${params}`)
        .then((r) => r.json())
        .then((d) => setSearchResults(d.courses || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, userLocation]);

  // ─── Select a search result ───────────────────────────────────

  const handleSearchSelect = useCallback(
    async (course: GolfCourse) => {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedDayIndex(0);

      const existing = nearbyCourses.find((cw) => cw.course.id === course.id);
      if (existing) {
        setSelectedCourse(existing);
        return;
      }

      const result = await fetchWeatherForCourse(course);
      if (result) {
        setSelectedCourse(result);
        setNearbyCourses((prev) =>
          prev.some((c) => c.course.id === result.course.id) ? prev : [...prev, result]
        );
      }
    },
    [fetchWeatherForCourse, nearbyCourses]
  );

  // ─── Derived state ───────────────────────────────────────────

  const selectedPeriod = useMemo(() => {
    if (!selectedCourse) return null;
    return selectedCourse.weather.periods[Math.min(selectedDayIndex, selectedCourse.weather.periods.length - 1)];
  }, [selectedCourse, selectedDayIndex]);

  const selectedConditions = useMemo(
    () => (selectedPeriod ? calculateGolfConditions(selectedPeriod) : null),
    [selectedPeriod]
  );

  const selectedVerdict = useMemo(() => {
    if (!selectedCourse || !selectedPeriod) return null;
    return analyzeDayVerdict(selectedPeriod, getHourlyForDay(selectedCourse.weather.hourly, selectedPeriod));
  }, [selectedCourse, selectedPeriod]);

  const selectedDayHourly = useMemo(() => {
    if (!selectedCourse || !selectedPeriod) return [];
    return getHourlyForDay(selectedCourse.weather.hourly, selectedPeriod);
  }, [selectedCourse, selectedPeriod]);

  // ─── Sidebar lists ───────────────────────────────────────────

  const favCourses = useMemo(
    () => nearbyCourses.filter((cw) => isFavorite(cw.course.id)),
    [nearbyCourses, isFavorite]
  );

  const nonFavCourses = useMemo(
    () => nearbyCourses.filter((cw) => !isFavorite(cw.course.id)),
    [nearbyCourses, isFavorite]
  );

  // ─── Render ───────────────────────────────────────────────────

  if (loading) return <DashboardLoading />;

  if (error && !selectedCourse) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <XCircle className="h-8 w-8 text-red-400/60" />
          <p className="text-sm text-slate-400 max-w-xs">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const showSearchDropdown = searchQuery.trim().length >= 2;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* ─── LEFT SIDEBAR ──────────────────────────────────────── */}
      <aside className="w-80 shrink-0 border-r border-slate-800 flex flex-col bg-slate-950">
        {/* Header */}
        <div className="px-3 pt-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/15">
              <Flag className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-100">TeeWeathr</span>
          </div>

          {/* Search */}
          <div className="relative">
            <div className="flex items-center gap-2 rounded-md bg-slate-900 border border-slate-800 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses..."
                className="flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600 font-mono"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}>
                  <X className="h-3 w-3 text-slate-500 hover:text-slate-300" />
                </button>
              )}
            </div>

            {/* Search dropdown */}
            {showSearchDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {searching && (
                  <div className="flex items-center gap-2 p-3 text-xs text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" />Searching...
                  </div>
                )}
                {!searching && searchResults.length === 0 && (
                  <p className="p-3 text-xs text-slate-600">No courses found</p>
                )}
                {!searching &&
                  searchResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSearchSelect(c)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800 transition-colors border-b border-slate-800/50 last:border-0"
                    >
                      <Flag className="h-3 w-3 text-slate-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-600 truncate">
                          {c.city}{c.state ? `, ${c.state}` : ""}{c.distance !== undefined ? ` · ${c.distance} mi` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-3 w-3 text-slate-700" />
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Course list */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="py-2">
            {/* Favorites section */}
            {favCourses.length > 0 && (
              <>
                <div className="px-3 py-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600 flex items-center gap-1.5">
                    <Heart className="h-2.5 w-2.5 fill-slate-600" />
                    Favorites
                  </span>
                </div>
                {favCourses.map((cw) => (
                  <CourseRow
                    key={cw.course.id}
                    cw={cw}
                    isSelected={selectedCourse?.course.id === cw.course.id}
                    isFav={true}
                    onSelect={() => { setSelectedCourse(cw); setSelectedDayIndex(0); }}
                    onToggleFav={() => toggleFavorite(cw.course)}
                  />
                ))}
                <div className="h-px bg-slate-800/60 mx-3 my-1.5" />
              </>
            )}

            {/* Nearby section */}
            <div className="px-3 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600 flex items-center gap-1.5">
                <Navigation className="h-2.5 w-2.5" />
                Nearby
              </span>
            </div>
            {nonFavCourses.map((cw) => (
              <CourseRow
                key={cw.course.id}
                cw={cw}
                isSelected={selectedCourse?.course.id === cw.course.id}
                isFav={false}
                onSelect={() => { setSelectedCourse(cw); setSelectedDayIndex(0); }}
                onToggleFav={() => toggleFavorite(cw.course)}
              />
            ))}

            {nearbyCourses.length === 0 && (
              <p className="px-3 py-6 text-xs text-slate-600 text-center">No courses loaded</p>
            )}
          </div>
        </ScrollArea>

        {/* Sidebar footer */}
        <div className="px-3 py-2 border-t border-slate-800">
          <p className="text-[9px] text-slate-700 text-center">
            NWS Weather · OSM Courses
          </p>
        </div>
      </aside>

      {/* ─── RIGHT MAIN PANEL ──────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-slate-900">
        {!selectedCourse || !selectedPeriod || !selectedConditions || !selectedVerdict ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-600">Select a course from the sidebar</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
            {/* Course header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                    {selectedCourse.course.name}
                  </h1>
                  <button
                    onClick={() => toggleFavorite(selectedCourse.course)}
                    className="mt-0.5"
                  >
                    <Heart
                      className={`h-5 w-5 transition-colors ${
                        isFavorite(selectedCourse.course.id)
                          ? "fill-red-400 text-red-400"
                          : "text-slate-600 hover:text-red-400/60"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <MapPin className="h-3 w-3" />
                  <span>
                    {selectedCourse.course.city && selectedCourse.course.state
                      ? `${selectedCourse.course.city}, ${selectedCourse.course.state}`
                      : selectedCourse.weather.location}
                  </span>
                  <span className="text-slate-700">|</span>
                  <span className="font-mono">{selectedCourse.course.holes}h</span>
                  {selectedCourse.course.par && (
                    <>
                      <span className="text-slate-700">|</span>
                      <span className="font-mono">Par {selectedCourse.course.par}</span>
                    </>
                  )}
                  {selectedCourse.course.distance !== undefined && (
                    <>
                      <span className="text-slate-700">|</span>
                      <span className="font-mono">{selectedCourse.course.distance} mi</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Score ring (centered) */}
            <div className="flex justify-center py-2">
              <ScoreRing score={selectedVerdict.dayScore} size={180} />
            </div>

            {/* Day picker */}
            <div>
              <DayPicker
                periods={selectedCourse.weather.periods}
                hourly={selectedCourse.weather.hourly}
                selectedIndex={selectedDayIndex}
                onSelect={setSelectedDayIndex}
              />
            </div>

            {/* Verdict */}
            <VerdictBanner verdict={selectedVerdict} />

            {/* 2x2 Factor grid */}
            <FactorGrid factors={selectedConditions.factors} />

            {/* Hourly bar chart */}
            {selectedDayHourly.length > 0 && (
              <HourlyBarChart hourly={selectedDayHourly} verdict={selectedVerdict} />
            )}

            {/* Footer */}
            <div className="pt-2 border-t border-slate-800">
              <p className="text-[10px] text-slate-700 text-center font-mono">
                Updated {new Date(selectedCourse.weather.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
