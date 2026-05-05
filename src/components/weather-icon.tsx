// Specific weather icons used in place of an ambiguous warning indicator.
//
// Designed for both the browser DOM and satori's SVG subset (used by
// next/og to render share images). Every shape is built from fill-only
// primitives — satori renders stroke unreliably and large strokes can
// flood-fill the bounding box. Each icon is a single <svg> with its
// primitives inlined directly (no subcomponents) since satori does not
// expand nested React components inside SVG.
//
// Pair `pickWeatherIcon` with `WeatherIcon` to surface the actual reason
// a slot is rated poorly (rain vs lightning vs fog) instead of a generic
// warning triangle.

const DEFAULT_COLOR = "#f59e0b";

export type WeatherIconType =
  | "lightning"
  | "heavyRain"
  | "rain"
  | "snow"
  | "hail"
  | "fog"
  | "ice"
  | "severe"
  | "wind";

export function pickWeatherIcon(forecast: string): WeatherIconType | null {
  const f = (forecast || "").toLowerCase();
  // Order matters: most severe / most specific first.
  if (/tornado|funnel|waterspout/.test(f)) return "severe";
  if (/lightning|thunderstorm/.test(f)) return "lightning";
  if (/hail/.test(f)) return "hail";
  if (/freezing rain|sleet|ice storm|icy/.test(f)) return "ice";
  if (/snow|blizzard|flurries/.test(f)) return "snow";
  if (/heavy rain|downpour|heavy showers|rain likely|showers likely/.test(f)) return "heavyRain";
  if (/rain|shower|drizzle/.test(f)) return "rain";
  if (/dense fog|fog|mist|haze/.test(f)) return "fog";
  if (/gusty|high wind|severe wind|windy/.test(f)) return "wind";
  return null;
}

interface IconProps {
  size: number;
  color?: string;
}

export function WeatherIcon({ type, size, color = DEFAULT_COLOR }: IconProps & { type: WeatherIconType }) {
  switch (type) {
    case "lightning":
      return <Lightning size={size} color={color} />;
    case "heavyRain":
      return <HeavyRain size={size} color={color} />;
    case "rain":
      return <Rain size={size} color={color} />;
    case "snow":
      return <Snow size={size} color={color} />;
    case "hail":
      return <Hail size={size} color={color} />;
    case "fog":
      return <Fog size={size} color={color} />;
    case "ice":
      return <Ice size={size} color={color} />;
    case "severe":
      return <Severe size={size} color={color} />;
    case "wind":
      return <WindIcon size={size} color={color} />;
  }
}

function Lightning({ size, color = DEFAULT_COLOR }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="42" r="15" fill={color} />
      <circle cx="50" cy="32" r="18" fill={color} />
      <circle cx="68" cy="42" r="14" fill={color} />
      <rect x="22" y="42" width="55" height="14" fill={color} />
      <polygon points="48,56 62,56 54,72 64,72 40,94 46,76 38,76" fill={color} />
    </svg>
  );
}

function Rain({ size, color = DEFAULT_COLOR }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="42" r="15" fill={color} />
      <circle cx="50" cy="32" r="18" fill={color} />
      <circle cx="68" cy="42" r="14" fill={color} />
      <rect x="22" y="42" width="55" height="14" fill={color} />
      <ellipse cx="36" cy="72" rx="3" ry="6" fill={color} />
      <ellipse cx="50" cy="80" rx="3" ry="6" fill={color} />
      <ellipse cx="64" cy="72" rx="3" ry="6" fill={color} />
    </svg>
  );
}

function HeavyRain({ size, color = DEFAULT_COLOR }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="42" r="15" fill={color} />
      <circle cx="50" cy="32" r="18" fill={color} />
      <circle cx="68" cy="42" r="14" fill={color} />
      <rect x="22" y="42" width="55" height="14" fill={color} />
      <ellipse cx="32" cy="70" rx="3.5" ry="7" fill={color} />
      <ellipse cx="44" cy="78" rx="3.5" ry="7" fill={color} />
      <ellipse cx="56" cy="70" rx="3.5" ry="7" fill={color} />
      <ellipse cx="68" cy="78" rx="3.5" ry="7" fill={color} />
      <ellipse cx="50" cy="90" rx="3.5" ry="6" fill={color} />
    </svg>
  );
}

function Snow({ size, color = DEFAULT_COLOR }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="42" r="15" fill={color} />
      <circle cx="50" cy="32" r="18" fill={color} />
      <circle cx="68" cy="42" r="14" fill={color} />
      <rect x="22" y="42" width="55" height="14" fill={color} />
      {/* Three snowflakes ("+" shapes) */}
      <rect x="33.8" y="69" width="2.4" height="14" rx="1" fill={color} />
      <rect x="28" y="74.8" width="14" height="2.4" rx="1" fill={color} />
      <rect x="48.8" y="79" width="2.4" height="14" rx="1" fill={color} />
      <rect x="43" y="84.8" width="14" height="2.4" rx="1" fill={color} />
      <rect x="63.8" y="69" width="2.4" height="14" rx="1" fill={color} />
      <rect x="58" y="74.8" width="14" height="2.4" rx="1" fill={color} />
    </svg>
  );
}

function Hail({ size, color = DEFAULT_COLOR }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="42" r="15" fill={color} />
      <circle cx="50" cy="32" r="18" fill={color} />
      <circle cx="68" cy="42" r="14" fill={color} />
      <rect x="22" y="42" width="55" height="14" fill={color} />
      <circle cx="36" cy="74" r="4.5" fill={color} />
      <circle cx="50" cy="82" r="5" fill={color} />
      <circle cx="64" cy="74" r="4.5" fill={color} />
    </svg>
  );
}

function Fog({ size, color = DEFAULT_COLOR }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="22" width="72" height="10" rx="5" fill={color} />
      <rect x="22" y="40" width="56" height="10" rx="5" fill={color} />
      <rect x="14" y="58" width="72" height="10" rx="5" fill={color} />
      <rect x="26" y="76" width="48" height="10" rx="5" fill={color} />
    </svg>
  );
}

function Ice({ size, color = DEFAULT_COLOR }: IconProps) {
  // Six-pointed ice crystal — three crossing bars, no cloud.
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="48.5" y="12" width="3" height="76" rx="1.5" fill={color} />
      <rect x="48.5" y="12" width="3" height="76" rx="1.5" transform="rotate(60 50 50)" fill={color} />
      <rect x="48.5" y="12" width="3" height="76" rx="1.5" transform="rotate(120 50 50)" fill={color} />
    </svg>
  );
}

function Severe({ size, color = DEFAULT_COLOR }: IconProps) {
  // Tornado funnel: zigzag taper from wide top to a point.
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon
        points="18,15 82,15 70,30 78,30 60,50 68,50 52,70 60,70 50,92 42,72 50,72 36,52 44,52 28,32 36,32"
        fill={color}
      />
    </svg>
  );
}

function WindIcon({ size, color = DEFAULT_COLOR }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="28" width="60" height="8" rx="4" fill={color} />
      <circle cx="78" cy="32" r="6" fill={color} />
      <rect x="14" y="48" width="72" height="8" rx="4" fill={color} />
      <circle cx="90" cy="52" r="6" fill={color} />
      <rect x="14" y="68" width="48" height="8" rx="4" fill={color} />
      <circle cx="66" cy="72" r="6" fill={color} />
    </svg>
  );
}
