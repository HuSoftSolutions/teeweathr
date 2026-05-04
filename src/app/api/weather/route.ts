import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

const NWS_USER_AGENT = "TeeWeathr/1.0 (golf-weather-app)";

// NWS gridpoint mapping (lat/lon → gridId/x/y) is geographic and effectively
// static — cache for a day. Forecast data refreshes hourly upstream.
const POINT_REVALIDATE_SEC = 86_400;
const FORECAST_REVALIDATE_SEC = 3_600;

async function nwsFetch(url: string, revalidate: number) {
  const res = await fetch(url, {
    headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" },
    next: { revalidate, tags: ["nws"] },
  });
  if (!res.ok) {
    throw new Error(`NWS API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Round to 3 decimals (~100m). NWS gridpoints are 2.5km — far coarser — so
// rounding can never change which grid cell we resolve to, but it normalizes
// the cache key so two courses 50m apart share the same cached response.
function normalizeCoord(v: string): string | null {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return null;
  return (Math.round(n * 1000) / 1000).toFixed(3);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawLat = searchParams.get("lat");
  const rawLon = searchParams.get("lon");

  if (!rawLat || !rawLon) {
    return Response.json({ error: "lat and lon are required" }, { status: 400 });
  }

  const lat = normalizeCoord(rawLat);
  const lon = normalizeCoord(rawLon);
  if (!lat || !lon) {
    return Response.json({ error: "lat and lon must be numbers" }, { status: 400 });
  }

  try {
    const pointData = await nwsFetch(
      `https://api.weather.gov/points/${lat},${lon}`,
      POINT_REVALIDATE_SEC
    );

    const { gridId, gridX, gridY } = pointData.properties;
    const locationName = `${pointData.properties.relativeLocation.properties.city}, ${pointData.properties.relativeLocation.properties.state}`;
    const elevation = pointData.properties.elevation?.value
      ? Math.round(pointData.properties.elevation.value * 3.281)
      : 0;

    const [forecastData, hourlyData] = await Promise.all([
      nwsFetch(
        `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast`,
        FORECAST_REVALIDATE_SEC
      ),
      nwsFetch(
        `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`,
        FORECAST_REVALIDATE_SEC
      ),
    ]);

    return Response.json(
      {
        location: locationName,
        elevation,
        periods: forecastData.properties.periods,
        hourly: hourlyData.properties.periods,
        generatedAt: forecastData.properties.generatedAt,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    logger.error("nws_weather_fetch_failed", {
      route: "/api/weather",
      lat,
      lon,
      err: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Failed to fetch weather data. The NWS API may be temporarily unavailable." },
      { status: 502 }
    );
  }
}
