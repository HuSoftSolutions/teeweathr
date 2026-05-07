export interface GolfCourse {
  id: string;
  name: string;
  city?: string;
  state?: string;
  lat: number;
  lon: number;
  holes: number;
  par?: number;
  elevation?: number;
  style?: string;
  distance?: number;
  phone?: string;
  website?: string;
  fee?: string;
  access?: string;
  // IANA timezone for the course's location (e.g. "America/Los_Angeles").
  // Resolved from NWS /points/{lat},{lon} at course-creation time and used
  // to render every time/date in the course's local zone — never the
  // viewer's. Optional during the migration window; resolve on read with
  // course-time helpers' fallback if missing.
  timezone?: string;
}
