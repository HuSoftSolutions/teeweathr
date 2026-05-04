import { NextRequest } from "next/server";
import { db } from "@/lib/firebase/admin";

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const q = searchParams.get("q");

  try {
    const snapshot = await db.collection("courses").get();
    const allCourses = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name as string,
        lat: data.lat as number,
        lon: data.lon as number,
        holes: data.holes as number,
        par: data.par as number | undefined,
        city: data.city as string | undefined,
        state: data.state as string | undefined,
        style: data.style as string | undefined,
      };
    });

    // Name search
    if (q && q.trim().length >= 2) {
      const query = q.trim().toLowerCase();
      const userLat = lat ? parseFloat(lat) : undefined;
      const userLon = lon ? parseFloat(lon) : undefined;

      const matches = allCourses
        .filter((c) =>
          c.name.toLowerCase().includes(query) ||
          (c.city && c.city.toLowerCase().includes(query)) ||
          (c.state && c.state.toLowerCase().includes(query))
        )
        .map((c) => ({
          ...c,
          distance: userLat !== undefined && userLon !== undefined
            ? Math.round(haversine(userLat, userLon, c.lat, c.lon) * 10) / 10
            : undefined,
        }))
        .sort((a, b) => {
          if (a.distance !== undefined && b.distance !== undefined) return a.distance - b.distance;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 30);

      return Response.json({ courses: matches });
    }

    // Nearby search
    if (lat && lon) {
      const userLat = parseFloat(lat);
      const userLon = parseFloat(lon);

      const nearby = allCourses
        .filter((c) => Math.abs(c.lat - userLat) < 0.75 && Math.abs(c.lon - userLon) < 0.75)
        .map((c) => ({ ...c, distance: Math.round(haversine(userLat, userLon, c.lat, c.lon) * 10) / 10 }))
        .filter((c) => c.distance <= 50)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 30);

      return Response.json({ courses: nearby });
    }

    return Response.json(
      { error: "Provide lat/lon for nearby courses, or q for name search" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Course search error:", error);
    return Response.json({ error: "Failed to search courses" }, { status: 500 });
  }
}
