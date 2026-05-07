"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { WeatherData, WeatherPeriod, DayVerdict } from "@/lib/types";
import type { GolfCourse } from "@/lib/courses";
import { useFavorites } from "@/lib/use-favorites";
import {
  calculateGolfConditions,
  getCourseTip,
  analyzeDayVerdict,
  getHourlyForDay,
  getGrade,
} from "@/lib/golf-scoring";
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
  X,
  Heart,
  Clock,
  ChevronRight,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface CourseWithWeather {
  course: GolfCourse;
  weather: WeatherData;
  score: number;
  verdict: DayVerdict;
}

// ─── Palette helpers ────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function scoreStroke(score: number): string {
  if (score >= 80) return "stroke-emerald-600";
  if (score >= 60) return "stroke-amber-600";
  if (score >= 40) return "stroke-orange-500";
  return "stroke-red-500";
}

function verdictColor(status: DayVerdict["status"]): string {
  if (status === "go") return "text-emerald-700";
  if (status === "mixed") return "text-amber-700";
  return "text-red-600";
}

// ─── Weather Icon ───────────────────────────────────────────────

function WeatherIcon({ forecast, className = "h-5 w-5" }: { forecast: string; className?: string }) {
  const f = forecast.toLowerCase();
  if (f.includes("rain") || f.includes("shower") || f.includes("drizzle"))
    return <CloudRain className={`${className} text-sky-500`} />;
  if (f.includes("partly")) return <CloudSun className={`${className} text-amber-500`} />;
  if (f.includes("cloud") || f.includes("overcast"))
    return <Cloud className={`${className} text-zinc-400`} />;
  if (f.includes("wind")) return <Wind className={`${className} text-zinc-400`} />;
  return <Sun className={`${className} text-amber-500`} />;
}

// ─── Giant Score Ring ───────────────────────────────────────────

function ScoreRing({ score, size = 220 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const p = (score / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8} className="stroke-zinc-200" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8}
          strokeDasharray={c} strokeDashoffset={c - p} strokeLinecap="round"
          className={`${scoreStroke(score)} transition-all duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-6xl font-light tracking-tight ${scoreColor(score)} transition-colors duration-500`}>
          {getGrade(score).letter}
        </span>
        <span className="text-sm text-zinc-400 tracking-wide mt-1">{getGrade(score).label}</span>
      </div>
    </div>
  );
}

// ─── Day Picker Pills ───────────────────────────────────────────

function DayPicker({
  periods, hourly, selectedIndex, onSelect,
}: {
  periods: WeatherPeriod[]; hourly: WeatherPeriod[]; selectedIndex: number; onSelect: (i: number) => void;
}) {
  const days = periods.map((p, i) => ({ period: p, index: i })).filter((d) => d.period.isDaytime);
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {days.map((d) => {
        const dh = getHourlyForDay(hourly, d.period, undefined);
        const v = analyzeDayVerdict(d.period, dh, undefined);
        const sel = d.index === selectedIndex;
        const date = new Date(d.period.startTime);
        const isToday = d.index === 0 || (d.index === 1 && !periods[0].isDaytime);
        const label = isToday ? "Today" : date.toLocaleDateString([], { weekday: "short" });
        return (
          <button
            key={d.period.number}
            onClick={() => onSelect(d.index)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
              sel
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            <span>{label}</span>
            <span className={`text-xs ${sel ? "text-zinc-300" : "text-zinc-400"}`}>
              {getGrade(v.dayScore).letter}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Conditions Table ───────────────────────────────────────────

function ConditionsTable({ period }: { period: WeatherPeriod }) {
  const conditions = calculateGolfConditions(period);
  const icons: Record<string, React.ReactNode> = {
    Temperature: <Thermometer className="h-4 w-4 text-zinc-400" />,
    Wind: <Wind className="h-4 w-4 text-zinc-400" />,
    Precipitation: <CloudRain className="h-4 w-4 text-zinc-400" />,
    Humidity: <Droplets className="h-4 w-4 text-zinc-400" />,
  };
  const impactDot = (impact: string) => {
    if (impact === "positive") return "bg-emerald-500";
    if (impact === "neutral") return "bg-amber-400";
    return "bg-red-400";
  };
  return (
    <div className="divide-y divide-zinc-100">
      {conditions.factors.map((f) => (
        <div key={f.name} className="flex items-center py-3.5 gap-3">
          {icons[f.name]}
          <span className="text-sm text-zinc-500 w-28">{f.name}</span>
          <span className="text-sm font-mono font-semibold text-zinc-800 flex-1">{f.value}</span>
          <span className={`h-2 w-2 rounded-full ${impactDot(f.impact)}`} />
          <span className="text-xs text-zinc-400 text-right w-44 hidden sm:block">{f.detail}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Hourly Row ─────────────────────────────────────────────────

function HourlyView({ hourly, verdict }: { hourly: WeatherPeriod[]; verdict: DayVerdict }) {
  const golf = hourly.filter((h) => {
    const hr = new Date(h.startTime).getHours();
    return hr >= 6 && hr <= 20;
  });
  if (!golf.length) return null;
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max pb-2">
        {golf.map((hour) => {
          const score = calculateGolfConditions(hour).score;
          const precip = hour.probabilityOfPrecipitation?.value ?? 0;
          const hrNum = new Date(hour.startTime).getHours();
          const inWindow =
            verdict.bestWindow &&
            hrNum >= verdict.bestWindow.startHour &&
            hrNum < verdict.bestWindow.endHour;
          const timeLabel =
            hrNum === 0 ? "12a" : hrNum === 12 ? "12p" : hrNum > 12 ? `${hrNum - 12}p` : `${hrNum}a`;
          return (
            <div
              key={hour.startTime}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2.5 min-w-[54px] transition-colors ${
                inWindow ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-zinc-50"
              }`}
            >
              <span className="text-[10px] font-medium text-zinc-400">{timeLabel}</span>
              <WeatherIcon forecast={hour.shortForecast} className="h-3.5 w-3.5" />
              <span className="font-mono text-sm font-semibold text-zinc-700">{hour.temperature}°</span>
              {precip > 0 && (
                <span className={`text-[9px] font-mono ${precip >= 40 ? "text-sky-500 font-semibold" : "text-zinc-400"}`}>
                  {precip}%
                </span>
              )}
              <div
                className={`h-1 w-5 rounded-full ${
                  score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-400" : score >= 40 ? "bg-orange-400" : "bg-red-400"
                }`}
                style={{ opacity: 0.3 + (score / 100) * 0.7 }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Course Search ──────────────────────────────────────────────

function CourseSearch({
  onSelect,
  userLocation,
  isFavorite,
  onToggleFavorite,
}: {
  onSelect: (c: GolfCourse) => void;
  userLocation: { lat: number; lon: number } | null;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (c: GolfCourse) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GolfCourse[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 rounded-full border px-4 py-2.5 transition-colors ${
          open ? "border-zinc-300 bg-white shadow-sm" : "border-zinc-200 bg-zinc-50"
        }`}
      >
        <Search className="h-4 w-4 text-zinc-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search any course..."
          className="flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); }}>
            <X className="h-3.5 w-3.5 text-zinc-400" />
          </button>
        )}
      </div>

      {open && (query.length >= 2 || visibleResults.length > 0) && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 z-20 rounded-2xl border border-zinc-200 bg-white shadow-lg max-h-72 overflow-y-auto">
            {searching && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching...
              </div>
            )}
            {!searching && query.length >= 2 && visibleResults.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-400">No courses found</p>
            )}
            {!searching &&
              visibleResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                    setQuery("");
                    setResults([]);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                >
                  <Flag className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{c.name}</p>
                    <p className="text-xs text-zinc-400">
                      {c.holes}h{c.par ? ` · Par ${c.par}` : ""}
                      {c.city ? ` · ${c.city}` : ""}
                      {c.state ? `, ${c.state}` : ""}
                    </p>
                  </div>
                  {c.distance !== undefined && (
                    <span className="text-xs font-mono text-zinc-400 shrink-0">{c.distance} mi</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(c); }}
                    className="shrink-0"
                  >
                    <Heart
                      className={`h-4 w-4 transition-colors ${
                        isFavorite(c.id) ? "fill-red-400 text-red-400" : "text-zinc-300 hover:text-red-300"
                      }`}
                    />
                  </button>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Loading ────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="bg-white text-zinc-900 min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="h-10 w-10 rounded-full border-2 border-zinc-200 border-t-emerald-600 animate-spin" />
      <p className="text-sm text-zinc-400 tracking-wide">Finding your course...</p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function LandingOnePage() {
  const [courseData, setCourseData] = useState<CourseWithWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
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
        const courses: GolfCourse[] = data.courses || [];

        // Pick the first favorite or the first nearby course
        const favCourse = favorites.find((fav) => courses.some((n) => n.id === fav.id)) || favorites[0];
        const target = favCourse || courses[0];

        if (!target) {
          setError("No golf courses found nearby.");
          setLoading(false);
          return;
        }

        const result = await fetchWeatherForCourse(target);
        if (result) {
          setCourseData(result);
        } else {
          setError("Could not load weather data.");
        }
      } catch {
        setError("Failed to find nearby courses.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [favsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCourseSelect = useCallback(
    async (course: GolfCourse) => {
      setLoading(true);
      setSelectedDayIndex(0);
      const result = await fetchWeatherForCourse(course);
      if (result) {
        setCourseData(result);
      } else {
        setError("Could not load weather for that course.");
      }
      setLoading(false);
    },
    [fetchWeatherForCourse]
  );

  // Derived state
  const selectedPeriod = useMemo(() => {
    if (!courseData) return null;
    return courseData.weather.periods[Math.min(selectedDayIndex, courseData.weather.periods.length - 1)];
  }, [courseData, selectedDayIndex]);

  const selectedConditions = useMemo(
    () => (selectedPeriod ? calculateGolfConditions(selectedPeriod) : null),
    [selectedPeriod]
  );

  const selectedVerdict = useMemo(() => {
    if (!courseData || !selectedPeriod) return null;
    return analyzeDayVerdict(selectedPeriod, getHourlyForDay(courseData.weather.hourly, selectedPeriod, undefined), undefined);
  }, [courseData, selectedPeriod]);

  const selectedDayHourly = useMemo(() => {
    if (!courseData || !selectedPeriod) return [];
    return getHourlyForDay(courseData.weather.hourly, selectedPeriod, undefined);
  }, [courseData, selectedPeriod]);

  const bestTeeTime = useMemo(() => {
    if (!selectedDayHourly.length) return null;
    const dh = selectedDayHourly.filter((h) => {
      const hr = new Date(h.startTime).getHours();
      return hr >= 6 && hr <= 17;
    });
    if (!dh.length) return null;
    const scored = dh.map((h) => ({ hour: h, score: calculateGolfConditions(h).score }));
    return scored.reduce((a, b) => (b.score > a.score ? b : a));
  }, [selectedDayHourly]);

  // ─── Render ─────────────────────────────────────────────────

  if (loading) return <LoadingState />;

  if (error && !courseData) {
    return (
      <div className="bg-white text-zinc-900 min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-zinc-500 text-center max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-emerald-600 font-medium hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!courseData || !selectedPeriod || !selectedConditions || !selectedVerdict) return null;

  const { course, weather } = courseData;
  const tip = getCourseTip(course.style || "Parkland", selectedConditions, selectedPeriod);

  return (
    <div className="bg-white text-zinc-900 min-h-screen">
      {/* Header */}
      <header className="mx-auto max-w-2xl px-6 pt-10 pb-2">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-xs font-semibold tracking-widest text-emerald-700 uppercase">
              TeeWeathr
            </span>
          </div>
          <button
            onClick={() => toggleFavorite(course)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 transition-colors"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                isFavorite(course.id) ? "fill-red-400 text-red-400" : ""
              }`}
            />
            {isFavorite(course.id) ? "Saved" : "Save"}
          </button>
        </div>

        {/* Course search */}
        <div className="mb-10">
          <CourseSearch
            onSelect={handleCourseSelect}
            userLocation={userLocation}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />
        </div>

        {/* Course name - large, editorial */}
        <div className="mb-2">
          <h1 className="text-4xl font-light tracking-tight text-zinc-900 leading-tight sm:text-5xl">
            {course.name}
          </h1>
          <p className="text-sm text-zinc-400 mt-2 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {course.city && course.state ? `${course.city}, ${course.state}` : weather.location}
            {course.holes && <span className="text-zinc-300 mx-1">·</span>}
            {course.holes && `${course.holes} holes`}
            {course.par && <span className="text-zinc-300 mx-1">·</span>}
            {course.par && `Par ${course.par}`}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6">
        {/* Hero score ring */}
        <section className="flex flex-col items-center py-10">
          <ScoreRing score={selectedVerdict.dayScore} size={220} />

          {/* Verdict as a colored sentence */}
          <p className={`text-lg font-medium mt-6 text-center max-w-md ${verdictColor(selectedVerdict.status)}`}>
            {selectedVerdict.headline}
          </p>
          <p className="text-sm text-zinc-400 mt-2 text-center max-w-sm leading-relaxed">
            {selectedVerdict.detail}
          </p>

          {/* Danger callout */}
          {selectedVerdict.danger !== "none" && selectedVerdict.dangerDetail && (
            <p className={`text-sm mt-3 px-4 py-2 rounded-full ${
              selectedVerdict.danger === "danger"
                ? "bg-red-50 text-red-600"
                : "bg-amber-50 text-amber-700"
            }`}>
              {selectedVerdict.dangerDetail}
            </p>
          )}
        </section>

        {/* Best tee time callout */}
        {bestTeeTime && selectedVerdict.status !== "no-go" && (
          <section className="mb-8 flex items-center justify-center">
            <div className="flex items-center gap-3 bg-emerald-50 rounded-full px-6 py-3">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-800 font-medium">Best tee time</span>
              <span className="text-lg font-mono font-semibold text-emerald-700">
                {new Date(bestTeeTime.hour.startTime).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-sm text-emerald-500">
                {bestTeeTime.hour.temperature}° · {bestTeeTime.hour.shortForecast.toLowerCase()}
              </span>
            </div>
          </section>
        )}

        {/* Day picker pills */}
        <section className="mb-8">
          <DayPicker
            periods={weather.periods}
            hourly={weather.hourly}
            selectedIndex={selectedDayIndex}
            onSelect={setSelectedDayIndex}
          />
        </section>

        {/* Conditions table */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-4">
            Conditions
          </h2>
          <ConditionsTable period={selectedPeriod} />
        </section>

        {/* Hourly view */}
        {selectedDayHourly.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-4 flex items-center gap-2">
              Hour by Hour
              {selectedVerdict.bestWindow && (
                <span className="text-emerald-600 font-normal normal-case tracking-normal">
                  — best window highlighted
                </span>
              )}
            </h2>
            <HourlyView hourly={selectedDayHourly} verdict={selectedVerdict} />
          </section>
        )}

        {/* Playing tip */}
        {selectedVerdict.status !== "no-go" && (
          <section className="mb-10">
            <div className="border-l-2 border-emerald-200 pl-5 py-1">
              <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-2">
                Playing Tip
              </p>
              <p className="text-sm text-zinc-600 leading-relaxed">{tip}</p>
            </div>
          </section>
        )}

        {/* Favorites quick-switch */}
        {favorites.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-4">
              Saved Courses
            </h2>
            <div className="flex flex-wrap gap-2">
              {favorites.map((fav) => (
                <button
                  key={fav.id}
                  onClick={() => handleCourseSelect(fav)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                    fav.id === course.id
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <Heart className="h-3 w-3 fill-red-400 text-red-400" />
                  {fav.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-zinc-100 py-6 text-center">
          <p className="text-[11px] text-zinc-300">
            Weather: National Weather Service ·{" "}
            {new Date(weather.generatedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </footer>
      </main>
    </div>
  );
}
