import { NextRequest } from "next/server";

const NWS_USER_AGENT = "TeeWeathr/1.0 (golf-weather-app)";

async function nwsFetch(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" },
  });
  if (!res.ok) {
    throw new Error(`NWS API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return Response.json({ error: "lat and lon are required" }, { status: 400 });
  }

  try {
    // Step 1: Get the grid point for this location
    const pointData = await nwsFetch(
      `https://api.weather.gov/points/${lat},${lon}`
    );

    const { gridId, gridX, gridY } = pointData.properties;
    const locationName = `${pointData.properties.relativeLocation.properties.city}, ${pointData.properties.relativeLocation.properties.state}`;
    const elevation = pointData.properties.elevation?.value
      ? Math.round(pointData.properties.elevation.value * 3.281)
      : 0;

    // Step 2: Fetch both forecasts in parallel
    const [forecastData, hourlyData] = await Promise.all([
      nwsFetch(
        `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast`
      ),
      nwsFetch(
        `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`
      ),
    ]);

    return Response.json({
      location: locationName,
      elevation,
      periods: forecastData.properties.periods,
      hourly: hourlyData.properties.periods,
      generatedAt: forecastData.properties.generatedAt,
    });
  } catch (error) {
    console.error("Weather API error:", error);
    return Response.json(
      { error: "Failed to fetch weather data. The NWS API may be temporarily unavailable." },
      { status: 502 }
    );
  }
}
