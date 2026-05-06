"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Eye,
  MousePointer,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import { AnalyticsDetail } from "@/components/analytics-detail";

interface BusinessRow {
  apiKey: string;
  businessId: string | null;
  businessName: string;
  courseNames: string[];
  totalViews: number;
  totalInteractions: number;
  totalReferrals: number;
}

interface AnalyticsData {
  month: string;
  totals: { views: number; interactions: number; referrals: number };
  businesses: BusinessRow[];
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BusinessRow | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const totals = data?.totals ?? { views: 0, interactions: 0, referrals: 0 };

  const stats = [
    { label: "Total Views", value: totals.views, icon: Eye },
    { label: "Total Interactions", value: totals.interactions, icon: MousePointer },
    { label: "Total Referrals", value: totals.referrals, icon: ExternalLink },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Analytics
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Embed performance for {data?.month ?? "this month"}
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-2 text-zinc-400">
                <s.icon className="h-4 w-4" />
                <span className="text-sm">{s.label}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-100">{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-300">Per-Business Breakdown</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Click a row to see the same view the business owner sees.</p>
          </div>
          {data?.businesses.length === 0 ? (
            <p className="p-5 text-center text-sm text-zinc-500">No data yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-400">
                  <th className="px-5 py-3 font-medium">Business</th>
                  <th className="px-5 py-3 font-medium">Course(s)</th>
                  <th className="px-5 py-3 font-medium text-right">Views</th>
                  <th className="px-5 py-3 font-medium text-right">Interactions</th>
                  <th className="px-5 py-3 font-medium text-right">Referrals</th>
                </tr>
              </thead>
              <tbody>
                {data?.businesses.map((b) => (
                  <tr
                    key={b.apiKey}
                    onClick={() => setSelected(b)}
                    className="border-b border-zinc-800/50 last:border-0 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="text-zinc-100 font-medium">{b.businessName}</p>
                      <p className="text-[10px] text-zinc-600 font-mono mt-0.5 truncate max-w-[260px]">{b.apiKey}</p>
                    </td>
                    <td className="px-5 py-3 text-zinc-300">
                      {b.courseNames.length === 0 ? (
                        <span className="text-zinc-600">—</span>
                      ) : (
                        <span>{b.courseNames.join(", ")}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-100">{b.totalViews.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-zinc-100">{b.totalInteractions.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-zinc-100">{b.totalReferrals.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <BusinessDetailModal business={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function BusinessDetailModal({ business, onClose }: { business: BusinessRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-zinc-100 truncate">{business.businessName}</h2>
            {business.courseNames.length > 0 && (
              <p className="mt-0.5 text-xs text-zinc-400">{business.courseNames.join(" · ")}</p>
            )}
            <p className="mt-1 text-[10px] text-zinc-600 font-mono truncate">{business.apiKey}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <AnalyticsDetail apiKey={business.apiKey} />
      </div>
    </div>
  );
}
