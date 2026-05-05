"use client";

import { useEffect, useState } from "react";
import { Code, Loader2 } from "lucide-react";
import { EmbedConfigurator } from "@/components/embed-configurator";

interface Course {
  id: string;
  name: string;
  lat: number;
  lon: number;
  holes: number;
  par?: number;
  city?: string;
  state?: string;
}

export default function DashboardEmbed() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [tier, setTier] = useState("free");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/business")
      .then((r) => r.json())
      .then((data) => {
        setCourses(data.courses || []);
        setTier(data.business?.subscription?.tier || "free");
        setApiKey(data.business?.embedApiKey || "");
      })
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />Loading...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Embed Widget</h1>
      <p className="text-sm text-zinc-500 mb-8">Add TeeWeathr to your website, social media, or emails</p>

      {courses.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <Code className="h-8 w-8 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">No courses assigned yet. Contact TeeWeathr to get set up.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {courses.map((course) => (
            <div key={course.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="text-sm font-semibold text-zinc-200 mb-4">{course.name}</h2>
              <EmbedConfigurator course={course} tier={tier} apiKey={apiKey} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
