import { useState, useEffect, useCallback } from "react";
import { todayKeyInTz } from "./course-time";

/**
 * Tracks the current date in a *given* timezone — typically the course's
 * timezone — and fires a callback when the day rolls over there. Returns
 * an ISO day key like "2026-05-08" so callers can compare against
 * `dayKeyInTz(period.startTime, tz)` directly.
 *
 * Returns "" until first client mount: SSR runs in UTC, so computing the
 * initial value at render time would hydrate UTC into the client and
 * mislabel "Today" / "Tomorrow" near the day boundary. Consumers must
 * treat empty as "not-yet-known" — string comparisons just won't match,
 * which gracefully suppresses the Today/Tomorrow badge until mount.
 *
 * Pass `tz` as `undefined` to fall back to the viewer's local zone (with
 * a dev warning) — used pre-Phase-1 for courses still missing a timezone.
 *
 * Handles:
 * - Midnight rollover at the course (checks every 30s)
 * - Tab regaining focus after being idle/background
 * - Device waking from sleep
 * - Course tz changing (e.g. user picks a different course)
 */
export function useCurrentDay(
  tz: string | undefined | null,
  onDayChange?: () => void
) {
  const [today, setToday] = useState("");

  const check = useCallback(() => {
    if (!tz) {
      setToday("");
      return;
    }
    const now = todayKeyInTz(tz);
    setToday((prev) => {
      if (prev && prev !== now) onDayChange?.();
      return now;
    });
  }, [tz, onDayChange]);

  useEffect(() => {
    check();
    const interval = setInterval(check, 30_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", check);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", check);
    };
  }, [check]);

  return today;
}
