import type {
  WeatherPeriod,
  GolfConditions,
  GolfFactor,
  DayVerdict,
  PlayableWindow,
  DangerLevel,
  RainChunk,
} from "./types";

// ─── Helpers ────────────────────────────────────────────────────

function parseWindSpeed(windSpeed: string): number {
  const match = windSpeed.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// ─── Factor Scoring ─────────────────────────────────────────────
//
// Weights reflect what actually matters to golfers:
//   Rain:   35 pts — the only thing that truly stops golf
//   Wind:   30 pts — most impactful on play quality
//   Temp:   25 pts — gentle curve, 50°F is fine, 40°F is chilly
//   Humidity: 10 pts — barely matters unless extreme
//   Total: 100 pts

function getWindImpact(mph: number): { score: number; impact: GolfFactor["impact"]; detail: string } {
  if (mph <= 5) return { score: 30, impact: "positive", detail: "Calm — perfect conditions" };
  if (mph <= 10) return { score: 26, impact: "positive", detail: "Light breeze — minimal effect" };
  if (mph <= 15) return { score: 20, impact: "neutral", detail: "Moderate — club up on approach" };
  if (mph <= 20) return { score: 12, impact: "negative", detail: "Breezy — affects ball flight" };
  if (mph <= 25) return { score: 6, impact: "negative", detail: "Strong — significant club changes" };
  return { score: 0, impact: "negative", detail: "Very strong — challenging conditions" };
}

function getTempImpact(temp: number): { score: number; impact: GolfFactor["impact"]; detail: string } {
  // Golfers happily play 50-85°F. The curve should be gentle through that range.
  if (temp >= 60 && temp <= 82) return { score: 25, impact: "positive", detail: "Ideal playing temperature" };
  if (temp >= 50 && temp < 60) return { score: 22, impact: "positive", detail: "Cool — grab a layer" };
  if (temp > 82 && temp <= 90) return { score: 21, impact: "neutral", detail: "Warm — stay hydrated" };
  if (temp >= 45 && temp < 50) return { score: 18, impact: "neutral", detail: "Chilly — dress warm" };
  if (temp > 90 && temp <= 100) return { score: 14, impact: "negative", detail: "Hot — shade and water essential" };
  if (temp >= 38 && temp < 45) return { score: 12, impact: "negative", detail: "Cold — stiff muscles, less carry" };
  if (temp < 38) return { score: 4, impact: "negative", detail: "Very cold — hard ground, tough conditions" };
  return { score: 4, impact: "negative", detail: "Extreme heat — risk of heat illness" };
}

function getRainImpact(precip: number | null, forecast?: string): { score: number; impact: GolfFactor["impact"]; detail: string } {
  const p = precip ?? 0;

  const f = (forecast || "").toLowerCase();

  // Lightning is a binary safety issue, not a probabilistic one. Even a
  // "Slight Chance" of thunderstorms forces clearing the course, so the
  // rain factor must score this near zero regardless of the precip%.
  const hasStorm = f.includes("thunderstorm") || f.includes("lightning") || f.includes("severe");
  if (hasStorm) {
    return { score: 0, impact: "negative", detail: "Lightning risk — clear the course" };
  }

  // NWS probability is area-wide and includes overnight carryover.
  // If the forecast TEXT says clear/sunny/cloudy, trust it over the probability.
  const isClearForecast = !f.includes("rain") && !f.includes("shower") &&
    !f.includes("drizzle") && !f.includes("storm") && !f.includes("precip");

  if (isClearForecast && p <= 40) {
    if (p <= 15) return { score: 35, impact: "positive", detail: "Dry" };
    return { score: 32, impact: "positive", detail: "Dry — ignore the probability" };
  }

  if (p <= 10) return { score: 35, impact: "positive", detail: "Dry" };
  if (p <= 25) return { score: 30, impact: "positive", detail: "Unlikely to rain" };
  if (p <= 40) return { score: 22, impact: "neutral", detail: "Slight chance — pack a jacket" };
  if (p <= 55) return { score: 12, impact: "negative", detail: "Showers possible" };
  if (p <= 70) return { score: 6, impact: "negative", detail: "Rain expected" };
  return { score: 0, impact: "negative", detail: "Heavy rain likely" };
}

function getHumidityImpact(humidity: number): { score: number; impact: GolfFactor["impact"]; detail: string } {
  if (humidity >= 25 && humidity <= 65) return { score: 10, impact: "positive", detail: "Comfortable" };
  if (humidity > 65 && humidity <= 80) return { score: 8, impact: "neutral", detail: "Moderate" };
  if (humidity < 25) return { score: 9, impact: "positive", detail: "Dry air — extra carry" };
  if (humidity > 80 && humidity <= 90) return { score: 5, impact: "negative", detail: "Muggy — grip may slip" };
  return { score: 3, impact: "negative", detail: "Very humid — tiring" };
}

export function calculateGolfConditions(period: WeatherPeriod): GolfConditions {
  const windMph = parseWindSpeed(period.windSpeed);
  const wind = getWindImpact(windMph);
  const temp = getTempImpact(period.temperature);
  const rain = getRainImpact(period.probabilityOfPrecipitation?.value, period.shortForecast);
  const humidity = getHumidityImpact(period.relativeHumidity?.value ?? 50);

  const raw = wind.score + temp.score + rain.score + humidity.score;

  // Hard caps that keep per-hour scoring aligned with the day verdict.
  // Without these the additive sum (wind + temp + rain + humidity) lets
  // mild temp/wind/humidity carry a thunderstorm or rainy hour to a B+
  // grade — even though `findPlayableWindows` would (correctly) reject
  // the same hour as not-playable, leaving "Not a golf day" headlines
  // sitting next to green letter grades.
  //
  // Three layered rules, applied in order from harshest to mildest:
  //   1. Forecast text names a danger keyword (thunderstorm, lightning,
  //      tornado, etc.) — lightning is binary, cap at 20 (D).
  //   2. Forecast text confirms precipitation AND NWS precip% is high
  //      enough that the verdict's playability rule (`precip < 50`)
  //      would reject the hour. Cap below the playable threshold so
  //      the score and the verdict agree.
  //   3. Forecast text names a caution keyword (heavy rain, dense fog,
  //      ice, etc.) — cap at 45 (C). Looser than the precip rule
  //      because conditions like fog can be nasty without high precip%.
  const f = period.shortForecast.toLowerCase();
  const hasPrecipText = /rain|shower|drizzle|storm|snow|sleet/.test(f);
  const precip = period.probabilityOfPrecipitation?.value ?? 0;
  const { level: dangerLevel } = detectDanger(period.shortForecast);

  let score = raw;
  if (dangerLevel === "danger") {
    score = Math.min(score, 20);
  } else if (hasPrecipText && precip >= 70) {
    // Heavy expected rain — firmly D.
    score = Math.min(score, 22);
  } else if (hasPrecipText && precip >= 50) {
    // Match the verdict's `precip < 50` playability cutoff. Anything
    // above lands in D territory so block grades and the headline
    // can't disagree.
    score = Math.min(score, 28);
  } else if (dangerLevel === "caution") {
    score = Math.min(score, 45);
  }

  let label: string;
  let color: string;
  if (score >= 80) { label = "Excellent"; color = "text-score-excellent"; }
  else if (score >= 60) { label = "Good"; color = "text-score-good"; }
  else if (score >= 40) { label = "Fair"; color = "text-score-fair"; }
  else { label = "Poor"; color = "text-score-poor"; }

  const factors: GolfFactor[] = [
    { name: "Temperature", value: `${period.temperature}°${period.temperatureUnit}`, impact: temp.impact, detail: temp.detail },
    { name: "Wind", value: `${period.windSpeed} ${period.windDirection}`, impact: wind.impact, detail: wind.detail },
    { name: "Precipitation", value: `${period.probabilityOfPrecipitation?.value ?? 0}%`, impact: rain.impact, detail: rain.detail },
    { name: "Humidity", value: `${period.relativeHumidity?.value ?? "N/A"}%`, impact: humidity.impact, detail: humidity.detail },
  ];

  return { score, label, color, factors };
}

export function getScoreBg(score: number): string {
  if (score >= 80) return "bg-score-excellent";
  if (score >= 60) return "bg-score-good";
  if (score >= 40) return "bg-score-fair";
  return "bg-score-poor";
}

export interface ScoreGrade {
  letter: string;
  label: string;
}

export function getGrade(score: number): ScoreGrade {
  if (score >= 90) return { letter: "A+", label: "Perfect" };
  if (score >= 80) return { letter: "A", label: "Excellent" };
  if (score >= 70) return { letter: "B+", label: "Great" };
  if (score >= 60) return { letter: "B", label: "Good" };
  if (score >= 50) return { letter: "C+", label: "Decent" };
  if (score >= 40) return { letter: "C", label: "Fair" };
  // Floor at D — never surface "F". The lightning warning triangle
  // already replaces the letter when there's an instruction to stay
  // off the course; for plain bad weather (cold, very windy, heavy
  // rain) we'd rather show "D – Skip it" than "F – Skip it" since
  // golfers will read F as a hard stop and red flag.
  return { letter: "D", label: score >= 30 ? "Marginal" : "Skip it" };
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-score-excellent";
  if (score >= 60) return "text-score-good";
  if (score >= 40) return "text-score-fair";
  return "text-score-poor";
}

export function getStrokeColor(score: number): string {
  if (score >= 80) return "stroke-score-excellent";
  if (score >= 60) return "stroke-score-good";
  if (score >= 40) return "stroke-score-fair";
  return "stroke-score-poor";
}

// ─── Danger Detection ───────────────────────────────────────────

const DANGER_KEYWORDS = [
  "thunderstorm", "lightning", "tornado", "severe",
  "hail", "funnel", "waterspout",
];
const CAUTION_KEYWORDS = [
  "heavy rain", "downpour", "flooding", "gusty",
  "dense fog", "freezing rain", "ice",
];

export function detectDanger(forecast: string): { level: DangerLevel; keyword: string | null } {
  const f = forecast.toLowerCase();
  for (const kw of DANGER_KEYWORDS) {
    if (f.includes(kw)) return { level: "danger", keyword: kw };
  }
  for (const kw of CAUTION_KEYWORDS) {
    if (f.includes(kw)) return { level: "caution", keyword: kw };
  }
  return { level: "none", keyword: null };
}

// ─── Playable Window Analysis ───────────────────────────────────

const GOLF_START = 6;  // earliest tee time
const GOLF_END = 18;   // latest reasonable start (6pm)
const MIN_WINDOW_HOURS = 3; // need at least 3 hours for a round (cart, 9 holes)

interface HourAnalysis {
  hour: number;
  score: number;
  precip: number;
  isPlayable: boolean; // score >= 30 and precip < 50
  danger: DangerLevel;
  forecast: string;
}

function analyzeHours(hourlyPeriods: WeatherPeriod[]): HourAnalysis[] {
  return hourlyPeriods.map((p) => {
    const hour = new Date(p.startTime).getHours();
    const score = calculateGolfConditions(p).score;
    const precip = p.probabilityOfPrecipitation?.value ?? 0;
    const { level: danger } = detectDanger(p.shortForecast);
    return {
      hour,
      score,
      precip,
      isPlayable: score >= 30 && precip < 50 && danger !== "danger",
      danger,
      forecast: p.shortForecast,
    };
  });
}

function findPlayableWindows(hours: HourAnalysis[]): PlayableWindow[] {
  const golfHours = hours.filter((h) => h.hour >= GOLF_START && h.hour <= GOLF_END);
  const windows: PlayableWindow[] = [];
  let windowStart = -1;

  for (let i = 0; i <= golfHours.length; i++) {
    const current = golfHours[i];
    const isPlayable = current?.isPlayable ?? false;

    if (isPlayable && windowStart === -1) {
      windowStart = i;
    } else if (!isPlayable && windowStart !== -1) {
      const windowHours = golfHours.slice(windowStart, i);
      if (windowHours.length >= MIN_WINDOW_HOURS) {
        const scores = windowHours.map((h) => h.score);
        windows.push({
          startHour: windowHours[0].hour,
          endHour: windowHours[windowHours.length - 1].hour + 1,
          startLabel: formatHour(windowHours[0].hour),
          endLabel: formatHour(windowHours[windowHours.length - 1].hour + 1),
          avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          bestHourScore: Math.max(...scores),
        });
      }
      windowStart = -1;
    }
  }

  return windows.sort((a, b) => b.avgScore - a.avgScore);
}

// ─── Rain Chunk Analysis ────────────────────────────────────────

const RAIN_KEYWORDS = ["rain", "shower", "drizzle", "thunderstorm", "storm", "precipitation"];

function classifyRainType(forecast: string): string {
  const f = forecast.toLowerCase();
  if (f.includes("thunderstorm")) return "Thunderstorms";
  if (f.includes("heavy rain") || f.includes("downpour")) return "Heavy rain";
  if (f.includes("shower")) return "Showers";
  if (f.includes("drizzle")) return "Drizzle";
  if (f.includes("rain")) return "Rain";
  return "Precipitation";
}

function findRainChunks(hours: HourAnalysis[], hourlyPeriods: WeatherPeriod[]): RainChunk[] {
  // Look at ALL hours (not just golf hours) so we show overnight/early rain too
  const chunks: RainChunk[] = [];
  let chunkStart = -1;

  for (let i = 0; i <= hours.length; i++) {
    const h = hours[i];
    // Consider it a "rain hour" if precip >= 20% OR forecast mentions rain
    const isRainy = h
      ? h.precip >= 40 || (h.precip >= 25 && RAIN_KEYWORDS.some((kw) => h.forecast.toLowerCase().includes(kw)))
      : false;

    if (isRainy && chunkStart === -1) {
      chunkStart = i;
    } else if (!isRainy && chunkStart !== -1) {
      const chunkHours = hours.slice(chunkStart, i);
      const precips = chunkHours.map((ch) => ch.precip);
      const avgPrecip = Math.round(precips.reduce((a, b) => a + b, 0) / precips.length);
      const peakPrecip = Math.max(...precips);

      // Find the most severe forecast type in the chunk
      const forecasts = chunkHours.map((ch) => ch.forecast);
      const type = forecasts.reduce((worst, fc) => {
        const t = classifyRainType(fc);
        const severity = ["Drizzle", "Precipitation", "Showers", "Rain", "Heavy rain", "Thunderstorms"];
        return severity.indexOf(t) > severity.indexOf(worst) ? t : worst;
      }, "Precipitation");

      chunks.push({
        startHour: chunkHours[0].hour,
        endHour: chunkHours[chunkHours.length - 1].hour + 1,
        startLabel: formatHour(chunkHours[0].hour),
        endLabel: formatHour(chunkHours[chunkHours.length - 1].hour + 1),
        avgPrecip,
        peakPrecip,
        type,
      });
      chunkStart = -1;
    }
  }

  return chunks;
}

function formatRainSummary(chunks: RainChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks.map((c) => {
    const prob = c.peakPrecip > c.avgPrecip + 10
      ? `${c.avgPrecip}-${c.peakPrecip}%`
      : `${c.avgPrecip}%`;
    return `${c.type} ${c.startLabel}–${c.endLabel} (${prob} chance)`;
  }).join(". ") + ".";
}

// ─── Day Verdict ────────────────────────────────────────────────

export function analyzeDayVerdict(
  dayPeriod: WeatherPeriod,
  hourlyForDay: WeatherPeriod[]
): DayVerdict {
  // If we don't have hourly data, fall back to period-level analysis
  if (hourlyForDay.length === 0) {
    const score = calculateGolfConditions(dayPeriod).score;
    const { level: danger } = detectDanger(dayPeriod.shortForecast + " " + dayPeriod.detailedForecast);
    return {
      status: danger === "danger" ? "no-go" : score >= 50 ? "go" : "no-go",
      headline: score >= 50 ? dayPeriod.shortForecast : "Unfavorable conditions",
      detail: dayPeriod.detailedForecast,
      danger,
      bestWindow: null,
      allWindows: [],
      rainHours: [],
      clearHours: [],
      rainChunks: [],
      dayScore: score,
    };
  }

  const hours = analyzeHours(hourlyForDay);
  const golfHours = hours.filter((h) => h.hour >= GOLF_START && h.hour <= GOLF_END);
  const windows = findPlayableWindows(hours);
  const bestWindow = windows.length > 0 ? windows[0] : null;

  // Rain and clear hours
  const rainHours = golfHours.filter((h) => h.precip >= 40).map((h) => h.hour);
  const clearHours = golfHours.filter((h) => h.precip < 20).map((h) => h.hour);

  // Rain chunk analysis — contiguous blocks of rain with timing + probability
  const rainChunks = findRainChunks(hours, hourlyForDay);
  const rainSummary = formatRainSummary(rainChunks);

  // Danger analysis
  const dangerHours = hours.filter((h) => h.danger === "danger");
  const cautionHours = hours.filter((h) => h.danger === "caution");
  let danger: DangerLevel = "none";
  let dangerDetail: string | undefined;

  if (dangerHours.length > 0) {
    danger = "danger";
    const dangerStart = Math.min(...dangerHours.map((h) => h.hour));
    const dangerEnd = Math.max(...dangerHours.map((h) => h.hour)) + 1;
    const keyword = dangerHours[0].forecast;
    dangerDetail = `${keyword} expected ${formatHour(dangerStart)}-${formatHour(dangerEnd)} — stay off the course`;
  } else if (cautionHours.length > 0) {
    danger = "caution";
    const cautionStart = Math.min(...cautionHours.map((h) => h.hour));
    const cautionEnd = Math.max(...cautionHours.map((h) => h.hour)) + 1;
    dangerDetail = `${cautionHours[0].forecast} possible ${formatHour(cautionStart)}-${formatHour(cautionEnd)}`;
  }

  // Day score: use the best window's avg score, or average of all golf hours
  const dayScore = bestWindow
    ? bestWindow.avgScore
    : golfHours.length > 0
      ? Math.round(golfHours.reduce((a, h) => a + h.score, 0) / golfHours.length)
      : calculateGolfConditions(dayPeriod).score;

  // Determine status
  // Key insight: a day with rain 6-9 AM then clear all day is a GO, not mixed.
  // What matters is whether the best playable window is long enough and good enough.
  const bestWindowHours = bestWindow ? bestWindow.endHour - bestWindow.startHour : 0;
  const totalGolfHours = golfHours.length;
  const bestWindowCoversDay = bestWindowHours >= totalGolfHours * 0.6; // 60%+ of the day is clear
  const onlyEarlyOrLateRain = rainHours.length > 0 && rainHours.every(
    (h) => h <= GOLF_START + 2 || h >= GOLF_END - 1 // rain only before 8 AM or after 5 PM
  );

  let status: DayVerdict["status"];
  if (danger === "danger" && windows.length === 0) {
    status = "no-go";
  } else if (windows.length === 0 || dayScore < 25) {
    status = "no-go";
  } else if (bestWindow && bestWindowCoversDay && dayScore >= 50 && danger === "none") {
    // Long clear window with good score = GO, even if there's fringe rain
    status = "go";
  } else if (bestWindow && onlyEarlyOrLateRain && dayScore >= 50 && danger === "none") {
    // Rain only in early morning or late evening — effectively a clear day
    status = "go";
  } else if (rainHours.length > 0 || danger !== "none" || clearHours.length < golfHours.length * 0.7) {
    status = "mixed";
  } else {
    status = "go";
  }

  // Build headline and detail
  let headline: string;
  let detail: string;
  // "Weather app says rain" callout for days that look bad but aren't
  const weatherAppDisagrees = status === "go" && rainHours.length > 0;
  const mixedButPlayable = status === "mixed" && bestWindow && bestWindowHours >= 4;

  if (status === "go") {
    if (weatherAppDisagrees && onlyEarlyOrLateRain) {
      const rainDesc = rainHours.every((h) => h <= GOLF_START + 2)
        ? `before ${formatHour(Math.max(...rainHours) + 1)}`
        : `after ${formatHour(Math.min(...rainHours))}`;
      headline = "Your weather app is wrong — this is a golf day";
      detail = `Yes, there's a chance of rain ${rainDesc}. But ${formatHour(bestWindow!.startHour)}-${formatHour(bestWindow!.endHour)} is clear — rated ${getGrade(bestWindow!.avgScore).letter}. Don't cancel your tee time.`;
    } else if (dayScore >= 80) {
      headline = "Perfect day — play anytime";
      detail = `Clear conditions ${formatHour(GOLF_START)}-${formatHour(GOLF_END)}. ${golfHours[0]?.forecast || dayPeriod.shortForecast}.`;
    } else if (dayScore >= 60) {
      headline = "Great day for golf";
      detail = `Good conditions all day. ${dayPeriod.shortForecast}.`;
    } else {
      headline = "Playable all day";
      detail = `Decent conditions throughout. ${dayPeriod.shortForecast}.`;
    }
  } else if (status === "mixed") {
    if (bestWindow) {
      if (mixedButPlayable) {
        headline = `${bestWindowHours} hours of good golf — play ${bestWindow.startLabel}–${bestWindow.endLabel}`;
        detail = `Your weather app might show a rain icon, but there's a solid ${bestWindowHours}-hour window rated ${getGrade(bestWindow.avgScore).letter}. Tee it up.`;
      } else {
        headline = `Play ${bestWindow.startLabel}–${bestWindow.endLabel}`;
        detail = `Best ${bestWindowHours}-hour window rated ${getGrade(bestWindow.avgScore).letter}.`;
      }
    } else {
      headline = "Marginal conditions";
      detail = dayPeriod.shortForecast;
    }
    if (danger === "danger" && bestWindow) {
      detail += ` ${dangerDetail}.`;
    }
  } else {
    if (danger === "danger") {
      headline = "Stay off the course";
      detail = dangerDetail || "Dangerous weather conditions expected.";
    } else {
      headline = "Not a golf day";
      detail = `Conditions don't support a good round. ${dayPeriod.shortForecast}.`;
    }
  }

  // Always append rain breakdown when there are rain chunks during golf hours
  const golfRainChunks = rainChunks.filter(
    (c) => c.endHour > GOLF_START && c.startHour < GOLF_END + 1
  );
  if (golfRainChunks.length > 0) {
    detail += ` ${formatRainSummary(golfRainChunks)}`;
  }

  return {
    status,
    headline,
    detail,
    danger,
    dangerDetail,
    bestWindow,
    allWindows: windows,
    rainHours,
    clearHours,
    rainChunks,
    dayScore,
  };
}

// ─── Get hourly periods for a specific day ──────────────────────

export function getHourlyForDay(allHourly: WeatherPeriod[], dayPeriod: WeatherPeriod): WeatherPeriod[] {
  const dayDate = new Date(dayPeriod.startTime).toDateString();
  return allHourly.filter((h) => new Date(h.startTime).toDateString() === dayDate);
}

// ─── Time Block Analysis ────────────────────────────────────────

export interface TimeBlock {
  name: string;           // "Morning", "Midday", "Afternoon"
  startHour: number;
  endHour: number;
  label: string;          // "6 AM – 10 AM"
  score: number;
  grade: ScoreGrade;
  temp: { low: number; high: number };
  wind: { avg: number; peak: number; direction: string };
  precip: { avg: number; peak: number };
  rain: string | null;    // "Showers (40%)" or null
  danger: boolean;
  forecast: string;       // most common forecast text
}

const TIME_BLOCKS = [
  { name: "Morning", startHour: 6, endHour: 10, label: "6 AM – 10 AM" },
  { name: "Midday", startHour: 10, endHour: 14, label: "10 AM – 2 PM" },
  { name: "Afternoon", startHour: 14, endHour: 18, label: "2 PM – 6 PM" },
] as const;

export function analyzeTimeBlocks(hourlyForDay: WeatherPeriod[]): TimeBlock[] {
  return TIME_BLOCKS.flatMap((block) => {
    const hours = hourlyForDay.filter((h) => {
      const hr = new Date(h.startTime).getHours();
      return hr >= block.startHour && hr < block.endHour;
    });

    // No hourly data for this block — omit it entirely
    if (hours.length === 0) return [];

    const scores = hours.map((h) => calculateGolfConditions(h).score);
    const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const temps = hours.map((h) => h.temperature);
    const precips = hours.map((h) => h.probabilityOfPrecipitation?.value ?? 0);
    const winds = hours.map((h) => parseWindSpeed(h.windSpeed));

    const avgPrecip = Math.round(precips.reduce((a, b) => a + b, 0) / precips.length);
    const peakPrecip = Math.max(...precips);

    // Rain description for this block
    let rain: string | null = null;
    // Detect any mention of rain — UI decides how prominently to show it
    const rainyHours = hours.filter((h) => {
      const p = h.probabilityOfPrecipitation?.value ?? 0;
      const hasRainWord = RAIN_KEYWORDS.some((kw) => h.shortForecast.toLowerCase().includes(kw));
      return p >= 15 && hasRainWord;
    });
    if (rainyHours.length > 0) {
      const type = classifyRainType(
        rainyHours.reduce((worst, h) => {
          const sev = ["Drizzle", "Precipitation", "Showers", "Rain", "Heavy rain", "Thunderstorms"];
          const t = classifyRainType(h.shortForecast);
          return sev.indexOf(t) > sev.indexOf(classifyRainType(worst)) ? h.shortForecast : worst;
        }, rainyHours[0].shortForecast)
      );
      rain = `${type} (${peakPrecip}%)`;
    }

    // Danger
    const hasDanger = hours.some((h) =>
      DANGER_KEYWORDS.some((kw) => h.shortForecast.toLowerCase().includes(kw))
    );

    // Most common forecast
    const forecastCounts = new Map<string, number>();
    hours.forEach((h) => forecastCounts.set(h.shortForecast, (forecastCounts.get(h.shortForecast) || 0) + 1));
    const forecast = [...forecastCounts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];

    return [{
      ...block,
      score,
      grade: getGrade(score),
      temp: { low: Math.min(...temps), high: Math.max(...temps) },
      wind: {
        avg: Math.round(winds.reduce((a, b) => a + b, 0) / winds.length),
        peak: Math.max(...winds),
        direction: hours[0].windDirection,
      },
      precip: { avg: avgPrecip, peak: peakPrecip },
      rain,
      danger: hasDanger,
      forecast,
    }];
  });
}

// ─── Course Tips ────────────────────────────────────────────────

export function getCourseTip(style: string, conditions: GolfConditions, period: WeatherPeriod): string {
  const wind = parseWindSpeed(period.windSpeed);

  if (style === "Links" || style === "Clifftop Links") {
    if (wind > 15) return "Links golf in wind — keep it low, use bump-and-run approaches. Think 3/4 punch shots.";
    if (wind > 8) return "Typical links breeze. Play the ball back in your stance for control on exposed holes.";
    return "Rare calm day on a links. Attack pins and take advantage — these windows close fast.";
  }
  if (style === "Desert") {
    if (period.temperature > 95) return "Desert heat — hydrate every hole. Ball will fly further in dry air, club down.";
    if (period.temperature > 85) return "Warm desert round. Dry air adds 5-10 yards of carry — adjust club selection.";
    return "Great desert conditions. Firm fairways will add roll — play for it off the tee.";
  }
  if (style === "Sandhills") {
    if (wind > 12) return "Sandhills wind is funneled between dunes. Watch for swirling gusts on the greens.";
    return "Sandy soil drains fast — expect firm, fast conditions even after recent rain.";
  }
  if (style === "Coastal") {
    if (wind > 10) return "Coastal wind off the water shifts through the round. Re-read wind direction each hole.";
    return "Marine layer may burn off — expect conditions to change as the round progresses.";
  }
  if (style === "Stadium") {
    return "Stadium course — mounding creates pockets of calm and gusts. Trust the flags on the greens.";
  }
  if (conditions.score >= 80) return "Ideal conditions. Greens should be receptive — fire at tucked pins.";
  if (conditions.score >= 60) return "Good day. Tree-lined holes will shelter from wind — use that to your advantage.";
  if (conditions.score >= 40) return "Mixed conditions. Play conservative off the tee and take what the course gives you.";
  return "Tough day. Keep the ball in the fairway — recovery in these conditions is costly.";
}
