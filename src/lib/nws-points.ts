// ─── NWS Points endpoint ─────────────────────────────────────────
//
// /points/{lat},{lon} returns the metadata we need to identify a course's
// gridpoint *and* its IANA timezone — the timezone is resolved server-side
// from the lat/lon by NWS, so it's always accurate for US locations and
// stable per coordinate.
//
// Used at course-creation time to populate the course's `timezone` field
// once. NWS data here is effectively static per coord (the gridpoint
// mapping never changes, the timezone never changes), so the response is
// cached for a day at the Next.js fetch level.

import { logger } from "@/lib/logger";

const NWS_USER_AGENT = "TeeWeathr/1.0 (golf-weather-app)";
const POINT_REVALIDATE_SEC = 86_400;

export interface NwsPointsData {
  /** IANA timezone, e.g. "America/Los_Angeles" */
  timeZone: string;
  gridId: string;
  gridX: number;
  gridY: number;
  city?: string;
  state?: string;
  /** Elevation in meters (NWS native unit) */
  elevationMeters?: number;
}

/**
 * Resolve NWS metadata for a coordinate. Returns null if NWS can't service
 * the location (e.g. outside US territory) or if the request fails — the
 * caller decides whether that's fatal or just means "no timezone yet."
 */
export async function fetchNwsPoints(lat: number, lon: number): Promise<NwsPointsData | null> {
  // Round to 3 decimals (~100m) to match the cache key normalization used
  // by the weather route — same coordinate hits the same NWS cache entry.
  const latStr = (Math.round(lat * 1000) / 1000).toFixed(3);
  const lonStr = (Math.round(lon * 1000) / 1000).toFixed(3);
  const url = `https://api.weather.gov/points/${latStr},${lonStr}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" },
      next: { revalidate: POINT_REVALIDATE_SEC, tags: ["nws"] },
    });
    if (!res.ok) {
      logger.warn("nws_points_failed", { lat, lon, status: res.status });
      return null;
    }
    const data = await res.json();
    const props = data?.properties;
    if (!props?.timeZone || !props?.gridId) {
      logger.warn("nws_points_missing_fields", { lat, lon });
      return null;
    }
    return {
      timeZone: props.timeZone,
      gridId: props.gridId,
      gridX: props.gridX,
      gridY: props.gridY,
      city: props.relativeLocation?.properties?.city,
      state: props.relativeLocation?.properties?.state,
      elevationMeters: props.elevation?.value,
    };
  } catch (err) {
    logger.warn("nws_points_error", {
      lat,
      lon,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
