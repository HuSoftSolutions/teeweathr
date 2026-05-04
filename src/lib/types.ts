export interface WeatherPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  probabilityOfPrecipitation: { value: number | null };
  relativeHumidity: { value: number };
  dewpoint: { value: number; unitCode: string };
  icon: string;
}

export interface WeatherData {
  location: string;
  elevation: number;
  periods: WeatherPeriod[];
  hourly: WeatherPeriod[];
  generatedAt: string;
}

export interface GolfConditions {
  score: number;
  label: string;
  color: string;
  factors: GolfFactor[];
}

export interface GolfFactor {
  name: string;
  value: string;
  impact: "positive" | "neutral" | "negative";
  detail: string;
}

// ─── Smart Analysis Types ───────────────────────────────────────

export type DangerLevel = "none" | "caution" | "danger";

export interface PlayableWindow {
  startHour: number; // 0-23
  endHour: number;
  startLabel: string; // "7 AM"
  endLabel: string;   // "1 PM"
  avgScore: number;
  bestHourScore: number;
}

export interface RainChunk {
  startHour: number;
  endHour: number;
  startLabel: string;
  endLabel: string;
  avgPrecip: number;        // average probability across the chunk
  peakPrecip: number;       // highest probability in the chunk
  type: string;             // "Showers", "Thunderstorms", etc.
}

export interface DayVerdict {
  status: "go" | "mixed" | "no-go";
  headline: string;         // "Perfect day — play anytime"
  detail: string;            // "Clear skies all day, light wind..."
  danger: DangerLevel;
  dangerDetail?: string;     // "Thunderstorms expected 3-6 PM"
  bestWindow: PlayableWindow | null;
  allWindows: PlayableWindow[];
  rainHours: number[];       // hours with >40% precip
  clearHours: number[];      // hours with <20% precip in 6am-7pm
  rainChunks: RainChunk[];   // contiguous blocks of rain with timing + probability
  dayScore: number;          // weighted score for the playable portion
}
