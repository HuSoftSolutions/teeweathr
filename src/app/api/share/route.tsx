import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import type { DangerLevel, WeatherData, WeatherPeriod } from "@/lib/types";
import {
  analyzeDayVerdict,
  analyzeTimeBlocks,
  detectDanger,
  getGrade,
  getHourlyForDay,
  type TimeBlock,
} from "@/lib/golf-scoring";
import { WeatherIcon, pickWeatherIcon } from "@/components/weather-icon";
import { logger } from "@/lib/logger";

// Sizes (width × height in px). Match common social aspect ratios.
const SIZES = {
  square: { w: 1080, h: 1080 },
  landscape: { w: 1200, h: 630 },
  story: { w: 1080, h: 1920 },
} as const;

const ACCENT_COLORS: Record<string, string> = {
  default: "#10b981",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  red: "#ef4444",
  orange: "#f97316",
  zinc: "#71717a",
};

type ShareFormat = "daily" | "weekly" | "hourly";
type ShareSize = keyof typeof SIZES;
type Theme = "dark" | "light";

// Color ramp for letter grades. Avoid red entirely — even on bad days the
// imagery is for golfers, not emergency alerts. Anything below "fair"
// drops into amber, and bad-weather cells render a specific weather
// icon (see WeatherIcon) instead of a letter.
const WARNING_AMBER = "#f59e0b";
function gradeColor(score: number, accent: string): string {
  if (score >= 60) return accent;
  if (score >= 40) return "#fbbf24";
  return WARNING_AMBER;
}

// Decide whether to surface a specific weather icon (rain, lightning,
// snow, fog, etc.) instead of the letter grade. The icon answers "why"
// the cell is bad — a generic warning triangle was ambiguous.
//
// Trigger: anything our scoring already flagged as danger, OR a poor
// score (below D) where the forecast text names a recognizable weather
// pattern. Plain bad weather without a named cause keeps the letter.
function gradeOrIcon(score: number, forecast: string, danger: boolean, size: number) {
  if (danger || score < 40) {
    const iconType = pickWeatherIcon(forecast);
    if (iconType) return <WeatherIcon type={iconType} size={size} color={WARNING_AMBER} />;
  }
  return null;
}

// Pull canonical config + weather server-side via the existing internal
// endpoints so we get cache hits for free. Both endpoints already have
// proper caching wired up in earlier initiatives.
async function fetchCourseAndWeather(req: NextRequest, apiKey: string) {
  const origin = new URL(req.url).origin;
  const cfgRes = await fetch(`${origin}/api/embed/${encodeURIComponent(apiKey)}`, { cache: "no-store" });
  if (!cfgRes.ok) {
    throw new Error(`config-fetch:${cfgRes.status}`);
  }
  const cfg = (await cfgRes.json()) as {
    course?: { name: string; lat: number; lon: number };
    tier?: string;
    embedParams?: { theme?: string; accent?: string };
    features?: { showBranding?: boolean };
  };
  if (!cfg.course?.lat || !cfg.course?.lon) {
    throw new Error("course-no-coords");
  }
  const wRes = await fetch(
    `${origin}/api/weather?lat=${cfg.course.lat}&lon=${cfg.course.lon}`,
    { cache: "no-store" }
  );
  if (!wRes.ok) {
    throw new Error(`weather-fetch:${wRes.status}`);
  }
  const weather = (await wRes.json()) as WeatherData;
  return { cfg, weather };
}

// Pick the WeatherPeriod for a target date string (YYYY-MM-DD), or default
// to today (the first daytime period in the response).
function pickDayPeriod(weather: WeatherData, dateStr: string | null): WeatherPeriod {
  const dayPeriods = weather.periods.filter((p) => p.isDaytime);
  if (!dateStr) return dayPeriods[0] ?? weather.periods[0];
  const target = new Date(dateStr).toDateString();
  return (
    dayPeriods.find((p) => new Date(p.startTime).toDateString() === target) ??
    dayPeriods[0] ??
    weather.periods[0]
  );
}

// ─── Layout helpers (Flexbox-only — ImageResponse doesn't support Grid) ──
//
// Per-size scaling so each template gets sensible defaults without having
// to hand-tune nine combinations. story = tall, landscape = wide+short,
// square = balanced.
function scale(size: ShareSize) {
  if (size === "story") {
    return { padding: 80, gap: 48, headerSize: 32, courseSize: 80, gradeBig: 480, sectionHeading: 26 };
  }
  if (size === "landscape") {
    return { padding: 50, gap: 24, headerSize: 22, courseSize: 52, gradeBig: 220, sectionHeading: 20 };
  }
  return { padding: 60, gap: 36, headerSize: 26, courseSize: 64, gradeBig: 320, sectionHeading: 24 };
}

function Frame({
  width,
  height,
  bg,
  size,
  children,
}: {
  width: number;
  height: number;
  bg: string;
  size: ShareSize;
  children: React.ReactNode;
}) {
  const { padding } = scale(size);
  return (
    <div
      style={{
        width,
        height,
        background: bg,
        display: "flex",
        flexDirection: "column",
        padding,
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  );
}

function Watermark({ themeText, size }: { themeText: string; size: ShareSize }) {
  const fontSize = size === "story" ? 26 : size === "landscape" ? 18 : 22;
  return (
    <div
      style={{
        marginTop: "auto",
        fontSize,
        color: themeText,
        opacity: 0.45,
        display: "flex",
        alignItems: "center",
      }}
    >
      Powered by TeeWeathr · teeweathr.com
    </div>
  );
}

// ─── Templates ───────────────────────────────────────────────────

function DailyTemplate({
  size,
  theme,
  accent,
  courseName,
  blocks,
  bestBlock,
  headline,
  dangerLevel,
  dateLabel,
  showWatermark,
}: {
  size: ShareSize;
  theme: Theme;
  accent: string;
  courseName: string;
  blocks: TimeBlock[];
  bestBlock: TimeBlock | null;
  headline: string;
  dangerLevel: DangerLevel;
  dateLabel: string;
  showWatermark: boolean;
}) {
  const { w, h } = SIZES[size];
  const isDark = theme === "dark";
  const bg = isDark ? "#09090b" : "#fafafa";
  const text = isDark ? "#f4f4f5" : "#18181b";
  const muted = isDark ? "#71717a" : "#71717a";

  const heroScore = bestBlock?.score ?? 50;
  const heroGrade = bestBlock ? bestBlock.grade.letter : getGrade(50).letter;
  const s = scale(size);

  // Block strip — each cell scales with available size; landscape places
  // them in a tight horizontal row, square + story stack them in a
  // higher-prominence row with bigger letters.
  const blockGradeSize = size === "story" ? 160 : size === "landscape" ? 72 : 110;
  const blockNameSize = size === "story" ? 28 : size === "landscape" ? 18 : 22;
  const blockTempSize = size === "story" ? 36 : size === "landscape" ? 22 : 28;
  const headlineSize = size === "story" ? 56 : size === "landscape" ? 30 : 38;

  return (
    <Frame width={w} height={h} bg={bg} size={size}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", color: text }}>
        <div style={{ display: "flex", fontSize: s.headerSize, color: muted, letterSpacing: 4, textTransform: "uppercase" }}>
          {dateLabel}
        </div>
        <div style={{ display: "flex", fontSize: s.courseSize, fontWeight: 700, marginTop: 8, lineHeight: 1.1 }}>
          {courseName}
        </div>
      </div>

      {/* Main — fills remaining vertical space */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: s.gap,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: s.gap }}>
          <div
            style={{
              display: "flex",
              fontSize: s.gradeBig,
              fontWeight: 800,
              color: gradeColor(heroScore, accent),
              lineHeight: 1,
            }}
          >
            {(() => {
              // Pick the icon from the block that actually triggered danger
              // so the visual matches the cause (lightning vs heavy rain etc.)
              // — bestBlock is the *best* block by score and may not contain
              // the storm-keyword phrase.
              const heroForecast = blocks.find((b) => b.danger)?.forecast ?? bestBlock?.forecast ?? "";
              return gradeOrIcon(heroScore, heroForecast, dangerLevel === "danger", s.gradeBig) ?? heroGrade;
            })()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, color: text }}>
            <div style={{ display: "flex", fontSize: headlineSize, fontWeight: 600, lineHeight: 1.15 }}>
              {headline}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            background: isDark ? "#18181b" : "#f4f4f5",
            borderRadius: 24,
            padding: size === "story" ? 32 : 24,
            gap: 16,
          }}
        >
          {blocks.map((b) => (
            <div
              key={b.name}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: 12,
              }}
            >
              <div style={{ display: "flex", fontSize: blockNameSize, color: muted, letterSpacing: 2, textTransform: "uppercase" }}>
                {b.name}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: blockGradeSize,
                  fontWeight: 800,
                  color: gradeColor(b.score, accent),
                  marginTop: 4,
                  lineHeight: 1,
                }}
              >
                {gradeOrIcon(b.score, b.forecast, b.danger, blockGradeSize) ?? b.grade.letter}
              </div>
              <div style={{ display: "flex", fontSize: blockTempSize, color: text, marginTop: 8 }}>{`${b.temp.high}°`}</div>
            </div>
          ))}
        </div>
      </div>

      {showWatermark && <Watermark themeText={text} size={size} />}
    </Frame>
  );
}

function WeeklyTemplate({
  size,
  theme,
  accent,
  courseName,
  weather,
  showWatermark,
}: {
  size: ShareSize;
  theme: Theme;
  accent: string;
  courseName: string;
  weather: WeatherData;
  showWatermark: boolean;
}) {
  const { w, h } = SIZES[size];
  const isDark = theme === "dark";
  const bg = isDark ? "#09090b" : "#fafafa";
  const text = isDark ? "#f4f4f5" : "#18181b";
  const muted = isDark ? "#71717a" : "#71717a";

  const days = weather.periods
    .filter((p) => p.isDaytime)
    .slice(0, 7)
    .map((p) => {
      const hourly = getHourlyForDay(weather.hourly, p);
      const blocks = analyzeTimeBlocks(hourly);
      const best = blocks.length > 0 ? blocks.reduce((a, b) => (b.score > a.score ? b : a)) : null;
      const score = best?.score ?? 50;
      // Day-level danger: if any block flags lightning OR the day's
      // own forecast text mentions it, the day is no-go regardless
      // of best-block score.
      const hasDangerBlock = blocks.some((b) => b.danger);
      const periodDanger = detectDanger(`${p.shortForecast} ${p.detailedForecast ?? ""}`).level === "danger";
      const danger = hasDangerBlock || periodDanger;
      return {
        period: p,
        score,
        grade: getGrade(score),
        danger,
        date: new Date(p.startTime),
      };
    });

  const bestDay = days.length > 0 ? days.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  const s = scale(size);

  // Story stacks the 7 days vertically (rows) so each day gets full width
  // and the canvas's tall aspect is filled. Square + landscape lay them out
  // as a horizontal strip.
  const verticalDayStrip = size === "story";
  const dayGradeSize = size === "story" ? 96 : size === "landscape" ? 44 : 56;
  const dayLabelSize = size === "story" ? 28 : size === "landscape" ? 16 : 20;
  const dayDateSize = size === "story" ? 22 : size === "landscape" ? 14 : 18;
  const dayTempSize = size === "story" ? 30 : size === "landscape" ? 18 : 22;
  const bestDayHeading = size === "story" ? 36 : size === "landscape" ? 22 : 28;
  const bestDayName = size === "story" ? 48 : size === "landscape" ? 28 : 36;
  const bestDayGrade = size === "story" ? 80 : size === "landscape" ? 44 : 56;

  return (
    <Frame width={w} height={h} bg={bg} size={size}>
      <div style={{ display: "flex", flexDirection: "column", color: text }}>
        <div style={{ display: "flex", fontSize: s.headerSize, color: muted, letterSpacing: 4, textTransform: "uppercase" }}>
          7-Day Forecast
        </div>
        <div style={{ display: "flex", fontSize: s.courseSize, fontWeight: 700, marginTop: 8, lineHeight: 1.1 }}>
          {courseName}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: s.gap,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: verticalDayStrip ? "column" : "row",
            gap: 12,
          }}
        >
          {days.map((d) => (
            <div
              key={d.period.number}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: verticalDayStrip ? "row" : "column",
                alignItems: "center",
                background: isDark ? "#18181b" : "#f4f4f5",
                borderRadius: 16,
                padding: size === "story" ? 24 : 12,
                gap: verticalDayStrip ? 24 : 0,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: verticalDayStrip ? "flex-start" : "center", flex: verticalDayStrip ? 1 : "0 0 auto" }}>
                <div style={{ display: "flex", fontSize: dayLabelSize, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>
                  {d.date.toLocaleDateString("en-US", { weekday: verticalDayStrip ? "long" : "short" })}
                </div>
                <div style={{ display: "flex", fontSize: dayDateSize, color: muted, marginTop: 2 }}>
                  {d.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: dayGradeSize,
                  fontWeight: 800,
                  color: gradeColor(d.score, accent),
                  marginTop: verticalDayStrip ? 0 : 8,
                  lineHeight: 1,
                }}
              >
                {gradeOrIcon(d.score, d.period.shortForecast, d.danger, dayGradeSize) ?? d.grade.letter}
              </div>
              <div style={{ display: "flex", fontSize: dayTempSize, color: text, marginTop: verticalDayStrip ? 0 : 6, marginLeft: verticalDayStrip ? 16 : 0 }}>{`${d.period.temperature}°`}</div>
            </div>
          ))}
        </div>

        {bestDay && (
          <div
            style={{
              display: "flex",
              padding: size === "story" ? 32 : 24,
              borderRadius: 24,
              background: accent + "22",
              color: text,
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", fontSize: bestDayHeading, color: muted }}>Best day this week</div>
            <div style={{ display: "flex", fontSize: bestDayName, fontWeight: 700 }}>
              {bestDay.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: bestDayGrade,
                fontWeight: 800,
                color: gradeColor(bestDay.score, accent),
                marginLeft: "auto",
              }}
            >
              {gradeOrIcon(bestDay.score, bestDay.period.shortForecast, bestDay.danger, bestDayGrade) ?? bestDay.grade.letter}
            </div>
          </div>
        )}
      </div>

      {showWatermark && <Watermark themeText={text} size={size} />}
    </Frame>
  );
}

function HourlyTemplate({
  size,
  theme,
  accent,
  courseName,
  hourly,
  dateLabel,
  showWatermark,
}: {
  size: ShareSize;
  theme: Theme;
  accent: string;
  courseName: string;
  hourly: WeatherPeriod[];
  dateLabel: string;
  showWatermark: boolean;
}) {
  const { w, h } = SIZES[size];
  const isDark = theme === "dark";
  const bg = isDark ? "#09090b" : "#fafafa";
  const text = isDark ? "#f4f4f5" : "#18181b";
  const muted = isDark ? "#71717a" : "#71717a";

  // Pick the slot count + step based on canvas size — story has tons of
  // vertical room so we show a denser hour list, landscape is short so
  // we cap to a single horizontal row.
  const stepHours = size === "story" ? 1 : 2;
  const maxSlots = size === "landscape" ? 8 : size === "story" ? 14 : 8;
  const slots = hourly
    .filter((p) => {
      const hr = new Date(p.startTime).getHours();
      return hr >= 6 && hr <= 21 && hr % stepHours === 0;
    })
    .slice(0, maxSlots);

  const sc = scale(size);

  // Layout: story = vertical list of rows; landscape = single horizontal
  // row; square = horizontal strip with bigger cells (8 across with
  // explicit basis to avoid satori flex-wrap quirks).
  const isVertical = size === "story";
  const cellGradeSize = size === "story" ? 84 : size === "landscape" ? 44 : 64;
  const cellLabelSize = size === "story" ? 28 : size === "landscape" ? 16 : 22;
  const cellTempSize = size === "story" ? 28 : size === "landscape" ? 16 : 22;

  return (
    <Frame width={w} height={h} bg={bg} size={size}>
      <div style={{ display: "flex", flexDirection: "column", color: text }}>
        <div style={{ display: "flex", fontSize: sc.headerSize, color: muted, letterSpacing: 4, textTransform: "uppercase" }}>
          {`Hourly · ${dateLabel}`}
        </div>
        <div style={{ display: "flex", fontSize: sc.courseSize, fontWeight: 700, marginTop: 8, lineHeight: 1.1 }}>
          {courseName}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: isVertical ? "column" : "row",
            gap: isVertical ? 10 : 12,
          }}
        >
          {slots.map((s) => {
            const hour = new Date(s.startTime).getHours();
            const label = hour === 0 ? "12am" : hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour - 12}pm`;
            const precip = s.probabilityOfPrecipitation?.value ?? 0;
            const score = Math.max(0, 100 - precip);
            const isDanger = detectDanger(s.shortForecast).level === "danger";
            return (
              <div
                key={s.number}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: isVertical ? "row" : "column",
                  alignItems: "center",
                  justifyContent: isVertical ? "space-between" : "center",
                  background: isDark ? "#18181b" : "#f4f4f5",
                  borderRadius: 16,
                  padding: isVertical ? 20 : 16,
                  gap: isVertical ? 24 : 0,
                }}
              >
                <div style={{ display: "flex", fontSize: cellLabelSize, color: muted, textTransform: "uppercase", flex: isVertical ? "0 0 auto" : "0 0 auto", minWidth: isVertical ? 100 : 0 }}>{label}</div>
                <div
                  style={{
                    display: "flex",
                    fontSize: cellGradeSize,
                    fontWeight: 800,
                    color: gradeColor(score, accent),
                    marginTop: isVertical ? 0 : 6,
                    lineHeight: 1,
                  }}
                >
                  {gradeOrIcon(score, s.shortForecast, isDanger, cellGradeSize) ?? getGrade(score).letter}
                </div>
                <div style={{ display: "flex", fontSize: cellTempSize, color: text, marginTop: isVertical ? 0 : 6 }}>{`${s.temperature}°`}</div>
              </div>
            );
          })}
        </div>
      </div>

      {showWatermark && <Watermark themeText={text} size={size} />}
    </Frame>
  );
}

// ─── Route ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const apiKey = sp.get("key") || "";
  const format = (sp.get("format") || "daily") as ShareFormat;
  const size = (sp.get("size") || "square") as ShareSize;
  const date = sp.get("date");
  const themeOverride = sp.get("theme") as Theme | null;
  const accentOverride = sp.get("accent");

  if (!apiKey) {
    return new Response("Missing key", { status: 400 });
  }
  if (!SIZES[size]) {
    return new Response("Invalid size", { status: 400 });
  }
  if (!["daily", "weekly", "hourly"].includes(format)) {
    return new Response("Invalid format", { status: 400 });
  }

  let cfg, weather;
  try {
    ({ cfg, weather } = await fetchCourseAndWeather(request, apiKey));
  } catch (err) {
    logger.warn("share_fetch_failed", { apiKey, err: err instanceof Error ? err.message : String(err) });
    return new Response("Could not load forecast for this key", { status: 502 });
  }

  const tier = cfg.tier || "free";
  const showWatermark = tier === "free";
  const theme: Theme = themeOverride ?? ((cfg.embedParams?.theme as Theme) || "dark");
  const accentName = accentOverride ?? cfg.embedParams?.accent ?? "default";
  const accent = ACCENT_COLORS[accentName] ?? ACCENT_COLORS.default;
  const courseName = cfg.course!.name;

  const { w, h } = SIZES[size];

  let element: React.ReactElement;
  if (format === "weekly") {
    element = (
      <WeeklyTemplate
        size={size}
        theme={theme}
        accent={accent}
        courseName={courseName}
        weather={weather}
        showWatermark={showWatermark}
      />
    );
  } else if (format === "hourly") {
    const period = pickDayPeriod(weather, date);
    const hourly = getHourlyForDay(weather.hourly, period);
    const dateLabel = new Date(period.startTime).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    element = (
      <HourlyTemplate
        size={size}
        theme={theme}
        accent={accent}
        courseName={courseName}
        hourly={hourly}
        dateLabel={dateLabel}
        showWatermark={showWatermark}
      />
    );
  } else {
    const period = pickDayPeriod(weather, date);
    const hourly = getHourlyForDay(weather.hourly, period);
    const blocks = analyzeTimeBlocks(hourly);
    const verdict = analyzeDayVerdict(period, hourly);
    const best = blocks.length > 0 ? blocks.reduce((a, b) => (b.score > a.score ? b : a)) : null;
    const dateLabel = new Date(period.startTime).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    element = (
      <DailyTemplate
        size={size}
        theme={theme}
        accent={accent}
        courseName={courseName}
        blocks={blocks}
        bestBlock={best}
        headline={verdict.headline}
        dangerLevel={verdict.danger}
        dateLabel={dateLabel}
        showWatermark={showWatermark}
      />
    );
  }

  return new ImageResponse(element, {
    width: w,
    height: h,
    headers: {
      // Forecasts update hourly; cache the rendered PNG to absorb repeat
      // hits but keep it fresh enough for daily-share use.
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
