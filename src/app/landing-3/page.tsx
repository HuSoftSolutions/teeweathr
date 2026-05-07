"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { WeatherData, WeatherPeriod, DayVerdict } from "@/lib/types";
import type { GolfCourse } from "@/lib/courses";
import { useFavorites } from "@/lib/use-favorites";
import {
  calculateGolfConditions,
  analyzeDayVerdict,
  getHourlyForDay,
  getGrade,
} from "@/lib/golf-scoring";
import {
  Wind, Thermometer, Droplets, CloudRain, Sun, Cloud, CloudSun,
  Search, Flag, Navigation, Loader2, X, Heart, Clock,
  CheckCircle2, XCircle, AlertTriangle, MapPin,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface CourseWithWeather {
  course: GolfCourse;
  weather: WeatherData;
  score: number;
  verdict: DayVerdict;
}

// ─── Helpers ────────────────────────────────────────────────────

function getCardGradient(score: number): string {
  if (score >= 80) return "from-emerald-500/30 to-emerald-900/60";
  if (score >= 60) return "from-teal-500/25 to-teal-900/50";
  if (score >= 40) return "from-amber-500/20 to-amber-900/50";
  return "from-red-500/20 to-red-900/50";
}

function getStatusBadge(status: DayVerdict["status"]): { text: string; cls: string } {
  if (status === "go") return { text: "GO", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
  if (status === "mixed") return { text: "PLAYABLE", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
  return { text: "SKIP", cls: "bg-red-500/20 text-red-400 border-red-500/30" };
}

function WeatherIcon({ forecast, className = "h-4 w-4" }: { forecast: string; className?: string }) {
  const f = forecast.toLowerCase();
  if (f.includes("rain") || f.includes("shower") || f.includes("drizzle")) return <CloudRain className={`${className} text-blue-400`} />;
  if (f.includes("partly")) return <CloudSun className={`${className} text-amber-300`} />;
  if (f.includes("cloud") || f.includes("overcast")) return <Cloud className={`${className} text-gray-400`} />;
  if (f.includes("wind")) return <Wind className={`${className} text-gray-400`} />;
  return <Sun className={`${className} text-amber-300`} />;
}

// ─── Hero Card ──────────────────────────────────────────────────

function HeroCard({
  cw, isExpanded, onToggle, isFav, onToggleFav,
}: {
  cw: CourseWithWeather;
  isExpanded: boolean;
  onToggle: () => void;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  const { course, weather, score, verdict } = cw;
  const badge = getStatusBadge(verdict.status);
  const period = weather.periods[0];
  const windSpeed = period.windSpeed.replace(/ mph/i, "");
  const precip = period.probabilityOfPrecipitation?.value ?? 0;

  // Expanded state
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const dayScrollRef = useRef<HTMLDivElement>(null);

  const selectedPeriod = useMemo(() => {
    const days = weather.periods.filter((p) => p.isDaytime);
    return days[selectedDayIndex] || weather.periods[0];
  }, [weather.periods, selectedDayIndex]);

  const dayHourly = useMemo(
    () => getHourlyForDay(weather.hourly, selectedPeriod, undefined),
    [weather.hourly, selectedPeriod]
  );

  const dayVerdict = useMemo(
    () => analyzeDayVerdict(selectedPeriod, dayHourly, undefined),
    [selectedPeriod, dayHourly]
  );

  const bestTeeTime = useMemo(() => {
    if (!dayHourly.length) return null;
    const golfHours = dayHourly.filter((h) => {
      const hr = new Date(h.startTime).getHours();
      return hr >= 6 && hr <= 17;
    });
    if (!golfHours.length) return null;
    const scored = golfHours.map((h) => ({ hour: h, score: calculateGolfConditions(h).score }));
    return scored.reduce((a, b) => (b.score > a.score ? b : a));
  }, [dayHourly]);

  const dayPeriods = weather.periods.filter((p) => p.isDaytime);

  return (
    <div className="w-full">
      {/* Main card - always visible */}
      <button
        onClick={onToggle}
        className={`w-full text-left rounded-3xl bg-gradient-to-br ${getCardGradient(score)} border border-white/10 p-6 transition-all duration-300 active:scale-[0.99] ${
          isExpanded ? "rounded-b-none border-b-0" : ""
        }`}
      >
        {/* Top row: location + heart */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-1.5 text-white/50 text-xs">
            <MapPin className="h-3 w-3" />
            <span>
              {course.city && course.state
                ? `${course.city}, ${course.state}`
                : `${course.holes} holes`}
            </span>
            {course.distance !== undefined && (
              <span className="ml-1 font-mono">{course.distance} mi</span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
            className="p-1 -m-1 transition-transform active:scale-90"
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={`h-5 w-5 transition-colors ${isFav ? "fill-red-400 text-red-400" : "text-white/30 hover:text-red-400/60"}`} />
          </button>
        </div>

        {/* Course name + score row */}
        <div className="flex items-end justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-white leading-tight truncate">
              {course.name}
            </h2>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-6xl font-black text-white/90 leading-none">
              {getGrade(score).letter}
            </span>
            <span className="text-xs text-white/50 mt-1">
              {getGrade(score).label}
            </span>
          </div>
        </div>

        {/* Badge + verdict */}
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-widest ${badge.cls}`}>
            {badge.text}
          </span>
          <span className="text-sm text-white/70 truncate">{verdict.headline}</span>
        </div>

        {/* Weather stats row */}
        <div className="flex items-center gap-4 text-white/60 text-xs">
          <span className="flex items-center gap-1">
            <Thermometer className="h-3.5 w-3.5" />
            <span className="font-mono font-semibold text-white/80">{period.temperature}°</span>
          </span>
          <span className="flex items-center gap-1">
            <Wind className="h-3.5 w-3.5" />
            <span className="font-mono font-semibold text-white/80">{windSpeed}</span>
          </span>
          <span className="flex items-center gap-1">
            <Droplets className="h-3.5 w-3.5" />
            <span className="font-mono font-semibold text-white/80">{precip}%</span>
          </span>
          <WeatherIcon forecast={period.shortForecast} className="h-3.5 w-3.5 ml-auto" />
          <span className="text-white/50 text-[11px]">{period.shortForecast}</span>
        </div>
      </button>

      {/* Expanded section */}
      <div
        className={`overflow-hidden transition-all duration-400 ease-in-out ${
          isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className={`rounded-b-3xl bg-gradient-to-br ${getCardGradient(score)} border border-t-0 border-white/10 px-6 pb-6`}>
          <div className="border-t border-white/10 pt-5">
            {/* Day picker */}
            <div ref={dayScrollRef} className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {dayPeriods.map((p, i) => {
                const date = new Date(p.startTime);
                const isToday = i === 0;
                const label = isToday ? "Today" : date.toLocaleDateString([], { weekday: "short" });
                const dh = getHourlyForDay(weather.hourly, p, undefined);
                const dv = analyzeDayVerdict(p, dh, undefined);
                const sel = i === selectedDayIndex;
                return (
                  <button
                    key={p.number}
                    onClick={(e) => { e.stopPropagation(); setSelectedDayIndex(i); }}
                    className={`flex flex-col items-center gap-1 rounded-2xl border px-4 py-2.5 min-w-[64px] transition-all ${
                      sel
                        ? "border-white/30 bg-white/15"
                        : "border-white/5 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">{label}</span>
                    <span className="text-lg font-bold text-white">{getGrade(dv.dayScore).letter}</span>
                    <span className="text-[10px] font-mono text-white/50">{p.temperature}°</span>
                  </button>
                );
              })}
            </div>

            {/* Day verdict detail */}
            <div className="rounded-2xl bg-black/20 border border-white/5 p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                {dayVerdict.status === "go" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                {dayVerdict.status === "mixed" && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                {dayVerdict.status === "no-go" && <XCircle className="h-4 w-4 text-red-400" />}
                <span className="text-sm font-semibold text-white">{dayVerdict.headline}</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">{dayVerdict.detail}</p>
              {bestTeeTime && dayVerdict.status !== "no-go" && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                  <Flag className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Best tee time:</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {new Date(bestTeeTime.hour.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className="text-xs text-white/40">
                    ({bestTeeTime.hour.temperature}°, {bestTeeTime.hour.shortForecast.toLowerCase()})
                  </span>
                </div>
              )}
            </div>

            {/* Hourly timeline */}
            {dayHourly.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="h-3 w-3 text-white/40" />
                  <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Hour by Hour</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {dayHourly
                    .filter((h) => {
                      const hr = new Date(h.startTime).getHours();
                      return hr >= 6 && hr <= 20;
                    })
                    .map((hour) => {
                      const hrScore = calculateGolfConditions(hour).score;
                      const hrNum = new Date(hour.startTime).getHours();
                      const hrPrecip = hour.probabilityOfPrecipitation?.value ?? 0;
                      const inWindow =
                        dayVerdict.bestWindow &&
                        hrNum >= dayVerdict.bestWindow.startHour &&
                        hrNum < dayVerdict.bestWindow.endHour;
                      return (
                        <div
                          key={hour.startTime}
                          className={`flex flex-col items-center gap-0.5 rounded-xl border px-2.5 py-2 min-w-[48px] ${
                            inWindow
                              ? "border-emerald-500/30 bg-emerald-500/10"
                              : "border-white/5 bg-white/5"
                          }`}
                        >
                          <span className="text-[9px] text-white/40 font-medium">
                            {hrNum === 0 ? "12a" : hrNum === 12 ? "12p" : hrNum > 12 ? `${hrNum - 12}p` : `${hrNum}a`}
                          </span>
                          <WeatherIcon forecast={hour.shortForecast} className="h-3 w-3" />
                          <span className="font-mono text-xs font-semibold text-white">{hour.temperature}°</span>
                          {hrPrecip > 0 && (
                            <span className={`text-[8px] font-mono ${hrPrecip >= 40 ? "text-blue-400" : "text-white/30"}`}>
                              {hrPrecip}%
                            </span>
                          )}
                          <div
                            className={`h-1 w-4 rounded-full ${
                              hrScore >= 80 ? "bg-emerald-400" : hrScore >= 60 ? "bg-teal-400" : hrScore >= 40 ? "bg-amber-400" : "bg-red-400"
                            }`}
                            style={{ opacity: 0.3 + (hrScore / 100) * 0.7 }}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Search Modal ───────────────────────────────────────────────

function SearchModal({
  isOpen, onClose, onSelect, userLocation,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (c: GolfCourse) => void;
  userLocation: { lat: number; lon: number } | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GolfCourse[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (isOpen && inputRef.current) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  const tooShort = query.trim().length < 2;
  const visibleResults = tooShort ? [] : results;

  useEffect(() => {
    if (tooShort) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({ q: query.trim() });
      if (userLocation) {
        params.set("lat", String(userLocation.lat));
        params.set("lon", String(userLocation.lon));
      }
      fetch(`/api/courses?${params}`)
        .then((r) => r.json())
        .then((d) => setResults(d.courses || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, userLocation, tooShort]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-gray-950 shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Search className="h-5 w-5 text-white/30" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any US golf course..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
          {query && (
            <button onClick={() => setQuery("")}>
              <X className="h-4 w-4 text-white/30" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {searching && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}
          {!searching && query.length < 2 && (
            <p className="py-10 text-center text-sm text-white/30">Type a course name, city, or state</p>
          )}
          {!searching && query.length >= 2 && visibleResults.length === 0 && (
            <p className="py-10 text-center text-sm text-white/30">No courses found</p>
          )}
          {!searching &&
            visibleResults.map((c) => (
              <button
                key={c.id}
                onClick={() => { onSelect(c); onClose(); setQuery(""); }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-white/5 transition-colors"
              >
                <Flag className="h-4 w-4 text-white/20 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.name}</p>
                  <p className="text-[11px] text-white/40">
                    {c.holes}h{c.par ? ` / Par ${c.par}` : ""}
                    {c.city ? ` / ${c.city}` : ""}
                    {c.state ? `, ${c.state}` : ""}
                  </p>
                </div>
                {c.distance !== undefined && (
                  <span className="text-[11px] font-mono text-white/30 shrink-0">{c.distance} mi</span>
                )}
              </button>
            ))}
        </div>

        <div className="border-t border-white/10 px-4 py-3 text-center">
          <button onClick={onClose} className="text-xs text-white/30 hover:text-white/50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading ────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-lg px-4 pt-16 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-white/30 animate-pulse" />
          <span className="text-sm text-white/40">Finding nearby courses...</span>
        </div>
        <div className="w-full flex flex-col gap-4 mt-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-52 rounded-3xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────

export default function Landing3() {
  const [courses, setCourses] = useState<CourseWithWeather[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const { favorites, isFavorite, toggleFavorite, loaded: favsLoaded } = useFavorites();

  const fetchWeatherForCourse = useCallback(async (course: GolfCourse): Promise<CourseWithWeather | null> => {
    try {
      const res = await fetch(`/api/weather?lat=${course.lat.toFixed(4)}&lon=${course.lon.toFixed(4)}`);
      if (!res.ok) return null;
      const weather: WeatherData = await res.json();
      const dh = getHourlyForDay(weather.hourly, weather.periods[0], undefined);
      const verdict = analyzeDayVerdict(weather.periods[0], dh, undefined);
      return { course, weather, score: verdict.dayScore, verdict };
    } catch {
      return null;
    }
  }, []);

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
        const nearby: GolfCourse[] = (data.courses || []).slice(0, 5);

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

        // Sort: favorites first, then by score descending
        valid.sort((a, b) => {
          const aFav = favorites.some((f) => f.id === a.course.id) ? 1 : 0;
          const bFav = favorites.some((f) => f.id === b.course.id) ? 1 : 0;
          if (aFav !== bFav) return bFav - aFav;
          return b.score - a.score;
        });

        setCourses(valid);
        // Auto-expand the top card
        if (valid.length > 0) setExpandedId(valid[0].course.id);
      } catch {
        setError("Failed to find nearby courses.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [favsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchSelect = useCallback(
    async (course: GolfCourse) => {
      setLoading(true);
      const result = await fetchWeatherForCourse(course);
      if (result) {
        setCourses((prev) => {
          const exists = prev.some((c) => c.course.id === result.course.id);
          const next = exists ? prev : [result, ...prev];
          return next;
        });
        setExpandedId(result.course.id);
      } else {
        setError("Could not load weather for that course.");
      }
      setLoading(false);
    },
    [fetchWeatherForCourse]
  );

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (loading) return <FeedSkeleton />;

  if (error && courses.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
        <div className="flex flex-col items-center gap-4">
          <XCircle className="h-10 w-10 text-red-500/60" />
          <p className="text-sm text-white/40 max-w-xs text-center">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-white/60 hover:bg-white/10 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="mx-auto max-w-lg px-4 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15">
            <Flag className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">TeeWeathr</h1>
            <p className="text-[11px] text-white/30 -mt-0.5">Golf weather, not weather app weather</p>
          </div>
        </div>
      </header>

      {/* Feed */}
      <main className="mx-auto max-w-lg px-4 pb-24 flex flex-col gap-4">
        {courses.map((cw) => (
          <HeroCard
            key={cw.course.id}
            cw={cw}
            isExpanded={expandedId === cw.course.id}
            onToggle={() => handleToggleExpand(cw.course.id)}
            isFav={isFavorite(cw.course.id)}
            onToggleFav={() => toggleFavorite(cw.course)}
          />
        ))}

        {/* Footer */}
        <p className="text-center text-[10px] text-white/20 mt-4">
          Weather: National Weather Service
        </p>
      </main>

      {/* FAB - Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-95 transition-all"
        aria-label="Search courses"
      >
        <Search className="h-6 w-6" />
      </button>

      {/* Search Modal */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
        userLocation={userLocation}
      />
    </div>
  );
}
