"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, MapPin, Loader2, Plus, AlertCircle, X } from "lucide-react";
import { PlacesAutocomplete, type SelectedPlace } from "@/components/places-autocomplete";

interface Course {
  id: string;
  name: string;
  city?: string;
  state?: string;
  formattedAddress?: string;
}

interface BusinessShape {
  id: string;
  tier: string;
  maxCourses: number;
  courseIds: string[];
}

export default function DashboardCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [biz, setBiz] = useState<BusinessShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/business");
      const data = await res.json();
      setCourses(data.courses || []);
      setBiz(data.business || null);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const atLimit = biz ? biz.courseIds.length >= biz.maxCourses : false;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your courses</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {biz && `Using ${biz.courseIds.length} of ${biz.maxCourses} (${biz.tier} plan).`}
          </p>
        </div>
        {!atLimit && !adding && biz && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-400 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add a course
          </button>
        )}
      </div>

      {atLimit && biz && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 mb-6 text-sm text-amber-200">
          You&rsquo;ve reached your course limit ({biz.maxCourses}).{" "}
          {biz.tier === "enterprise" ? (
            <>Email <a href="mailto:hello@teeweathr.com" className="underline">hello@teeweathr.com</a> to raise it.</>
          ) : (
            <>Upgrade to a multi-course plan to add more.</>
          )}
        </div>
      )}

      {adding && !atLimit && (
        <AddCourseSection
          onAdded={() => { setAdding(false); fetchCourses(); }}
          onCancel={() => setAdding(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center mt-6">
          <Flag className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">No courses yet</p>
          <p className="text-sm text-zinc-600 mt-1">Click &ldquo;Add a course&rdquo; above to get started.</p>
        </div>
      ) : (
        <div className="space-y-2 mt-6">
          {courses.map((c) => (
            <div key={c.id} className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
              <Flag className="h-5 w-5 text-zinc-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100">{c.name}</p>
                <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {c.formattedAddress || [c.city, c.state].filter(Boolean).join(", ") || "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddCourseSection({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelect = useCallback(async (place: SelectedPlace) => {
    setSelected(place);
    setState("saving");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/dashboard/courses/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: place.placeId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error || "Could not add course");
        return;
      }
      onAdded();
    } catch {
      setState("error");
      setErrorMsg("Network error — please try again");
    }
  }, [onAdded]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">Search for your course</h3>
        <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300">
          <X className="h-4 w-4" />
        </button>
      </div>
      <PlacesAutocomplete
        onSelect={handleSelect}
        placeholder="e.g. Pebble Beach Golf Links"
        countryRestriction={["us", "ca"]}
        disabled={state === "saving"}
      />
      {state === "saving" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Adding {selected?.name ?? "course"}...
        </div>
      )}
      {state === "error" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p>{errorMsg}</p>
            <button
              onClick={() => { setState("idle"); setErrorMsg(null); setSelected(null); }}
              className="text-xs underline text-red-300 hover:text-red-200 mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
