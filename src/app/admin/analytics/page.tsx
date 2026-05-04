"use client";

import { useEffect, useState } from "react";
import { BarChart3, Eye, MousePointer, ExternalLink, Loader2 } from "lucide-react";

interface AnalyticsData {
  month: string;
  totals: { views: number; interactions: number; referrals: number };
  businesses: { businessKey: string; totalViews: number; totalInteractions: number; totalReferrals: number }[];
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="mx-auto max-w-4xl">
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
          </div>
          {data?.businesses.length === 0 ? (
            <p className="p-5 text-center text-sm text-zinc-500">No data yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-400">
                  <th className="px-5 py-3 font-medium">Business Key</th>
                  <th className="px-5 py-3 font-medium text-right">Views</th>
                  <th className="px-5 py-3 font-medium text-right">Interactions</th>
                </tr>
              </thead>
              <tbody>
                {data?.businesses.map((b) => (
                  <tr key={b.businessKey} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs text-zinc-300">{b.businessKey}</td>
                    <td className="px-5 py-3 text-right text-zinc-100">{b.totalViews.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-zinc-100">{b.totalInteractions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
