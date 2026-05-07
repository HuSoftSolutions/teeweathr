"use client";

import { Suspense, useEffect, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Flag, Loader2, AlertCircle } from "lucide-react";

const RECAPTCHA_ACTION = "signup";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  // Load reCAPTCHA v3 script when site key is configured. Without it we
  // still allow signup (server falls back to fail-open if no secret).
  useEffect(() => {
    if (!recaptchaSiteKey) {
      setRecaptchaReady(true); // pretend ready; we'll send no token
      return;
    }
    if (window.grecaptcha) {
      setRecaptchaReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.grecaptcha?.ready(() => setRecaptchaReady(true));
    };
    document.head.appendChild(script);
  }, [recaptchaSiteKey]);

  async function getRecaptchaToken(): Promise<string | null> {
    if (!recaptchaSiteKey || !window.grecaptcha) return null;
    return window.grecaptcha.execute(recaptchaSiteKey, { action: RECAPTCHA_ACTION });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (businessName.trim().length < 2) {
      setError("Course name is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create the Firebase Auth user client-side. This gives us an ID
      //    token we can hand to the server for verification.
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();

      // 2. Get a reCAPTCHA token (best-effort — null if not configured).
      const recaptchaToken = await getRecaptchaToken();

      // 3. Hand off to the server: verify reCAPTCHA, create business doc,
      //    set session cookie.
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          businessName: businessName.trim(),
          recaptchaToken,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Signup failed");
      }

      // 4. Route to next step: Stripe checkout if Pro, welcome page if Free.
      if (plan === "pro") {
        router.push("/api/subscription/checkout?plan=pro");
      } else {
        router.push("/dashboard/welcome");
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("auth/email-already-in-use")) {
          setError("That email is already registered. Try logging in instead.");
        } else if (err.message.includes("auth/weak-password")) {
          setError("Password is too weak. Use at least 8 characters.");
        } else if (err.message.includes("auth/invalid-email")) {
          setError("That email address looks invalid.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2.5 mb-10 hover:opacity-80 transition-opacity">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
            <Flag className="h-5 w-5 text-emerald-500" />
          </div>
          <span className="text-base font-semibold tracking-tight">TeeWeathr</span>
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {plan === "pro" ? "Start Pro" : "Create your free account"}
        </h1>
        <p className="text-sm text-zinc-400 mb-8">
          {plan === "pro"
            ? "We'll create your account, then take you to checkout."
            : "Add your course and embed the widget on your site in minutes."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="businessName" className="block text-xs font-medium text-zinc-400 mb-1.5">
              Course / business name
            </label>
            <input
              id="businessName"
              type="text"
              autoComplete="organization"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Pebble Beach Golf Links"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-zinc-400 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-zinc-400 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            />
            <p className="text-[11px] text-zinc-500 mt-1">At least 8 characters.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !recaptchaReady}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creating account..." : plan === "pro" ? "Continue to checkout" : "Create account"}
          </button>

        </form>

        <p className="mt-8 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300">Log in</Link>
        </p>

        {recaptchaSiteKey && (
          <p className="mt-10 text-center text-[10px] text-zinc-600">
            This site is protected by reCAPTCHA and the Google{" "}
            <a href="https://policies.google.com/privacy" className="underline hover:text-zinc-400" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            {" "}and{" "}
            <a href="https://policies.google.com/terms" className="underline hover:text-zinc-400" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            {" "}apply.
          </p>
        )}
      </div>
    </div>
  );
}
