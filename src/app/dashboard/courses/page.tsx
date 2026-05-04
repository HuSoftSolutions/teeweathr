"use client";

import { useState, useEffect } from "react";
import { Flag, MapPin, Loader2 } from "lucide-react";

interface Course {
  id: string;
  name: string;
  city?: string;
  state?: string;
  holes: number;
  par?: number;
}

export default function DashboardCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/business")
      .then((r) => r.json())
      .then((data) => setCourses(data.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">My Courses</h1>
      <p className="text-sm text-zinc-500 mb-6">Courses assigned to your account by TeeWeathr.</p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <Flag className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">No courses assigned yet</p>
          <p className="text-sm text-zinc-600 mt-1">Contact TeeWeathr to get your course set up.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <div key={c.id} className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
              <Flag className="h-5 w-5 text-zinc-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-zinc-100">{c.name}</p>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                  {(c.city || c.state) && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[c.city, c.state].filter(Boolean).join(", ")}</span>
                  )}
                  <span>{c.holes} holes{c.par ? ` · Par ${c.par}` : ""}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
