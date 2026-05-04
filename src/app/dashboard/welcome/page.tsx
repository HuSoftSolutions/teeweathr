import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Code, ArrowRight, Flag } from "lucide-react";
import { verifySession } from "@/lib/firebase/session";
import { db } from "@/lib/firebase/admin";
import { CopyKeyButton } from "./copy-key-button";

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
  const hasCourses = (biz.courseIds || []).length > 0;

  const sampleSnippet = `<iframe
  src="https://teeweathr.com/embed?key=${apiKey}"
  width="100%" height="320"
  style="border:0; border-radius:12px"
  loading="lazy"
></iframe>`;

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

      {/* ─── Step 1: Add a course ─── */}
      {!hasCourses && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 mb-6">
          <div className="flex items-start gap-3">
            <Flag className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-amber-200 mb-1">One more step: pick your course</h2>
              <p className="text-sm text-zinc-300 mb-4">
                Search our index of 16,000+ U.S. courses (or add yours manually). The widget needs a course assigned before it can render a forecast.
              </p>
              <Link
                href="/dashboard/courses"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 transition-colors"
              >
                Add your course <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ─── Step 2: API key ─── */}
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

      {/* ─── Step 3: Embed snippet ─── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Code className="h-3.5 w-3.5 text-zinc-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Embed snippet</h2>
        </div>
        <p className="text-sm text-zinc-400 mb-3">
          Paste this anywhere on your website. {!hasCourses && <span className="text-amber-300">It&rsquo;ll start working as soon as you add a course above.</span>}
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
