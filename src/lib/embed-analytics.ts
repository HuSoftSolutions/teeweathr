// Client-side event queue for the embed widget.
//
// Goal: collapse N user interactions into 1 Firestore write. Events queue in
// memory, flush after a short debounce or on page hide. The pagehide path
// uses sendBeacon when available so events survive a tab close.

export type AnalyticsEvent = "view" | "interaction" | "referral";

type QueueItem = { apiKey: string; courseId: string; event: AnalyticsEvent };

// Module scope is fine — each iframe loads its own JS bundle, so queues
// don't bleed between embeds.
const queue: QueueItem[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let unloadHandlerInstalled = false;

const FLUSH_DEBOUNCE_MS = 3_000;
const MAX_QUEUE_BEFORE_IMMEDIATE_FLUSH = 20;
const ENDPOINT = "/api/embed/analytics";

function ensureUnloadHandlers() {
  if (unloadHandlerInstalled || typeof window === "undefined") return;
  unloadHandlerInstalled = true;

  // pagehide is more reliable than beforeunload for mobile/bfcache.
  window.addEventListener("pagehide", () => flushAnalytics(true));
  // visibilitychange catches the common "user switches tab" case before they
  // even close it — flush opportunistically.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAnalytics(true);
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushAnalytics(false);
  }, FLUSH_DEBOUNCE_MS);
}

function flushAnalytics(useBeacon: boolean) {
  if (queue.length === 0) return;

  // Group by (apiKey, courseId). In practice every iframe has one of each,
  // so this is almost always a single group.
  const groups = new Map<string, { apiKey: string; courseId: string; events: AnalyticsEvent[] }>();
  for (const item of queue) {
    const k = `${item.apiKey}|${item.courseId}`;
    let g = groups.get(k);
    if (!g) {
      g = { apiKey: item.apiKey, courseId: item.courseId, events: [] };
      groups.set(k, g);
    }
    g.events.push(item.event);
  }
  queue.length = 0;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  for (const group of groups.values()) {
    const body = JSON.stringify(group);
    if (useBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      // sendBeacon survives unload; ignore its boolean return — there's
      // nothing we can do if it fails at this point.
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    } else {
      // keepalive: true lets the request finish even if the page is closing.
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }
}

export function trackEmbedEvent(
  apiKey: string,
  courseId: string,
  event: AnalyticsEvent
) {
  ensureUnloadHandlers();
  queue.push({ apiKey, courseId, event });
  if (queue.length >= MAX_QUEUE_BEFORE_IMMEDIATE_FLUSH) {
    flushAnalytics(false);
  } else {
    scheduleFlush();
  }
}

// Exposed so callers (referral link onClick) can flush immediately if the
// user is about to navigate away.
export function flushEmbedAnalyticsNow() {
  flushAnalytics(true);
}
