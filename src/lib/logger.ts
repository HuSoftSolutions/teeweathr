// Structured JSON logger for server-side code.
//
// Vercel runtime logs and any log drain (Datadog, BetterStack, etc.) parse
// JSON natively, so a single line of JSON per event is more useful than free
// text. Keep this minimal — no external deps, no config — so it works
// identically in dev, preview, and prod.

type Level = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

function emit(level: Level, msg: string, ctx?: LogContext) {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx ?? {}),
  };

  // Stringify defensively — a context object containing a circular reference
  // shouldn't crash the request.
  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    line = JSON.stringify({ ts: entry.ts, level, msg, _logSerializeError: true });
  }

  // Route warn/error to stderr so Vercel surfaces them as such.
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
};
