"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { WeatherData, WeatherPeriod } from "@/lib/types";
import type { GolfCourse } from "@/lib/courses";
import { useFavorites } from "@/lib/use-favorites";
import { useCurrentDay } from "@/lib/use-current-day";
import {
  calculateGolfConditions, analyzeDayVerdict, getHourlyForDay, getGrade, getScoreColor, analyzeTimeBlocks,
  type TimeBlock,
} from "@/lib/golf-scoring";
import {
  Wind, Thermometer, CloudRain, Sun, Cloud, CloudSun,
  MapPin, Search, Flag, CircleAlert, RefreshCw,
  Loader2, X, Heart, ChevronDown,
  ShieldX, CheckCircle2, AlertTriangle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface CourseWeather {
  course: GolfCourse;
  weather: WeatherData;
}

// ─── Primitives ─────────────────────────────────────────────────

function WeatherIcon({ forecast, className = "h-5 w-5" }: { forecast: string; className?: string }) {
  const f = forecast.toLowerCase();
  if (f.includes("rain") || f.includes("shower") || f.includes("drizzle")) return <CloudRain className={`${className} text-blue-400`} />;
  if (f.includes("partly")) return <CloudSun className={`${className} text-amber-300`} />;
  if (f.includes("cloud") || f.includes("overcast")) return <Cloud className={`${className} text-zinc-400`} />;
  return <Sun className={`${className} text-amber-300`} />;
}

function RainIndicator({ precip, label }: { precip: number; label: string }) {
  // <40%: muted, barely visible. 40-59%: yellow. 60-79%: orange. 80%+: red washout.
  if (precip >= 80) return (
    <span className="flex items-center gap-0.5 text-red-400 font-medium">
      <CloudRain className="h-3 w-3" />{label}
    </span>
  );
  if (precip >= 60) return (
    <span className="flex items-center gap-0.5 text-orange-400">
      <CloudRain className="h-3 w-3" />{label}
    </span>
  );
  if (precip >= 40) return (
    <span className="flex items-center gap-0.5 text-amber-400">
      <CloudRain className="h-3 w-3" />{label}
    </span>
  );
  // Under 40%: subtle
  return <span className="text-zinc-600 text-[11px]">{precip}% rain</span>;
}

// ─── Time Block Row ─────────────────────────────────────────────

function BlockRow({ block }: { block: TimeBlock }) {
  const grade = block.grade;
  const color = getScoreColor(block.score);

  return (
    <div className="flex items-center gap-4 py-4 border-b border-zinc-800/60 last:border-0">
      {/* Grade */}
      <div className="w-12 shrink-0 text-center">
        <span className={`text-2xl font-bold ${color}`}>{grade.letter}</span>
      </div>

      {/* Time + forecast */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-100">{block.name}</span>
          <span className="text-xs text-zinc-500">{block.label}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
          <WeatherIcon forecast={block.forecast} className="h-3.5 w-3.5" />
          <span className="font-mono">{block.temp.high}°</span>
          <span className="flex items-center gap-0.5">
            <Wind className="h-3 w-3" />{block.wind.avg} mph
          </span>
          {block.danger ? (
            <span className="flex items-center gap-0.5 text-red-400">
              <ShieldX className="h-3 w-3" />{block.rain}
            </span>
          ) : block.rain ? (
            <RainIndicator precip={block.precip.peak} label={block.rain} />
          ) : (
            <span className="text-emerald-500/70">Dry</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Day Tab ────────────────────────────────────────────────────

function DayTab({ period, hourly, isSelected, onClick, todayStr }: {
  period: WeatherPeriod; hourly: WeatherPeriod[];
  isSelected: boolean; onClick: () => void; todayStr: string;
}) {
  const dayHourly = getHourlyForDay(hourly, period);
  const blocks = analyzeTimeBlocks(dayHourly);
  const hasHourly = blocks.length > 0;

  const best = hasHourly
    ? Math.max(...blocks.map((b) => b.score))
    : calculateGolfConditions(period).score;
  const grade = getGrade(best);
  const date = new Date(period.startTime);
  const isToday = date.toDateString() === todayStr;
  const tomorrow = new Date(new Date(todayStr).getTime() + 86400000).toDateString();
  const isTomorrow = date.toDateString() === tomorrow;
  const dayLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : date.toLocaleDateString([], { weekday: "short" });
  const dateLabel = date.toLocaleDateString([], { month: "short", day: "numeric" });
  const hasRain = hasHourly
    ? blocks.some((b) => b.rain && b.precip.peak >= 40)
    : (period.probabilityOfPrecipitation?.value ?? 0) >= 40;

  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-3 px-4 min-w-[64px] transition-all border-b-2 ${
        isSelected
          ? "border-zinc-100 text-zinc-100"
          : "border-transparent text-zinc-500 hover:text-zinc-300"
      }`}>
      <span className="text-[10px] font-medium uppercase tracking-wider">{dayLabel}</span>
      <span className={`text-[9px] ${isSelected ? "text-zinc-400" : "text-zinc-600"} -mt-0.5`}>{dateLabel}</span>
      <span className={`text-lg font-bold ${isSelected ? getScoreColor(best) : ""}`}>{grade.letter}</span>
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-mono">{period.temperature}°</span>
        {hasRain && <CloudRain className="h-2.5 w-2.5 text-blue-400" />}
      </div>
    </button>
  );
}

// ─── Course Picker ──────────────────────────────────────────────

function CoursePicker({ courses, selected, onSelect, isFavorite, onToggleFavorite, onSearch }: {
  courses: CourseWeather[]; selected: CourseWeather;
  onSelect: (cw: CourseWeather) => void;
  isFavorite: (id: string) => boolean; onToggleFavorite: (c: GolfCourse) => void;
  onSearch: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-left group">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 group-hover:text-white transition-colors">
            {selected.course.name}
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <MapPin className="h-3 w-3" />
            <span>{selected.course.city && selected.course.state
              ? `${selected.course.city}, ${selected.course.state}`
              : selected.weather.location}</span>
            {selected.course.distance !== undefined && (
              <span className="font-mono">· {selected.course.distance} mi</span>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-80 max-h-[60vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl z-50">
            {courses.map((cw) => {
              const isActive = cw.course.id === selected.course.id;
              const fav = isFavorite(cw.course.id);
              return (
                <div key={cw.course.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isActive ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                  }`}
                  onClick={() => { onSelect(cw); setOpen(false); }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{cw.course.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {cw.course.distance !== undefined && `${cw.course.distance} mi · `}{cw.course.holes}h
                    </p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(cw.course); }}
                    className="shrink-0">
                    <Heart className={`h-4 w-4 ${fav ? "fill-red-400 text-red-400" : "text-zinc-600 hover:text-zinc-400"}`} />
                  </button>
                </div>
              );
            })}
            <button onClick={() => { onSearch(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-4 py-3 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-t border-zinc-800">
              <Search className="h-3.5 w-3.5" />Search for a course...
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Search Modal ───────────────────────────────────────────────

function SearchModal({ isOpen, onClose, onSelect, userLocation, isFavorite, onToggleFavorite, favorites }: {
  isOpen: boolean; onClose: () => void; onSelect: (c: GolfCourse) => void;
  userLocation: { lat: number; lon: number } | null;
  isFavorite: (id: string) => boolean; onToggleFavorite: (c: GolfCourse) => void;
  favorites: GolfCourse[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GolfCourse[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({ q: query.trim() });
      if (userLocation) { params.set("lat", String(userLocation.lat)); params.set("lon", String(userLocation.lon)); }
      fetch(`/api/courses?${params}`).then((r) => r.json()).then((d) => setResults(d.courses || [])).catch(() => setResults([])).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, userLocation]);

  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 50); }, [isOpen]);

  if (!isOpen) return null;

  const showFavs = query.length < 2 && favorites.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="h-4 w-4 text-zinc-500" />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses..."
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
          {query && <button onClick={() => setQuery("")}><X className="h-3.5 w-3.5 text-zinc-500" /></button>}
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {searching && <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />Searching...</div>}

          {showFavs && (
            <div className="px-4 py-2">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium mb-1">Favorites</p>
              {favorites.map((c) => (
                <CourseRow key={c.id} course={c} onSelect={() => { onSelect(c); onClose(); setQuery(""); }}
                  isFav onToggleFav={() => onToggleFavorite(c)} />
              ))}
            </div>
          )}

          {!searching && query.length < 2 && favorites.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-600">Search for a course by name, city, or state</p>
          )}

          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">No courses found</p>
          )}

          {!searching && results.map((c) => (
            <CourseRow key={c.id} course={c} onSelect={() => { onSelect(c); onClose(); setQuery(""); }}
              isFav={isFavorite(c.id)} onToggleFav={() => onToggleFavorite(c)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CourseRow({ course, onSelect, isFav, onToggleFav }: {
  course: GolfCourse; onSelect: () => void; isFav: boolean; onToggleFav: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer">
      <div className="flex-1 min-w-0" onClick={onSelect}>
        <p className="text-sm text-zinc-200 truncate">{course.name}</p>
        <p className="text-[11px] text-zinc-500">
          {course.holes}h{course.par ? ` · Par ${course.par}` : ""}
          {course.city ? ` · ${course.city}` : ""}{course.state ? `, ${course.state}` : ""}
          {course.distance !== undefined && ` · ${course.distance} mi`}
        </p>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onToggleFav(); }} className="shrink-0 p-1">
        <Heart className={`h-3.5 w-3.5 ${isFav ? "fill-red-400 text-red-400" : "text-zinc-600 hover:text-zinc-400"}`} />
      </button>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────

export default function Home() {
  const [courses, setCourses] = useState<CourseWeather[]>([]);
  const [selected, setSelected] = useState<CourseWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [initialDaySet, setInitialDaySet] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { favorites, isFavorite, toggleFavorite, loaded: favsLoaded } = useFavorites();
  const [refreshKey, setRefreshKey] = useState(0);

  // Re-fetch weather when the day rolls over or tab regains focus after idle
  const todayStr = useCurrentDay(useCallback(() => {
    setRefreshKey((k) => k + 1);
    setInitialDaySet(false);
  }, []));

  const fetchCourse = useCallback(async (course: GolfCourse): Promise<CourseWeather | null> => {
    try {
      const res = await fetch(`/api/weather?lat=${course.lat.toFixed(4)}&lon=${course.lon.toFixed(4)}`);
      if (!res.ok) return null;
      const weather: WeatherData = await res.json();
      return { course, weather };
    } catch { return null; }
  }, []);

  useEffect(() => {
    if (!favsLoaded) return;
    async function init() {
      let loc: { lat: number; lon: number } | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(loc);
      } catch { loc = { lat: 39.8283, lon: -98.5795 }; }

      try {
        const res = await fetch(`/api/courses?lat=${loc.lat}&lon=${loc.lon}`);
        const data = await res.json();
        const nearby: GolfCourse[] = (data.courses || []).slice(0, 3);
        const favCourses = favorites.filter((f) => !nearby.some((n) => n.id === f.id));
        const all = [...favCourses, ...nearby].slice(0, 6);
        if (!all.length) { setError("No courses found nearby."); setLoading(false); return; }
        const results = await Promise.all(all.map(fetchCourse));
        const valid = results.filter(Boolean) as CourseWeather[];
        if (!valid.length) { setError("Could not load weather."); setLoading(false); return; }
        setCourses(valid);
        // Default to first favorite, or first nearby
        const favResult = valid.find((cw) => isFavorite(cw.course.id));
        setSelected(favResult || valid[0]);
      } catch { setError("Failed to load courses."); }
      finally { setLoading(false); }
    }
    init();
  }, [favsLoaded, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default to tomorrow if past playing hours
  useEffect(() => {
    if (!selected || initialDaySet) return;
    const hour = new Date().getHours();
    if (hour >= 18) {
      // Find the index of the next daytime period (tomorrow)
      const tomorrowIdx = selected.weather.periods.findIndex((p, i) => {
        if (i === 0) return false; // skip today
        return p.isDaytime;
      });
      if (tomorrowIdx > 0) setSelectedDayIndex(tomorrowIdx);
    }
    setInitialDaySet(true);
  }, [selected, initialDaySet]);

  const handleSearchSelect = useCallback(async (course: GolfCourse) => {
    setLoading(true); setSelectedDayIndex(0);
    const result = await fetchCourse(course);
    if (result) {
      setSelected(result);
      setCourses((p) => p.some((c) => c.course.id === result.course.id) ? p : [result, ...p]);
    }
    setLoading(false);
  }, [fetchCourse]);

  const handleSelectCourse = useCallback((cw: CourseWeather) => {
    setSelected(cw); setSelectedDayIndex(0);
  }, []);

  // Selected day data
  const selectedPeriod = useMemo(() => {
    if (!selected) return null;
    return selected.weather.periods[Math.min(selectedDayIndex, selected.weather.periods.length - 1)];
  }, [selected, selectedDayIndex]);

  const blocks = useMemo(() => {
    if (!selected || !selectedPeriod) return [];
    return analyzeTimeBlocks(getHourlyForDay(selected.weather.hourly, selectedPeriod));
  }, [selected, selectedPeriod]);

  const verdict = useMemo(() => {
    if (!selected || !selectedPeriod) return null;
    return analyzeDayVerdict(selectedPeriod, getHourlyForDay(selected.weather.hourly, selectedPeriod));
  }, [selected, selectedPeriod]);

  const bestBlock = useMemo(() => {
    if (!blocks.length) return null;
    return blocks.reduce((a, b) => (b.score > a.score ? b : a));
  }, [blocks]);

  // Day periods (daytime only)
  const dayPeriods = useMemo(() => {
    if (!selected) return [];
    return selected.weather.periods
      .map((p, i) => ({ period: p, index: i }))
      .filter((d) => d.period.isDaytime);
  }, [selected]);

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading weather...</span>
      </div>
    </div>
  );

  if (error && !selected) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <CircleAlert className="h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-400 text-center max-w-xs">{error}</p>
        <button onClick={() => window.location.reload()}
          className="text-sm text-zinc-300 hover:text-white flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />Try again
        </button>
      </div>
    </div>
  );

  if (!selected || !selectedPeriod || !verdict) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-xl px-5 py-6">
        {/* Header */}
        <header className="flex items-start justify-between mb-8">
          <CoursePicker
            courses={courses}
            selected={selected}
            onSelect={handleSelectCourse}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onSearch={() => setSearchOpen(true)}
          />
          <button onClick={() => setSearchOpen(true)}
            className="p-2 rounded-full hover:bg-zinc-800 transition-colors mt-0.5">
            <Search className="h-4 w-4 text-zinc-500" />
          </button>
        </header>

        {/* Week tabs */}
        <div className="flex border-b border-zinc-800 mb-6 overflow-x-auto">
          {dayPeriods.map((d) => (
            <DayTab key={d.period.number}
              period={d.period}
              hourly={selected.weather.hourly}
              isSelected={d.index === selectedDayIndex}
              onClick={() => setSelectedDayIndex(d.index)}
              todayStr={todayStr} />
          ))}
        </div>

        {/* Selected date */}
        <p className="text-xs text-zinc-500 mb-4">
          {new Date(selectedPeriod.startTime).toLocaleDateString([], {
            weekday: "long", month: "long", day: "numeric",
          })}
        </p>

        {/* Verdict line */}
        <div className="flex items-center gap-3 mb-6">
          {verdict.status === "go" ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> :
           verdict.status === "mixed" ? <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" /> :
           <ShieldX className="h-5 w-5 text-red-400 shrink-0" />}
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-200">{verdict.headline}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{verdict.detail}</p>
          </div>
          {bestBlock ? (
            <span className={`text-3xl font-bold ${getScoreColor(bestBlock.score)}`}>
              {bestBlock.grade.letter}
            </span>
          ) : (
            <span className={`text-3xl font-bold ${getScoreColor(verdict.dayScore)}`}>
              {getGrade(verdict.dayScore).letter}
            </span>
          )}
        </div>

        {/* Time blocks — or fallback for days without hourly data */}
        {blocks.length > 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 mb-6">
            {blocks.map((block) => (
              <BlockRow key={block.name} block={block} />
            ))}
          </div>
        ) : selectedPeriod && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4 mb-6">
            <div className="flex items-center gap-3">
              <WeatherIcon forecast={selectedPeriod.shortForecast} className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium text-zinc-200">{selectedPeriod.shortForecast}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {selectedPeriod.temperature}° · Wind {selectedPeriod.windSpeed} {selectedPeriod.windDirection}
                  {(selectedPeriod.probabilityOfPrecipitation?.value ?? 0) > 0 &&
                    ` · ${selectedPeriod.probabilityOfPrecipitation.value}% precip`}
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">{selectedPeriod.detailedForecast}</p>
          </div>
        )}

        {/* Recommendation */}
        {bestBlock && bestBlock.score >= 30 && (
          <div className="text-center text-sm text-zinc-500 mb-8">
            Best window: <span className="text-zinc-300 font-medium">{bestBlock.name}</span> ({bestBlock.label})
            {bestBlock.rain && <span> — {bestBlock.rain.toLowerCase()}</span>}
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-[11px] text-zinc-700">
          Weather: National Weather Service · {new Date(selected.weather.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </footer>
      </div>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect} userLocation={userLocation}
        isFavorite={isFavorite} onToggleFavorite={toggleFavorite} favorites={favorites} />
    </div>
  );
}
