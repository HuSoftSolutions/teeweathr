import { db } from "@/lib/firebase/admin";
import { unstable_cache } from "next/cache";
import {
  Building2, Flag, BarChart3, TrendingUp, Eye, MousePointerClick, Users,
  Crown, UserPlus, Info,
} from "lucide-react";
import Link from "next/link";

// Cache the overview reads for 30 s — admin refresh-spamming shouldn't fan
// out new Firestore reads each time. Bust via
// revalidateTag("admin-overview", "max") from any mutation that should
// reflect immediately. (Next 16 requires the second swr-profile argument.)
const OVERVIEW_TAG = "admin-overview";
const OVERVIEW_TTL_SEC = 30;

type Overview = {
  businessesCount: number;
  totalCoursesCount: number;
  assignedCoursesCount: number;
  tierBreakdown: { free: number; pro: number; enterprise: number; other: number };
  mtdImpressions: number;
  mtdInteractions: number;
  mtdReferrals: number;
  activeCustomersThisMonth: number;
  topCustomers: Array<{
    apiKey: string;
    businessName: string;
    tier: string;
    courseCount: number;
    impressions: number;
    interactions: number;
  }>;
  recentSignups: Array<{
    id: string;
    name: string;
    email: string;
    tier: string;
    createdAt: string | null;
  }>;
};

const loadOverview = unstable_cache(
  async (): Promise<Overview> => {
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [businessesSnap, totalCoursesSnap, assignedSnap, allBusinesses, mtdAnalytics] =
      await Promise.all([
        db.collection("businesses").count().get(),
        db.collection("courses").count().get(),
        db.collection("courses").where("claimedBy", "!=", "").count().get(),
        db.collection("businesses").get(),
        db.collection("analytics").where("month", "==", month).get(),
      ]);

    // Tier breakdown + apiKey → business map (used by topCustomers)
    const tier = { free: 0, pro: 0, enterprise: 0, other: 0 };
    const byApiKey = new Map<string, { name: string; tier: string }>();
    const recentSignups: Overview["recentSignups"] = [];

    for (const doc of allBusinesses.docs) {
      const d = doc.data();
      const t: string = d.subscription?.tier || "free";
      if (t === "free") tier.free++;
      else if (t === "pro") tier.pro++;
      else if (t === "enterprise") tier.enterprise++;
      else tier.other++;

      const apiKey: string | undefined = d.embedApiKey;
      if (apiKey) byApiKey.set(apiKey, { name: d.name || "(unnamed)", tier: t });

      const createdAtRaw = d.createdAt;
      // Firestore Timestamp → Date
      const createdAt = createdAtRaw?.toDate ? createdAtRaw.toDate() : null;
      if (createdAt && createdAt >= sevenDaysAgo) {
        recentSignups.push({
          id: doc.id,
          name: d.name || "(unnamed)",
          email: d.email || "",
          tier: t,
          createdAt: createdAt.toISOString(),
        });
      }
    }
    recentSignups.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    // Aggregate MTD analytics by apiKey
    let mtdImpressions = 0;
    let mtdInteractions = 0;
    let mtdReferrals = 0;
    const perKey = new Map<string, { impressions: number; interactions: number; courseCount: number }>();
    for (const doc of mtdAnalytics.docs) {
      const d = doc.data();
      const views: number = d.totalViews || 0;
      const interactions: number = d.totalInteractions || 0;
      const referrals: number = d.totalReferrals || 0;
      mtdImpressions += views;
      mtdInteractions += interactions;
      mtdReferrals += referrals;

      const key: string = d.apiKey;
      if (!key) continue;
      const cur = perKey.get(key) || { impressions: 0, interactions: 0, courseCount: 0 };
      cur.impressions += views;
      cur.interactions += interactions;
      cur.courseCount += 1; // each doc represents one (key, course, month) tuple
      perKey.set(key, cur);
    }

    const topCustomers: Overview["topCustomers"] = [...perKey.entries()]
      .map(([apiKey, agg]) => {
        const biz = byApiKey.get(apiKey);
        return {
          apiKey,
          businessName: biz?.name || "(unknown)",
          tier: biz?.tier || "unknown",
          courseCount: agg.courseCount,
          impressions: agg.impressions,
          interactions: agg.interactions,
        };
      })
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);

    return {
      businessesCount: businessesSnap.data().count,
      totalCoursesCount: totalCoursesSnap.data().count,
      assignedCoursesCount: assignedSnap.data().count,
      tierBreakdown: tier,
      mtdImpressions,
      mtdInteractions,
      mtdReferrals,
      activeCustomersThisMonth: perKey.size,
      topCustomers,
      recentSignups: recentSignups.slice(0, 5),
    };
  },
  ["admin-overview-v1"],
  { revalidate: OVERVIEW_TTL_SEC, tags: [OVERVIEW_TAG] }
);

function StatCard({ label, value, icon: Icon, hint }: {
  label: string; value: number | string; icon: React.ElementType; hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center gap-2 text-zinc-500 mb-3">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-bold font-mono text-zinc-100">{value}</p>
      {hint && <p className="text-[11px] text-zinc-500 mt-1">{hint}</p>}
    </div>
  );
}

function fmtNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default async function AdminOverview() {
  const o = await loadOverview();
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Overview</h1>
        <p className="text-sm text-zinc-500">Morning glance — refreshes every {OVERVIEW_TTL_SEC}s.</p>
      </div>

      {/* ─── Top-level counts ─── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Inventory</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Businesses" value={fmtNumber(o.businessesCount)} icon={Building2} />
          <StatCard label="Total Courses" value={fmtNumber(o.totalCoursesCount)} icon={Flag} />
          <StatCard label="Assigned to Businesses" value={fmtNumber(o.assignedCoursesCount)} icon={BarChart3} />
        </div>
      </section>

      {/* ─── Tier distribution ─── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Tier distribution</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Free" value={fmtNumber(o.tierBreakdown.free)} icon={Users} />
          <StatCard label="Pro" value={fmtNumber(o.tierBreakdown.pro)} icon={TrendingUp} />
          <StatCard label="Enterprise" value={fmtNumber(o.tierBreakdown.enterprise)} icon={Crown} />
          {o.tierBreakdown.other > 0 && (
            <StatCard label="Other / Unknown" value={fmtNumber(o.tierBreakdown.other)} icon={Info} />
          )}
        </div>
      </section>

      {/* ─── This month (paid customer impressions) ─── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">{monthLabel} (keyed embeds)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Impressions" value={fmtNumber(o.mtdImpressions)} icon={Eye} />
          <StatCard label="Interactions" value={fmtNumber(o.mtdInteractions)} icon={MousePointerClick} />
          <StatCard label="Referral Clicks" value={fmtNumber(o.mtdReferrals)} icon={TrendingUp} />
          <StatCard label="Active Customers" value={fmtNumber(o.activeCustomersThisMonth)} icon={Users} hint="customers with ≥1 view this month" />
        </div>
      </section>

      {/* ─── Top customers ─── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Top 5 customers · by impressions this month</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          {o.topCustomers.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">No keyed-embed activity this month yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-500">
                <tr>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider">Business</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider">Tier</th>
                  <th className="text-right px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider">Courses</th>
                  <th className="text-right px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider">Impressions</th>
                  <th className="text-right px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider">Interactions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {o.topCustomers.map((c) => (
                  <tr key={c.apiKey} className="hover:bg-zinc-900/80 transition-colors">
                    <td className="px-5 py-3 text-zinc-200">{c.businessName}</td>
                    <td className="px-5 py-3 text-zinc-400 capitalize">{c.tier}</td>
                    <td className="px-5 py-3 text-right font-mono text-zinc-300">{c.courseCount}</td>
                    <td className="px-5 py-3 text-right font-mono text-zinc-100">{fmtNumber(c.impressions)}</td>
                    <td className="px-5 py-3 text-right font-mono text-zinc-300">{fmtNumber(c.interactions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ─── Recent signups ─── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">New signups · last 7 days</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          {o.recentSignups.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">No new signups in the last 7 days.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-500">
                <tr>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider">Business</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider">Email</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider">Tier</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {o.recentSignups.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-900/80 transition-colors">
                    <td className="px-5 py-3 text-zinc-200">{s.name}</td>
                    <td className="px-5 py-3 text-zinc-400 font-mono text-xs">{s.email}</td>
                    <td className="px-5 py-3 text-zinc-400 capitalize"><UserPlus className="h-3 w-3 inline mr-1 text-zinc-600" />{s.tier}</td>
                    <td className="px-5 py-3 text-zinc-500">{fmtRelative(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ─── Quick actions ─── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/businesses"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 transition-colors">
            Manage businesses
          </Link>
          <Link href="/admin/courses"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 transition-colors">
            Manage courses
          </Link>
          <Link href="/admin/analytics"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 transition-colors">
            Per-customer analytics
          </Link>
        </div>
      </section>

      {/* ─── Phase 2 hint ─── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" /> Coming next (requires log drain)
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Cache hit rate, 5xx counts, top IPs, top referrer domains, and 429 rate
          live in Vercel runtime logs. Wire a log drain to BetterStack /
          Logtail / Datadog and these tiles light up. Until then, see Vercel&apos;s
          built-in <strong className="text-zinc-300">Logs</strong> and
          <strong className="text-zinc-300"> Web Analytics</strong> tabs.
        </p>
      </section>
    </div>
  );
}
