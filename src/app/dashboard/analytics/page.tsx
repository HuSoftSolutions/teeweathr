"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AnalyticsDetail } from "@/components/analytics-detail";

export default function DashboardAnalyticsPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/business")
      .then((r) => r.json())
      .then((data) => setApiKey(data.business?.embedApiKey || ""))
      .catch(() => setApiKey(""))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-100 mb-1">Analytics</h1>
      <p className="text-sm text-zinc-400 mb-8">Track embed performance and engagement</p>
      {apiKey ? <AnalyticsDetail apiKey={apiKey} /> : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-sm text-zinc-500">No embed key on this account yet.</p>
        </div>
      )}
    </div>
  );
}
