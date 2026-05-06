"use client";

import { useEffect, useState } from "react";
import { BarChart3, Eye, MousePointer, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Shared analytics body used by both the business dashboard and the
// admin per-business modal. Takes an apiKey, fetches /api/embed/analytics,
// renders the stats cards + Daily Views chart.

interface ChartPoint {
  date: string;
  views: number;
}

interface AnalyticsDoc {
  id: string;
  month: string;
  totalViews?: number;
  totalInteractions?: number;
  daily?: Record<string, { views?: number }>;
}

export function AnalyticsDetail({ apiKey }: { apiKey: string }) {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [viewsThisMonth, setViewsThisMonth] = useState(0);
  const [viewsLastMonth, setViewsLastMonth] = useState(0);
  const [totalInteractions, setTotalInteractions] = useState(0);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/embed/analytics?apiKey=${encodeURIComponent(apiKey)}&months=3`,
        );
        const json = await res.json();
        if (cancelled) return;

        const docs: AnalyticsDoc[] = json.analytics ?? [];
        if (docs.length === 0) {
          setLoading(false);
          return;
        }
        setHasData(true);

        const now = new Date();
        const thisMonth = now.toISOString().slice(0, 7);
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = lastMonthDate.toISOString().slice(0, 7);

        let monthViews = 0;
        let prevViews = 0;
        let interactions = 0;
        const dailyMap = new Map<string, number>();

        for (const doc of docs) {
          const views = doc.totalViews ?? 0;
          interactions += doc.totalInteractions ?? 0;
          if (doc.month === thisMonth) monthViews += views;
          if (doc.month === lastMonth) prevViews += views;
          if (doc.daily) {
            for (const [day, counts] of Object.entries(doc.daily)) {
              const existing = dailyMap.get(day) ?? 0;
              dailyMap.set(day, existing + (counts.views ?? 0));
            }
          }
        }

        setViewsThisMonth(monthViews);
        setViewsLastMonth(prevViews);
        setTotalInteractions(interactions);

        const sorted = Array.from(dailyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, views]) => ({ date: date.slice(5), views }));

        setChartData(sorted);
      } catch (err) {
        if (!cancelled) console.error("Failed to load analytics", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
        <BarChart3 className="mx-auto mb-4 h-12 w-12 text-zinc-600" />
        <p className="text-lg font-medium text-zinc-300">No Data Yet</p>
        <p className="mt-2 text-sm text-zinc-500">
          Analytics will appear once the embed gets views.
        </p>
      </div>
    );
  }

  const stats = [
    { label: "Views This Month", value: viewsThisMonth, icon: Eye },
    { label: "Views Last Month", value: viewsLastMonth, icon: Eye },
    { label: "Total Interactions", value: totalInteractions, icon: MousePointer },
  ];

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2 text-zinc-400">
              <s.icon className="h-4 w-4" />
              <span className="text-sm">{s.label}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-zinc-100">
              {s.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">Daily Views</h2>
        <div className="h-64">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-zinc-500">
              Daily breakdown will appear once events stream in.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  stroke="#3f3f46"
                />
                <YAxis
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  stroke="#3f3f46"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#a1a1aa" }}
                  itemStyle={{ color: "#10b981" }}
                />
                {/* Dots ON so a single-day series still has a visible mark — */}
                {/* lines need ≥2 points but a dot conveys "1 day's data". */}
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );
}
