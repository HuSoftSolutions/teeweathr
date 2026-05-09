"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Loader2, ArrowRight } from "lucide-react";
import type { GolfCourse } from "@/lib/courses";

// Public-facing course search for the landing-page hero. Hits
// /api/courses?q= which searches in-system courses by name/city/state.
// On selection, navigates to /forecast?lat=&lon=&name= so the forecast
// page can deep-link without prompting for browser geolocation.

export function CourseSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<GolfCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setMatches([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/courses?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setMatches((d.courses || []).slice(0, 6));
        })
        .catch(() => { if (!cancelled) setMatches([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  function navigate(course: GolfCourse) {
    const tzParam = course.timezone ? `&tz=${encodeURIComponent(course.timezone)}` : "";
    const url = `/forecast?lat=${course.lat}&lon=${course.lon}&name=${encodeURIComponent(course.name)}${tzParam}`;
    router.push(url);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && matches.length > 0) {
      e.preventDefault();
      navigate(matches[0]);
    }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        // Delay close so click on a result fires before blur dismisses.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder="Search any course in our network..."
        autoComplete="off"
        className="w-full rounded-2xl border border-zinc-300 bg-white pl-12 pr-12 py-4 text-base text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
      />
      {loading && (
        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 animate-spin" />
      )}

      {open && matches.length > 0 && (
        <ul className="absolute left-0 right-0 mt-2 z-20 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
          {matches.map((c) => (
            <li key={c.id}>
              {/* onMouseDown fires before input blur so the click registers. */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); navigate(c); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition-colors text-left border-b border-zinc-100 last:border-b-0"
              >
                <MapPin className="h-4 w-4 text-zinc-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{c.name}</p>
                  {(c.city || c.state) && (
                    <p className="text-xs text-zinc-500 truncate">
                      {[c.city, c.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-300 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && query.trim().length >= 2 && !loading && matches.length === 0 && (
        <div className="absolute left-0 right-0 mt-2 z-20 rounded-xl border border-zinc-200 bg-white shadow-lg px-4 py-4 text-sm text-zinc-500">
          No courses found for &ldquo;{query}&rdquo;. The course may not be in our network yet — ask the operator to integrate.
        </div>
      )}
    </div>
  );
}
