import { useSyncExternalStore } from "react";

/**
 * Returns the viewer's IANA timezone (e.g. "America/Denver"). Empty during
 * SSR and on the very first client render so SSR and hydration agree —
 * after hydration the real tz is read from the browser.
 *
 * Used to decide whether to render the "course time" hint badge — only
 * shown when viewer tz ≠ course tz.
 *
 * Implemented with `useSyncExternalStore` because the value is purely a
 * snapshot from a browser API; no React state to manage, no subscription
 * needed, and SSR is handled by `getServerSnapshot`.
 */

const subscribe = () => () => {};

function getSnapshot() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

function getServerSnapshot() {
  return "";
}

export function useViewerTz() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
