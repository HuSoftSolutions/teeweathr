// Google Places API (New) — server-side Place Details lookup.
//
// Uses the v1 endpoint with X-Goog-FieldMask. Distinct from the client-side
// Autocomplete; this runs on Vercel functions and uses GOOGLE_MAPS_SERVER_API_KEY
// (no referrer restriction, Places API only) so calls from no-referrer
// server origins succeed.

import { logger } from "@/lib/logger";

const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";

// Fields we ask Google to return. Google bills per field-mask "tier" — keep
// this minimal. Basic fields (id/displayName/formattedAddress/location) are
// the cheapest tier.
const FIELD_MASK = "id,displayName,formattedAddress,location,addressComponents,types";

export type PlaceDetails = {
  placeId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lon: number;
  city?: string;
  state?: string;
  country?: string;
  types: string[];
};

export type PlaceDetailsResult =
  | { ok: true; place: PlaceDetails }
  | { ok: false; reason: "not-configured" | "not-found" | "fetch-failed"; status?: number };

// Pull the city / state / country from address components. Google returns
// them with `types` array indicating what each component is.
function extractRegion(components: Array<{ longText: string; shortText: string; types: string[] }> | undefined) {
  let city: string | undefined;
  let state: string | undefined;
  let country: string | undefined;
  for (const c of components ?? []) {
    if (c.types.includes("locality")) city = c.longText;
    else if (c.types.includes("administrative_area_level_1")) state = c.shortText;
    else if (c.types.includes("country")) country = c.shortText;
  }
  return { city, state, country };
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) {
    logger.warn("places_not_configured", { hint: "GOOGLE_MAPS_SERVER_API_KEY missing" });
    return { ok: false, reason: "not-configured" };
  }

  // Basic placeId sanity: Google's IDs are alphanumeric + underscores/hyphens,
  // typically 20–100 chars. Reject obvious garbage before paying for a fetch.
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(placeId)) {
    return { ok: false, reason: "not-found" };
  }

  try {
    const res = await fetch(`${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
    });

    if (res.status === 404) return { ok: false, reason: "not-found" };
    if (!res.ok) {
      // Capture Google's actual error message for diagnosis. Common shapes:
      //   { error: { code, message, status } }
      //   { error_message: "...", status: "REQUEST_DENIED" }
      const bodyText = await res.text().catch(() => "");
      logger.warn("places_fetch_failed", {
        status: res.status,
        placeId,
        body: bodyText.slice(0, 500),
      });
      return { ok: false, reason: "fetch-failed", status: res.status };
    }

    const data = (await res.json()) as {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
      types?: string[];
    };

    if (!data.id || !data.location?.latitude || !data.location?.longitude) {
      return { ok: false, reason: "not-found" };
    }

    const { city, state, country } = extractRegion(data.addressComponents);

    return {
      ok: true,
      place: {
        placeId: data.id,
        name: data.displayName?.text ?? "Unnamed location",
        formattedAddress: data.formattedAddress ?? "",
        lat: data.location.latitude,
        lon: data.location.longitude,
        city,
        state,
        country,
        types: data.types ?? [],
      },
    };
  } catch (err) {
    logger.error("places_fetch_error", {
      placeId,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "fetch-failed" };
  }
}

export function slugifyCourseName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip diacritics
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "course"
  );
}
