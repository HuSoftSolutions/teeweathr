import { db } from "@/lib/firebase/admin";
import { Building2, Flag, BarChart3 } from "lucide-react";
import Link from "next/link";

async function getStats() {
  try {
    const [businessesSnap, totalCoursesSnap, assignedSnap] = await Promise.all([
      db.collection("businesses").count().get(),
      db.collection("courses").count().get(),
      db.collection("courses").where("claimedBy", "!=", "").count().get(),
    ]);
    return {
      businesses: businessesSnap.data().count,
      totalCourses: totalCoursesSnap.data().count,
      assignedCourses: assignedSnap.data().count,
    };
  } catch {
    return { businesses: 0, totalCourses: 0, assignedCourses: 0 };
  }
}

export default async function AdminOverview() {
  const stats = await getStats();

  const cards = [
    { label: "Businesses", value: stats.businesses, icon: Building2 },
    { label: "Total Courses", value: stats.totalCourses, icon: Flag },
    { label: "Assigned to Businesses", value: stats.assignedCourses, icon: BarChart3 },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Overview</h1>
      <p className="text-sm text-zinc-500 mb-8">TeeWeathr admin dashboard</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 text-zinc-500 mb-3">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="text-3xl font-bold font-mono">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-sm font-semibold text-zinc-400 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/businesses"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 transition-colors">
            Manage businesses
          </Link>
          <Link href="/admin/courses"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 transition-colors">
            Manage courses
          </Link>
        </div>
      </div>
    </div>
  );
}
