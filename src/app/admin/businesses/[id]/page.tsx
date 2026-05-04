"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, Globe, Phone, Mail, Key, Flag, Code,
  Plus, Search, Loader2, X, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { EmbedConfigurator } from "@/components/embed-configurator";

interface Business {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  phone?: string;
  website?: string;
  firebaseUid: string;
  subscription: { tier: string; status: string };
  courseIds: string[];
  embedApiKey: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface Course {
  id: string;
  name: string;
  city?: string;
  state?: string;
  lat: number;
  lon: number;
  holes: number;
  par?: number;
}

const tierColors: Record<string, string> = {
  free: "bg-zinc-700/50 text-zinc-300",
  pro: "bg-emerald-500/20 text-emerald-400",
  enterprise: "bg-amber-500/20 text-amber-400",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">{label}</dt>
      <dd className="text-sm text-zinc-200">{children}</dd>
    </div>
  );
}

export default function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [biz, setBiz] = useState<Business | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);

  function reload() {
    fetch(`/api/admin/businesses/${id}`)
      .then((r) => r.json())
      .then((data) => { setBiz(data.business); setCourses(data.courses || []); })
      .catch(() => {});
  }

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/businesses/${id}`)
      .then((r) => r.json())
      .then((data) => { setBiz(data.business); setCourses(data.courses || []); })
      .finally(() => setLoading(false));
  }, [id]);

  async function unassignCourse(courseId: string) {
    if (!confirm("Remove this course from the business?")) return;
    await fetch(`/api/admin/businesses/${id}/courses`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    reload();
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>;
  if (!biz) return <div className="p-8"><p className="text-zinc-500">Business not found.</p></div>;

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/admin/businesses" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" />Back to businesses
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">{biz.name}</h1>
          <p className="text-sm text-zinc-500">ID: {id}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${tierColors[biz.subscription?.tier] || tierColors.free}`}>
          {biz.subscription?.tier || "free"}
        </span>
      </div>

      {/* Contact */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-4">
        <h2 className="text-sm font-semibold text-zinc-400 mb-4">Contact Information</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Contact Name">{biz.contactName}</Field>
          <Field label="Email"><span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-zinc-500" />{biz.contactEmail}</span></Field>
          {biz.phone && <Field label="Phone"><span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-zinc-500" />{biz.phone}</span></Field>}
          {biz.website && <Field label="Website"><span className="inline-flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-zinc-500" /><a href={biz.website} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-100">{biz.website}</a></span></Field>}
        </dl>
      </section>

      {/* Courses */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-400 flex items-center gap-2"><Flag className="h-4 w-4" />Courses ({courses.length})</h2>
          <button onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white">
            <Plus className="h-3 w-3" />Assign Course
          </button>
        </div>
        {courses.length > 0 ? (
          <div className="space-y-2">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{c.name}</p>
                  <p className="text-xs text-zinc-500">{c.city}{c.state ? `, ${c.state}` : ""} · {c.holes}h{c.par ? ` · Par ${c.par}` : ""}</p>
                </div>
                <button onClick={() => unassignCourse(c.id)} className="p-1.5 rounded hover:bg-zinc-700" title="Remove">
                  <Trash2 className="h-3.5 w-3.5 text-zinc-500 hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No courses assigned. Click &quot;Assign Course&quot; to link one.</p>
        )}
      </section>

      {/* Embed Configurator per course */}
      {courses.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-4">
          <h2 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
            <Code className="h-4 w-4" />Embed Code
          </h2>
          <div className="space-y-4">
            {courses.map((c) => (
              <CourseEmbedSection key={c.id} course={c} tier={biz.subscription?.tier || "free"} apiKey={biz.embedApiKey || ""} />
            ))}
          </div>
        </section>
      )}

      {/* Embed API Key */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-4">
        <h2 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2"><Key className="h-4 w-4" />Embed API Key</h2>
        <code className="text-xs font-mono bg-zinc-800 px-3 py-2 rounded text-zinc-300 select-all break-all block">{biz.embedApiKey}</code>
      </section>

      {/* Timestamps */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Created">{biz.createdAt ? new Date(biz.createdAt).toLocaleString() : "—"}</Field>
          <Field label="Updated">{biz.updatedAt ? new Date(biz.updatedAt).toLocaleString() : "—"}</Field>
        </dl>
      </section>

      {showAssign && <AssignCourseModal businessId={id} onClose={() => setShowAssign(false)} onAssigned={() => { setShowAssign(false); reload(); }} />}
    </div>
  );
}

// ─── Course Embed Section (expandable) ──────────────────────────

function CourseEmbedSection({ course, tier, apiKey }: { course: Course; tier: string; apiKey: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-zinc-800">
      <button onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors">
        <div>
          <p className="text-sm font-medium text-zinc-200">{course.name}</p>
          <p className="text-[11px] text-zinc-500">{course.city}{course.state ? `, ${course.state}` : ""}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-4">
          <EmbedConfigurator course={course} tier={tier} apiKey={apiKey} />
        </div>
      )}
    </div>
  );
}

// ─── Assign Course Modal ────────────────────────────────────────

function AssignCourseModal({ businessId, onClose, onAssigned }: { businessId: string; onClose: () => void; onAssigned: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Course[]>([]);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/admin/courses`).then((r) => r.json())
        .then((d) => {
          const all = (d.all || []) as Course[];
          const q = query.toLowerCase();
          setResults(all.filter((c: Course) => c.name.toLowerCase().includes(q) || (c.city && c.city.toLowerCase().includes(q)) || (c.state && c.state.toLowerCase().includes(q))));
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function assign(course: Course) {
    setAssigning(true);
    await fetch(`/api/admin/businesses/${businessId}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: course.id }),
    });
    setAssigning(false);
    onAssigned();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold">Assign Course</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-zinc-500" /></button>
        </div>
        <div className="px-5 py-3 border-b border-zinc-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
              placeholder="Search managed courses..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
          </div>
        </div>
        <div className="max-h-[40vh] overflow-y-auto p-3">
          {searching && <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-zinc-500" /></div>}
          {!searching && query.length < 2 && <p className="text-center text-sm text-zinc-600 py-6">Search for a course to assign</p>}
          {!searching && query.length >= 2 && results.length === 0 && <p className="text-center text-sm text-zinc-600 py-6">No courses found. Add courses first.</p>}
          {!searching && results.map((c) => (
            <button key={c.id} onClick={() => assign(c)} disabled={assigning}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-zinc-800 disabled:opacity-50">
              <Flag className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                <p className="text-[11px] text-zinc-500">{c.city}{c.state ? `, ${c.state}` : ""} · {c.holes}h</p>
              </div>
              <Plus className="h-3.5 w-3.5 text-zinc-600" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
