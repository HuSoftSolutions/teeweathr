// Public demo identifiers used by the landing page and the setup endpoint.
//
// These are intentionally *not* secrets — the key shows up in the public
// embed URL on teeweathr.com. Treat the demo business + course as a
// permanent fixture in Firestore: we never delete them, we never charge
// against them, and we never write analytics for them.

export const DEMO_API_KEY = "tw_demo_pebble";
export const DEMO_BUSINESS_ID = "teeweathr-demo";
export const DEMO_COURSE_ID = "teeweathr-demo-pebble";

// Pebble Beach Golf Links — the canonical demo course. Real coordinates so
// the widget shows a real forecast.
export const DEMO_COURSE = {
  name: "Pebble Beach Golf Links",
  lat: 36.5685,
  lon: -121.946,
  holes: 18,
  par: 72,
  city: "Pebble Beach",
  state: "CA",
  timezone: "America/Los_Angeles",
} as const;

export function isDemoApiKey(apiKey: string | null | undefined): boolean {
  return apiKey === DEMO_API_KEY;
}
