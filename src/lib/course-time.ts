// ─── Course-timezone helpers ─────────────────────────────────────
//
// One rule, applied everywhere: when we display anything about a course
// (an hour, a day label, a "Today" / "Tomorrow" tag), we use the
// *course's* IANA timezone — not the viewer's.
//
// Backed by Intl.DateTimeFormat with an explicit `timeZone` option, which
// is stable across Node and every modern browser, handles DST automatically,
// and works identically on the server and the client (so SSR and hydration
// agree without any "viewer-tz" leak).
//
// Every function takes an IANA tz string (e.g. "America/Los_Angeles"). If
// the tz is missing or invalid we fall back to the runtime's default zone
// and emit a single dev-only warning so the gap is loud during development
// but never throws in production.

const VIEWER_TZ_FALLBACK_LOGGED = new Set<string>();

function resolveTz(tz: string | undefined | null): string {
  if (tz && tz.length > 0) return tz;
  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (process.env.NODE_ENV !== "production" && !VIEWER_TZ_FALLBACK_LOGGED.has(fallback)) {
    VIEWER_TZ_FALLBACK_LOGGED.add(fallback);
    console.warn(`[course-time] missing tz, falling back to viewer (${fallback})`);
  }
  return fallback;
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

// ─── Internal: extract Intl date parts in a tz ──────────────────

type DateParts = {
  year: string;   // "2026"
  month: string;  // "05"
  day: string;    // "08"
  hour: string;   // "07" (24-hour)
  weekday: string; // "Tue"
};

function parts(d: Date | string, tz: string): DateParts {
  const date = toDate(d);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const out: Partial<DateParts> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type === "year") out.year = part.value;
    else if (part.type === "month") out.month = part.value;
    else if (part.type === "day") out.day = part.value;
    else if (part.type === "hour") out.hour = part.value === "24" ? "00" : part.value;
    else if (part.type === "weekday") out.weekday = part.value;
  }
  return out as DateParts;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * ISO-style day key in the course's tz. Use this for grouping periods
 * by day and for "is this period on today's date" comparisons.
 *
 * @example dayKeyInTz("2026-05-08T03:00:00Z", "America/Los_Angeles") === "2026-05-07"
 */
export function dayKeyInTz(d: Date | string, tz: string | undefined | null): string {
  const t = resolveTz(tz);
  const p = parts(d, t);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Hour (0–23) at the given moment, in the course's tz. Used by
 * time-block bucketing in golf-scoring.
 */
export function hourInTz(d: Date | string, tz: string | undefined | null): number {
  const t = resolveTz(tz);
  return parseInt(parts(d, t).hour, 10);
}

/**
 * Short weekday name ("Mon", "Tue", …) in the course's tz.
 */
export function weekdayShortInTz(d: Date | string, tz: string | undefined | null): string {
  const t = resolveTz(tz);
  return parts(d, t).weekday;
}

/**
 * General-purpose Intl formatter pre-bound to the course's tz. Pass the
 * same options you'd pass to toLocaleDateString / toLocaleTimeString.
 */
export function formatInTz(
  d: Date | string,
  tz: string | undefined | null,
  options: Intl.DateTimeFormatOptions
): string {
  const t = resolveTz(tz);
  return new Intl.DateTimeFormat([], { ...options, timeZone: t }).format(toDate(d));
}

/**
 * The course's "today" as an ISO day key. Compare against `dayKeyInTz(periodStart, tz)`
 * to decide whether a forecast period is today at the course.
 */
export function todayKeyInTz(tz: string | undefined | null): string {
  return dayKeyInTz(new Date(), tz);
}

/**
 * Short timezone label for the moment (DST-aware): "PST", "PDT", "EST",
 * etc. Used for the "course time" hint badge so a viewer in a different
 * tz knows the times shown are course-local. Returns "" if tz is missing.
 *
 * @example tzShortLabel("America/Los_Angeles") === "PST" (in winter)
 */
export function tzShortLabel(tz: string | undefined | null): string {
  if (!tz) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/**
 * The course's "tomorrow" as an ISO day key. Always exactly one calendar
 * day after today *in the course's tz* — handles DST transitions correctly
 * because we add 24 hours via Date math then re-format in the tz, but use
 * a noon anchor so a 23-hour DST spring-forward day still rolls correctly.
 */
export function tomorrowKeyInTz(tz: string | undefined | null): string {
  const t = resolveTz(tz);
  const todayKey = todayKeyInTz(t);
  // Anchor at noon UTC so adding 24h never crosses a midnight boundary
  // ambiguously around DST. Then format in the tz to get the local "next day".
  const [y, m, d] = todayKey.split("-").map((s) => parseInt(s, 10));
  const noonUtc = Date.UTC(y, m - 1, d, 12);
  const nextDayUtc = noonUtc + 24 * 60 * 60 * 1000;
  return dayKeyInTz(new Date(nextDayUtc), t);
}
