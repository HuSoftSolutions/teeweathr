import { Settings as SettingsIcon, User, Mail } from "lucide-react";

export default function DashboardSettings() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Settings</h1>
      <p className="text-sm text-zinc-500 mb-8">Manage your business profile</p>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="h-5 w-5 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-400">Business Profile</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-zinc-800 px-4 py-3">
            <User className="h-4 w-4 text-zinc-500 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500">Business Name</p>
              <p className="text-sm text-zinc-300">Your business name</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-zinc-800 px-4 py-3">
            <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500">Email</p>
              <p className="text-sm text-zinc-300">your@email.com</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-600 mt-6">Profile editing coming soon.</p>
      </div>
    </div>
  );
}
