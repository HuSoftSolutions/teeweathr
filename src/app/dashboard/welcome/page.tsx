import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Code, Flag, MapPin, ExternalLink } from "lucide-react";
import { verifySession } from "@/lib/firebase/session";
import { db } from "@/lib/firebase/admin";
import { CopyKeyButton } from "./copy-key-button";
import { AddCourseCard } from "./add-course-card";

type CourseSummary = {
  id: string;
  name: string;
  formattedAddress?: string;
  city?: string;
  state?: string;
  hasCoords: boolean;
};

export default async function WelcomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("__session")?.value;
  if (!session) redirect("/login?redirect=/dashboard/welcome");

  const user = await verifySession(session);
  if (!user || user.role !== "business" || !user.businessId) {
    redirect("/login?redirect=/dashboard/welcome");
  }

  const bizDoc = await db.collection("businesses").doc(user.businessId).get();
  if (!bizDoc.exists) redirect("/dashboard");
  const biz = bizDoc.data()!;
  const apiKey: string = biz.embedApiKey;
  const tier: string = biz.subscription?.tier || "free";
  const courseIds: string[] = biz.courseIds || [];
  const hasCourses = courseIds.length > 0;

  // Resolve courses for the "Course set" panel + the live preview iframe.
  let courses: CourseSummary[] = [];
  if (hasCourses) {
    const snaps = await Promise.all(
      courseIds.map((id) => db.collection("courses").doc(id).get())
    );
    courses = snaps
      .filter((s) => s.exists)
      .map((s) => {
        const d = s.data()!;
        return {
          id: s.id,
          name: d.name || "(unnamed)",
          formattedAddress: d.formattedAddress,
          city: d.city,
          state: d.state,
          hasCoords: typeof d.lat === "number" && typeof d.lon === "number",
        };
      });
  }

  // Snippet shown to the customer uses the public production base URL — what
  // they'll paste into their site. Configurable via env so previews +
  // localhost don't show "https://teeweathr.com" if you don't want them to.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://teeweathr.com";
  const sampleSnippet = `<iframe
  src="${baseUrl}/embed?key=${apiKey}"
  width="100%" height="320"
  style="border:0; border-radius:12px"
  loading="lazy"
></iframe>`;

  // Live preview uses a relative URL so it always works regardless of
  // dev/preview/prod (no cross-origin issues, no needing the prod domain
  // configured for cookies / referrer / etc).
  const previewUrl = `/embed?key=${encodeURIComponent(apiKey)}`;

  // Origin for the "open in new tab" button — needs to be absolute. Use the
  // request's host so it works in dev (localhost:3000) and prod alike.
  const reqHeaders = await headers();
  const host = reqHeaders.get("host") || "";
  const proto = reqHeaders.get("x-forwarded-proto") || "http";
  const liveOrigin = host ? `${proto}://${host}` : baseUrl;
  const liveUrl = `${liveOrigin}/embed?key=${encodeURIComponent(apiKey)}`;

  const anyCourseMissingCoords = courses.some((c) => !c.hasCoords);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">You&rsquo;re in.</h1>
          <p className="text-sm text-zinc-500">Account created. <span className="capitalize">{tier}</span> tier.</p>
        </div>
      </div>

      {/* ─── Step 1: Add a course (only when none) ─── */}
      {!hasCourses && <AddCourseCard />}

      {/* ─── Course set confirmation (when courses exist) ─── */}
      {hasCourses && (
        <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 mb-6">
          <div className="flex items-start gap-3">
            <Flag className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-emerald-200 mb-2">
                {courses.length === 1 ? "Course set" : `${courses.length} courses set`}
              </h2>
              <ul className="space-y-1.5">
                {courses.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400/70 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-zinc-100">{c.name}</p>
                      <p className="text-[12px] text-zinc-400">
                        {c.formattedAddress || [c.city, c.state].filter(Boolean).join(", ") || "Address unavailable"}
                      </p>
                      {!c.hasCoords && (
                        <p className="text-[11px] text-amber-300 mt-0.5">
                          Missing coordinates — the widget can&rsquo;t render until this is fixed. Try removing and re-adding the course.
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <Link href="/dashboard/courses" className="text-emerald-300 hover:text-emerald-200 underline">
                  Manage courses
                </Link>
                <span className="text-zinc-700">·</span>
                <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 underline">
                  Open widget in new tab <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Live preview iframe ─── */}
      {hasCourses && !anyCourseMissingCoords && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Live preview</h2>
          <p className="text-sm text-zinc-400 mb-3">
            This is what your widget renders right now using your key + your course.
          </p>
          <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
            <iframe
              src={previewUrl}
              width="100%"
              height={320}
              style={{ border: 0, display: "block" }}
              loading="lazy"
              title="TeeWeathr widget preview"
            />
          </div>
        </section>
      )}

      {/* ─── API key ─── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Your API key</h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-200 break-all">
            {apiKey}
          </code>
          <CopyKeyButton value={apiKey} />
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">
          Treat this like a password. You can rotate it from Settings if it ever leaks.
        </p>
      </section>

      {/* ─── Embed snippet ─── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Code className="h-3.5 w-3.5 text-zinc-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Embed snippet</h2>
        </div>
        <p className="text-sm text-zinc-400 mb-3">
          Paste this anywhere on your website.
          {!hasCourses && <span className="text-amber-300"> It&rsquo;ll start working as soon as you add a course above.</span>}
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
          <pre className="px-4 py-3 text-[12px] text-zinc-200 font-mono leading-relaxed overflow-x-auto whitespace-pre">{sampleSnippet}</pre>
        </div>
      </section>

      {/* ─── Next steps ─── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Next steps</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link
            href="/dashboard/embed"
            className="rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 px-4 py-3 transition-colors"
          >
            <p className="text-sm font-semibold mb-1">Customize the widget</p>
            <p className="text-[11px] text-zinc-500">Pick theme, accent, and layout.</p>
          </Link>
          <Link
            href="/dashboard/analytics"
            className="rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 px-4 py-3 transition-colors"
          >
            <p className="text-sm font-semibold mb-1">View analytics</p>
            <p className="text-[11px] text-zinc-500">Impressions and interactions.</p>
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 px-4 py-3 transition-colors"
          >
            <p className="text-sm font-semibold mb-1">Dashboard home</p>
            <p className="text-[11px] text-zinc-500">Overview and settings.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
