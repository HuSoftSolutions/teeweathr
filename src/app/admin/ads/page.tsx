"use client";

import { useEffect, useState } from "react";
import { Megaphone, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, X } from "lucide-react";

interface AdCreative {
  id: string;
  sponsor: string;
  text: string;
  imageUrl?: string;
  clickUrl: string;
  weight: number;
  active: boolean;
}

export default function AdsPage() {
  const [ads, setAds] = useState<AdCreative[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ sponsor: "", text: "", imageUrl: "", clickUrl: "", weight: 5, active: true });

  const fetchAds = async () => {
    const res = await fetch("/api/ads");
    const json = await res.json();
    setAds(json.ads ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAds(); }, []);

  const handleCreate = async () => {
    await fetch("/api/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    setForm({ sponsor: "", text: "", imageUrl: "", clickUrl: "", weight: 5, active: true });
    fetchAds();
  };

  const handleToggle = async (ad: AdCreative) => {
    await fetch("/api/ads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ad.id, active: !ad.active }),
    });
    fetchAds();
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/ads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchAds();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <Megaphone className="h-6 w-6" /> Ad Management
            </h1>
            <p className="mt-1 text-sm text-zinc-400">Manage sponsor placements for free-tier embeds</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition"
          >
            <Plus className="h-4 w-4" /> Create Ad
          </button>
        </div>

        {ads.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
            <Megaphone className="mx-auto mb-4 h-12 w-12 text-zinc-600" />
            <p className="text-lg font-medium text-zinc-300">No ad creatives yet</p>
            <p className="mt-2 text-sm text-zinc-500">Create your first ad creative to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ads.map((ad) => (
              <div key={ad.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-zinc-100">{ad.sponsor}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ad.active ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700 text-zinc-400"}`}>
                        {ad.active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-xs text-zinc-500">Weight: {ad.weight}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">{ad.text}</p>
                    <p className="mt-1 text-xs text-zinc-500 truncate">{ad.clickUrl}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={() => handleToggle(ad)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition" title="Toggle active">
                      {ad.active ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button onClick={() => handleDelete(ad.id)} className="rounded-lg p-2 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition" title="Delete">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">Create Ad Creative</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Sponsor Name</label>
                <input value={form.sponsor} onChange={(e) => setForm({ ...form, sponsor: e.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Ad Text</label>
                <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={2} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Image URL (optional)</label>
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Click URL</label>
                <input value={form.clickUrl} onChange={(e) => setForm({ ...form, clickUrl: e.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm text-zinc-400">Weight (1-10)</label>
                  <input type="number" min={1} max={10} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <label className="text-sm text-zinc-400">Active</label>
                  <button onClick={() => setForm({ ...form, active: !form.active })} className="text-zinc-300">
                    {form.active ? <ToggleRight className="h-6 w-6 text-emerald-400" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                </div>
              </div>
              <button onClick={handleCreate} disabled={!form.sponsor || !form.clickUrl} className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition disabled:opacity-50">
                Create Ad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
