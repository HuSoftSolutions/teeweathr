"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import {
  Search, Star, Flag, Loader2, MapPin, Plus,
  Pencil, Trash2, X, Check, Save, AlertCircle,
} from "lucide-react";
import { PlacesAutocomplete, type SelectedPlace } from "@/components/places-autocomplete";

interface Course {
  id: string;
  name: string;
  city?: string;
  state?: string;
  lat: number;
  lon: number;
  holes?: number;
  par?: number;
  style?: string;
  claimStatus?: string;
  featured?: boolean;
  source?: string;
  formattedAddress?: string;
  placeId?: string;
  distance?: number;
}

// ─── Add Course Modal ───────────────────────────────────────────
//
// Two paths the admin can take:
//   1. Search Google Places (default — recommended)
//   2. Manual lat/lon entry — fallback for courses Places can't find

function AddCourseModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [tab, setTab] = useState<"places" | "manual">("places");
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manual, setManual] = useState({ name: "", city: "", state: "", lat: "", lon: "" });

  const handlePlaceSelect = useCallback(async (place: SelectedPlace) => {
    setSelected(place);
    setErrorMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: place.placeId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || "Could not add course");
        setSaving(false);
        return;
      }
      onAdded();
      onClose();
    } catch {
      setErrorMsg("Network error");
      setSaving(false);
    }
  }, [onAdded, onClose]);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manual.name || !manual.lat || !manual.lon) return;
    setSaving(true);
    setErrorMsg(null);
    const res = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: manual.name, city: manual.city, state: manual.state,
        lat: parseFloat(manual.lat), lon: parseFloat(manual.lon),
        featured: false,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorMsg(data.error || "Could not add course");
      setSaving(false);
      return;
    }
    setSaving(false);
    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold">Add Course</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-zinc-500" /></button>
        </div>

        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setTab("places")}
            className={`flex-1 px-4 py-2.5 text-xs font-medium border-b-2 ${tab === "places" ? "border-emerald-500 text-zinc-100" : "border-transparent text-zinc-500"}`}
          >
            Search Google Places
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 px-4 py-2.5 text-xs font-medium border-b-2 ${tab === "manual" ? "border-emerald-500 text-zinc-100" : "border-transparent text-zinc-500"}`}
          >
            Manual entry
          </button>
        </div>

        <div className="p-5 space-y-3">
          {tab === "places" ? (
            <>
              <p className="text-xs text-zinc-500 mb-2">Pick the course on Google. Address + coords come from Google.</p>
              <PlacesAutocomplete
                onSelect={handlePlaceSelect}
                placeholder="Search any course (Pebble Beach, Augusta, etc.)"
                disabled={saving}
              />
              {saving && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding {selected?.name ?? "course"}...
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] text-zinc-500 mb-1 block">Course Name *</label>
                  <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} required
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">City</label>
                  <input value={manual.city} onChange={(e) => setManual({ ...manual, city: e.target.value })}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">State</label>
                  <input value={manual.state} onChange={(e) => setManual({ ...manual, state: e.target.value })}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">Latitude *</label>
                  <input value={manual.lat} onChange={(e) => setManual({ ...manual, lat: e.target.value })} required type="number" step="any"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">Longitude *</label>
                  <input value={manual.lon} onChange={(e) => setManual({ ...manual, lon: e.target.value })} required type="number" step="any"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" />Add Course</>}
              </button>
            </form>
          )}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Row ───────────────────────────────────────────────────

function EditableCourseRow({ course, onUpdated, onDeleted }: {
  course: Course; onUpdated: () => void; onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(course);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/admin/courses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: course.id, name: form.name, city: form.city, state: form.state,
        lat: form.lat, lon: form.lon, holes: form.holes, par: form.par,
        style: form.style, featured: form.featured,
      }),
    });
    setSaving(false);
    setEditing(false);
    onUpdated();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${course.name}"? This cannot be undone.`)) return;
    await fetch("/api/admin/courses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: course.id }),
    });
    onDeleted();
  }

  async function toggleFeatured() {
    await fetch("/api/admin/courses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: course.id, featured: !course.featured }),
    });
    onUpdated();
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded border border-zinc-600 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none" placeholder="Name" />
          </div>
          <input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="rounded border border-zinc-600 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none" placeholder="City" />
          <input value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value })}
            className="rounded border border-zinc-600 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none" placeholder="State" />
          <input value={form.holes} onChange={(e) => setForm({ ...form, holes: parseInt(e.target.value) || 18 })} type="number"
            className="rounded border border-zinc-600 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none" placeholder="Holes" />
          <input value={form.par || ""} onChange={(e) => setForm({ ...form, par: parseInt(e.target.value) || undefined })} type="number"
            className="rounded border border-zinc-600 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none" placeholder="Par" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Save
          </button>
          <button onClick={() => { setEditing(false); setForm(course); }}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
            <X className="h-3 w-3" />Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 group">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100 truncate">{course.name}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
          {(course.city || course.state) && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[course.city, course.state].filter(Boolean).join(", ")}</span>
          )}
          <span>{course.holes}h{course.par ? ` / Par ${course.par}` : ""}</span>
          {course.source && <span className="text-zinc-600">{course.source}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {course.claimStatus === "claimed" && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Claimed</span>
        )}
        <button onClick={toggleFeatured} title={course.featured ? "Remove from featured" : "Add to featured"}
          className="p-1.5 rounded hover:bg-zinc-800 transition-colors">
          <Star className={`h-4 w-4 ${course.featured ? "fill-amber-400 text-amber-400" : "text-zinc-600 hover:text-amber-400"}`} />
        </button>
        <button onClick={() => setEditing(true)} title="Edit"
          className="p-1.5 rounded hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100">
          <Pencil className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
        </button>
        <button onClick={handleDelete} title="Delete"
          className="p-1.5 rounded hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100">
          <Trash2 className="h-3.5 w-3.5 text-zinc-500 hover:text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function AdminCoursesPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Course[]>([]);
  const [searching, setSearching] = useState(false);
  const [firestoreCourses, setFirestoreCourses] = useState<Course[]>([]);
  const [loadingFs, setLoadingFs] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function reload() { setRefreshKey((k) => k + 1); }

  useEffect(() => {
    queueMicrotask(() => setLoadingFs(true));
    fetch("/api/admin/courses")
      .then((r) => r.json())
      .then((data) => setFirestoreCourses(data.all || []))
      .catch(() => setFirestoreCourses([]))
      .finally(() => setLoadingFs(false));
  }, [refreshKey]);

  const tooShort = query.trim().length < 2;
  const visibleSearchResults = tooShort ? [] : searchResults;

  useEffect(() => {
    if (tooShort) return;
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/courses?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json()).then((d) => setSearchResults(d.courses || []))
        .catch(() => setSearchResults([])).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, tooShort]);

  const featured = firestoreCourses.filter((c) => c.featured);
  const managed = firestoreCourses.filter((c) => !c.featured);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {firestoreCourses.length} managed · in Firestore
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white transition-colors">
          <Plus className="h-4 w-4" />Add Course
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses..."
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600" />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-zinc-500" />}
      </div>

      {/* Search results */}
      {query.length >= 2 && (
        <div className="mb-8">
          <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            <Search className="h-3.5 w-3.5" />Search Results <span className="text-zinc-600">({visibleSearchResults.length})</span>
          </h2>
          {searching ? <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-zinc-500" /></div>
            : visibleSearchResults.length === 0 ? <p className="text-sm text-zinc-600 py-4">No results</p>
            : <div className="space-y-2">{visibleSearchResults.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-100 truncate">{c.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{c.city}{c.state ? `, ${c.state}` : ""} · {c.holes}h{c.par ? ` · Par ${c.par}` : ""}{c.distance !== undefined ? ` · ${c.distance} mi` : ""}</p>
                </div>
              </div>
            ))}</div>}
        </div>
      )}

      {/* Featured */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          <Star className="h-3.5 w-3.5" />Featured <span className="text-zinc-600">({featured.length})</span>
        </h2>
        {loadingFs ? <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-zinc-500" /></div>
          : featured.length === 0 ? <p className="text-sm text-zinc-600 py-4">No featured courses. Star a course to feature it.</p>
          : <div className="space-y-2">{featured.map((c) => (
            <EditableCourseRow key={c.id} course={c} onUpdated={reload} onDeleted={reload} />
          ))}</div>}
      </div>

      {/* All managed */}
      <div>
        <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          <Flag className="h-3.5 w-3.5" />Managed Courses <span className="text-zinc-600">({managed.length})</span>
        </h2>
        {loadingFs ? <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-zinc-500" /></div>
          : managed.length === 0 ? <p className="text-sm text-zinc-600 py-4">No managed courses yet. Add courses above.</p>
          : <div className="space-y-2">{managed.map((c) => (
            <EditableCourseRow key={c.id} course={c} onUpdated={reload} onDeleted={reload} />
          ))}</div>}
      </div>

      {showAdd && <AddCourseModal onClose={() => setShowAdd(false)} onAdded={reload} />}
    </div>
  );
}
