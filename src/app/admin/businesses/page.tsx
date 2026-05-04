"use client";

import { useState, useEffect } from "react";
import { Building2, Plus, ExternalLink, Loader2, X, Copy, Check } from "lucide-react";
import Link from "next/link";

interface Business {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  phone?: string;
  website?: string;
  subscription: { tier: string; status: string };
  courseIds: string[];
  createdAt: string | null;
}

const tierColors: Record<string, string> = {
  free: "bg-zinc-700/50 text-zinc-300",
  pro: "bg-emerald-500/20 text-emerald-400",
  enterprise: "bg-amber-500/20 text-amber-400",
};

// ─── Create Business Modal ──────────────────────────────────────

function CreateBusinessModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", contactName: "", contactEmail: "", phone: "", website: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ businessId: string; generatedPassword?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          phone: form.phone || undefined,
          website: form.website || undefined,
          password: form.password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create business");
      setResult(data);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!result) return;
    const text = `Email: ${form.contactEmail}\nPassword: ${result.generatedPassword || form.password}\nDashboard: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold">Create Business</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-zinc-500" /></button>
        </div>

        {result ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Check className="h-5 w-5" />
              <p className="text-sm font-medium">Business created</p>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4 text-sm space-y-1">
              <p className="text-zinc-400">Login credentials for <span className="text-zinc-200">{form.contactName}</span>:</p>
              <p className="text-zinc-300 font-mono text-xs mt-2">Email: {form.contactEmail}</p>
              <p className="text-zinc-300 font-mono text-xs">Password: {result.generatedPassword || form.password}</p>
              <p className="text-zinc-500 text-xs mt-2">Dashboard: {window.location.origin}/login</p>
            </div>
            <div className="flex gap-2">
              <button onClick={copyCredentials}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy credentials"}
              </button>
              <button onClick={onClose}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] text-zinc-500 mb-1 block">Business Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Contact Name *</label>
                <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Contact Email *</label>
                <input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} required type="email"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Website</label>
                <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-zinc-500 mb-1 block">Password <span className="text-zinc-600">(leave blank to auto-generate)</span></label>
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="text"
                  placeholder="Auto-generated if blank"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" />Create Business</>}
            </button>
            <p className="text-[11px] text-zinc-600 text-center">
              Creates a Firebase Auth account + Firestore business doc. You&apos;ll get login credentials to share.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((data) => setBusinesses(data.businesses || []))
      .catch(() => setBusinesses([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Businesses</h1>
          <p className="text-sm text-zinc-500">
            {businesses.length} registered {businesses.length === 1 ? "business" : "businesses"}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white transition-colors">
          <Plus className="h-4 w-4" />Create Business
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>
      ) : businesses.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <Building2 className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">No businesses yet</p>
          <p className="text-sm text-zinc-600 mt-1">Create a business to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Tier</th>
                  <th className="px-5 py-3 text-center">Courses</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {businesses.map((biz) => (
                  <tr key={biz.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-3 font-medium text-zinc-100">{biz.name}</td>
                    <td className="px-5 py-3">
                      <div className="text-zinc-300">{biz.contactName}</div>
                      <div className="text-xs text-zinc-500">{biz.contactEmail}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tierColors[biz.subscription?.tier] || tierColors.free}`}>
                        {biz.subscription?.tier || "free"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-zinc-300">{biz.courseIds?.length ?? 0}</td>
                    <td className="px-5 py-3 text-zinc-500 text-xs whitespace-nowrap">
                      {biz.createdAt ? new Date(biz.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/admin/businesses/${biz.id}`}
                        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
                        View<ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <CreateBusinessModal onClose={() => setShowCreate(false)} onCreated={() => setRefreshKey((k) => k + 1)} />}
    </div>
  );
}
