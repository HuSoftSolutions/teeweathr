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
}
