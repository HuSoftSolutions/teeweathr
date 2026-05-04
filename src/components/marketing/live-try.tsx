"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2, ArrowRight, MapPin } from "lucide-react";
import type { GolfCourse } from "@/lib/courses";
import type { WeatherData } from "@/lib/types";
import {
  analyzeDayVerdict, getHourlyForDay, getGrade, analyzeTimeBlocks,
} from "@/lib/golf-scoring";

type Result = {
  course: GolfCourse;
  weather: WeatherData;
};

function gradeColor(score: number): string {
  if (score >= 60) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

export function LiveTry() {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<GolfCourse[]>([]);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.trim().length < 2) { setMatches([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      fetch(`/api/courses?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((d) => setMatches((d.courses || []).slice(0, 5)))
        .catch(() => setMatches([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function loadCourse(course: GolfCourse) {
    setQuery(course.name);
    setMatches([]);
    setLoadingResult(true);
    setError(null);
    try {
      const res = await fetch(`/api/weather?lat=${course.lat.toFixed(4)}&lon=${course.lon.toFixed(4)}`);
      if (!res.ok) throw new Error();
      const weather: WeatherData = await res.json();
      setResult({ course, weather });
    } catch {
      setError("Weather unavailable. Try another course.");
    } finally {
      setLoadingResult(false);
    }
  }

  const today = result?.weather.periods.find((p) => p.isDaytime);
  const blocks = result && today ? analyzeTimeBlocks(getHourlyForDay(result.weather.hourly, today)) : [];
  const verdict = result && today ? analyzeDayVerdict(today, getHourlyForDay(result.weather.hourly, today)) : null;
  const best = blocks.length ? blocks.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  const score = best?.score ?? verdict?.dayScore ?? 0;
  const grade = getGrade(score);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-zinc-300 bg-white shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/15 transition-colors">
          <Search className="h-4 w-4 text-zinc-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try it: search any U.S. golf course..."
            className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          {searching && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
        </div>

        {matches.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-zinc-200 bg-white shadow-xl z-20 overflow-hidden">
            {matches.map((c) => (
              <button
                key={c.id}
                onClick={() => loadCourse(c)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors"
              >
                <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-800 truncate">{c.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                    {c.holes ? ` · ${c.holes}h` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {loadingResult && (
        <div className="mt-4 flex items-center justify-center gap-2 py-6 rounded-xl border border-zinc-200 bg-white">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          <span className="text-sm text-zinc-500">Pulling NWS data…</span>
        </div>
      )}

      {error && (
        <p className="mt-4 text-center text-sm text-zinc-500">{error}</p>
      )}

      {result && !loadingResult && verdict && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
          <div className="flex items-start gap-4">
            <span className={`text-5xl font-bold leading-none ${gradeColor(score)}`}>{grade.letter}</span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-zinc-900 truncate">{result.course.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {[result.course.city, result.course.state].filter(Boolean).join(", ") || result.weather.location}
                {today ? ` · ${today.temperature}°` : ""}
              </p>
              <p className="text-sm text-zinc-700 mt-2">{verdict.headline}</p>
              <p className="text-xs text-zinc-500 mt-1">{verdict.detail}</p>
            </div>
          </div>
          {blocks.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {blocks.map((b) => (
                <div key={b.name} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">{b.name}</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className={`text-xl font-bold ${gradeColor(b.score)}`}>{b.grade.letter}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{b.temp.high}°</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <a
            href={`/forecast`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            See the full forecast <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
