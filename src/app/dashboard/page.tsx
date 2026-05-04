"use client";

import { useEffect, useState } from "react";
import { Flag, Key, Crown, ArrowRight, Loader2 } from "lucide-react";

interface Course {
  id: string;
  name: string;
  city?: string;
  state?: string;
  holes?: number;
}

interface BusinessData {
  business: {
    id: string;
    name: string;
    email: string;
    subscriptionTier: string;
    embedApiKey: string;
    courseIds: string[];
  };
  courses: Course[];
}

export default function DashboardOverview() {
  const [data, setData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard/business");
        if (!res.ok) throw new Error("Failed to load business data");
        const json = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-red-400">{error || "Unable to load data"}</p>
      </div>
    );
  }

  const { business, courses } = data;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">{business.name}</h1>
      <p className="text-sm text-zinc-500 mb-8">Business dashboard overview</p>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 text-zinc-500 mb-3">
            <Crown className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Subscription</span>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-400 px-3 py-1 text-sm font-medium">
            {business.subscriptionTier || "Free"}
          </span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 text-zinc-500 mb-3">
            <Key className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Embed API Key</span>
          </div>
          <p className="text-sm font-mono text-zinc-300 truncate">{business.embedApiKey || "Not generated"}</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 text-zinc-500 mb-3">
            <Flag className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Courses</span>
          </div>
          <p className="text-3xl font-bold font-mono">{courses.length}</p>
        </div>
      </div>

      {/* Courses List */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-sm font-semibold text-zinc-400 mb-4">My Courses</h2>
        {courses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-500 mb-4">No courses assigned yet. Contact TeeWeathr to get set up.</p>
            <a
              href="/dashboard/courses"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-medium transition-colors"
            >
              View my courses
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {courses.map((course) => (
              <div key={course.id} className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{course.name}</p>
                  {(course.city || course.state) && (
                    <p className="text-xs text-zinc-500">{[course.city, course.state].filter(Boolean).join(", ")}</p>
                  )}
                </div>
                <span className="text-xs text-zinc-600">{course.holes || 18} holes</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analytics Placeholder */}
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-sm font-semibold text-zinc-400 mb-2">Embed Views</h2>
        <p className="text-sm text-zinc-600">Analytics coming soon</p>
      </div>
    </div>
  );
}
