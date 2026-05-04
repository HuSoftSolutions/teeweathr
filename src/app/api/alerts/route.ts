import { NextRequest } from "next/server";
import type { WeatherAlert, AlertSeverity, AlertUrgency } from "@/lib/types";
import { logger } from "@/lib/logger";

const NWS_USER_AGENT = "TeeWeathr/1.0 (golf-weather-app)";
const ALERTS_REVALIDATE_SEC = 300; // 5 minutes — short enough to react, long enough to absorb impressions

// Events that mean "do not play golf, period." Lightning on a course is the
// canonical reason this whole feature exists.
const BLOCKING_EVENTS = new Set([
  "Tornado Warning",
  "Severe Thunderstorm Warning",
  "Flash Flood Warning",
  "Hurricane Warning",
  "Tropical Storm Warning",
  "Extreme Wind Warning",
]);

// Events that warrant an above-the-fold banner but don't override the verdict.
const WARNING_EVENTS = new Set([
  "Tornado Watch",
  "Severe Thunderstorm Watch",
  "Flash Flood Watch",
  "Hurricane Watch",
  "Tropical Storm Watch",
  "Excessive Heat Warning",
  "Heat Advisory",
  "Wind Advisory",
  "High Wind Warning",
  "Winter Storm Warning",
  "Winter Weather Advisory",
]);

function classifyAlert(event: string, severity: AlertSeverity): WeatherAlert["level"] {
  if (BLOCKING_EVENTS.has(event)) return "blocking";
  if (WARNING_EVENTS.has(event)) return "warning";
  if (severity === "Extreme" || severity === "Severe") return "blocking";
  if (severity === "Moderate") return "warning";
  return "info";
}

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
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
      {
        headers: { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" },
        next: { revalidate: ALERTS_REVALIDATE_SEC, tags: ["nws-alerts"] },
      }
    );

    if (!res.ok) {
      throw new Error(`NWS alerts error: ${res.status}`);
    }

    const data = await res.json();

    const alerts: WeatherAlert[] = (data.features || [])
      .map((f: { id?: string; properties: Record<string, unknown> }) => {
        const p = f.properties;
        return { ...p, id: (f.id as string) || (p.id as string) };
      })
      .filter((p: Record<string, unknown>) => p.messageType !== "Cancel")
      .filter((p: Record<string, unknown>) => {
        const sev = p.severity as AlertSeverity;
        return sev === "Extreme" || sev === "Severe" || sev === "Moderate";
      })
      .map((p: Record<string, unknown>): WeatherAlert => {
        const event = (p.event as string) || "Weather Alert";
        const severity = (p.severity as AlertSeverity) || "Unknown";
        return {
          id: String(p.id),
          event,
          headline: (p.headline as string) || event,
          severity,
          urgency: (p.urgency as AlertUrgency) || "Unknown",
          effective: (p.effective as string) || "",
          expires: (p.expires as string) || "",
          description: (p.description as string) || "",
          level: classifyAlert(event, severity),
        };
      });

    // Most severe first so the UI can pick alerts[0] without sorting again.
    const order = { blocking: 0, warning: 1, info: 2 } as const;
    alerts.sort((a, b) => order[a.level] - order[b.level]);

    return Response.json(
      { alerts },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    logger.error("nws_alerts_fetch_failed", {
      route: "/api/alerts",
      lat,
      lon,
      err: error instanceof Error ? error.message : String(error),
    });
    // Alerts are an enhancement; never block the widget on a fetch failure.
    return Response.json(
      { alerts: [] },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60",
        },
      }
    );
  }
}
