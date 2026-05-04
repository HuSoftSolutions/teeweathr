"use client";

import { useRouter, usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/firebase/session";
import {
  LayoutDashboard, Building2, Flag,
  BarChart3, Megaphone, LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Businesses", href: "/admin/businesses", icon: Building2 },
  { label: "Courses", href: "/admin/courses", icon: Flag },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Ads", href: "/admin/ads", icon: Megaphone },
];

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-zinc-800 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-zinc-800">
          <p className="text-sm font-bold tracking-tight">TeeWeathr</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Admin</p>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <a key={item.href} href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}>
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-zinc-800 space-y-0.5">
          <div className="px-3 py-2">
            <p className="text-xs text-zinc-400 truncate">{user.email}</p>
            <p className="text-[10px] text-zinc-600">Admin</p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 w-full transition-colors">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
