import { useState, useEffect, useCallback } from "react";

/**
 * Tracks the current date string and fires a callback when the day changes.
 * Handles:
 * - Midnight rollover (checks every 30s)
 * - Tab regaining focus after being idle/background
 * - Device waking from sleep
 */
export function useCurrentDay(onDayChange?: () => void) {
  const [today, setToday] = useState(() => new Date().toDateString());

  const check = useCallback(() => {
    const now = new Date().toDateString();
    setToday((prev) => {
      if (prev !== now) {
        onDayChange?.();
        return now;
      }
      return prev;
    });
  }, [onDayChange]);

  useEffect(() => {
    // Poll every 30 seconds for midnight rollover
    const interval = setInterval(check, 30_000);

    // Check on visibility change (tab comes back to foreground)
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Check on focus (window regains focus)
    window.addEventListener("focus", check);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", check);
    };
  }, [check]);

  return today;
}
