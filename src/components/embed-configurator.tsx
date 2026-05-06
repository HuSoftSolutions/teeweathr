"use client";

import { useState, useMemo } from "react";
import { Copy, Check, Code, Monitor, Smartphone, MessageSquare, BellRing, PanelBottomClose, Save } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface EmbedCourse {
  id: string;
  name: string;
  lat: number;
  lon: number;
  holes?: number;
  par?: number;
}

interface EmbedConfig {
  format: EmbedFormat;
  theme: "dark" | "light";
  accent: string;
  width: string;
  height: string;
  borderRadius: string;
  position: "bottom-right" | "bottom-left";
  autoOpen: boolean;
}

type EmbedFormat = "full" | "card" | "corner" | "banner" | "inline";

const FORMATS: { id: EmbedFormat; label: string; description: string; icon: React.ElementType }[] = [
  { id: "full", label: "Full Section", description: "Full-width embedded section for a dedicated weather page", icon: Monitor },
  { id: "card", label: "Compact Card", description: "Fixed-size card for sidebars or widgets", icon: Smartphone },
  { id: "corner", label: "Corner Popup", description: "Floating button that expands like a chat widget", icon: MessageSquare },
  { id: "banner", label: "Top Banner", description: "Dismissable banner at the top of the page", icon: BellRing },
  { id: "inline", label: "Inline Badge", description: "Tiny inline badge showing just the grade", icon: PanelBottomClose },
];

const THEMES: { id: "dark" | "light"; label: string; bg: string; text: string }[] = [
  { id: "dark", label: "Dark", bg: "bg-zinc-900", text: "text-zinc-100" },
  { id: "light", label: "Light", bg: "bg-white", text: "text-zinc-900" },
];

const ACCENTS = [
  { id: "default", label: "Default", color: "#10b981" },
  { id: "blue", label: "Blue", color: "#3b82f6" },
  { id: "purple", label: "Purple", color: "#8b5cf6" },
  { id: "red", label: "Red", color: "#ef4444" },
  { id: "orange", label: "Orange", color: "#f97316" },
  { id: "zinc", label: "Neutral", color: "#71717a" },
];

const FORMAT_DEFAULTS: Record<EmbedFormat, { width: string; height: string }> = {
  full: { width: "100%", height: "520px" },
  card: { width: "380px", height: "480px" },
  corner: { width: "360px", height: "460px" },
  banner: { width: "100%", height: "80px" },
  inline: { width: "400px", height: "60px" },
};

// ─── Code Generators ────────────────────────────────────────────

// Production URL: uses API key (server enforces tier)
// Preview URL: uses raw params (for live preview in configurator)
function generateProductionUrl(course: EmbedCourse, config: EmbedConfig, baseUrl: string, apiKey?: string): string {
  if (apiKey) {
    const params = new URLSearchParams({ key: apiKey, course: course.id });
    return `${baseUrl}/embed?${params.toString()}`;
  }
  // Fallback: raw params (no API key)
  return generatePreviewUrl(course, config, baseUrl);
}

function generatePreviewUrl(course: EmbedCourse, config: EmbedConfig, baseUrl: string, tier?: string): string {
  const params = new URLSearchParams({
    lat: course.lat.toString(),
    lon: course.lon.toString(),
    name: course.name,
    theme: config.theme,
  });
  if (course.holes != null) params.set("holes", course.holes.toString());
  if (course.par) params.set("par", course.par.toString());
  if (config.accent !== "default") params.set("accent", config.accent);
  if (tier === "free") params.set("ads", "true");
  if (tier === "enterprise") params.set("branding", "false");
  return `${baseUrl}/embed?${params.toString()}`;
}

// CSS-safe id for an iframe embed of `course`. Used by the collapse-aware
// snippet so multiple TeeWeathr embeds on the same page don't collide.
function snippetId(courseId: string): string {
  const safe = courseId.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `teeweathr-${safe || "widget"}`;
}

function generateCode(course: EmbedCourse, config: EmbedConfig, baseUrl: string, tier?: string, apiKey?: string): string {
  const url = generateProductionUrl(course, config, baseUrl, apiKey);
  const id = snippetId(course.id);

  // Listener that resizes the iframe when the embedded widget posts a
  // teeweathr:resize message. Without this the in-iframe collapse hides
  // the widget content but the iframe keeps its declared height; with
  // this, the iframe shrinks to a thin 44px bar and frees real space on
  // the host page. Inline JS is small enough that platforms which strip
  // <script> tags fall back gracefully — collapse still works visually.
  const resizeListener = (fullHeight: string) => `<script>
(function(){var f=document.getElementById('${id}');if(!f)return;var h='${fullHeight}';window.addEventListener('message',function(e){var d=e.data;if(!d||d.source!=='teeweathr'||d.type!=='resize')return;f.style.transition='height 220ms ease';f.style.height=d.collapsed?'44px':h;});})();
</script>`;

  switch (config.format) {
    case "full":
      return `<!-- TeeWeathr - ${course.name} -->
<iframe
  id="${id}"
  src="${url}"
  width="${config.width}"
  height="${config.height}"
  style="border: none; border-radius: ${config.borderRadius}; overflow: hidden;"
  loading="lazy"
  title="TeeWeathr - ${course.name}"
></iframe>
${resizeListener(config.height)}`;

    case "card":
      return `<!-- TeeWeathr - ${course.name} -->
<iframe
  id="${id}"
  src="${url}"
  width="${config.width}"
  height="${config.height}"
  style="border: none; border-radius: ${config.borderRadius}; box-shadow: 0 4px 24px rgba(0,0,0,0.15);"
  loading="lazy"
  title="TeeWeathr - ${course.name}"
></iframe>
${resizeListener(config.height)}`;

    case "corner":
      return `<!-- TeeWeathr Corner Widget - ${course.name} -->
<div id="teeweathr-widget" style="position:fixed;${config.position === "bottom-right" ? "right" : "left"}:20px;bottom:20px;z-index:9999;">
  <div id="teeweathr-popup" style="display:none;margin-bottom:12px;">
    <iframe
      src="${url}"
      width="${config.width}"
      height="${config.height}"
      style="border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);"
      loading="lazy"
      title="TeeWeathr - ${course.name}"
    ></iframe>
    <button onclick="document.getElementById('teeweathr-popup').style.display='none'"
      style="position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.5);color:white;border:none;cursor:pointer;font-size:16px;">×</button>
  </div>
  <button onclick="var p=document.getElementById('teeweathr-popup');p.style.display=p.style.display==='none'?'block':'none';"
    style="width:56px;height:56px;border-radius:50%;background:${ACCENTS.find(a => a.id === config.accent)?.color || "#10b981"};border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 7V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2h-2"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/></svg>
  </button>
</div>`;

    case "banner":
      return `<!-- TeeWeathr Banner - ${course.name} -->
<div id="teeweathr-banner" style="position:relative;width:100%;">
  <iframe
    src="${url}"
    width="100%"
    height="${config.height}"
    style="border:none;border-bottom:1px solid ${config.theme === "dark" ? "#27272a" : "#e4e4e7"};"
    loading="lazy"
    title="TeeWeathr - ${course.name}"
  ></iframe>
  <button onclick="document.getElementById('teeweathr-banner').remove()"
    style="position:absolute;top:50%;right:12px;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:${config.theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"};color:${config.theme === "dark" ? "#a1a1aa" : "#52525b"};border:none;cursor:pointer;font-size:14px;">×</button>
</div>`;

    case "inline":
      return `<!-- TeeWeathr Badge - ${course.name} -->
<iframe
  src="${url}"
  width="${config.width}"
  height="${config.height}"
  style="border:none;border-radius:8px;vertical-align:middle;"
  loading="lazy"
  title="TeeWeathr - ${course.name}"
></iframe>`;
  }
}

// ─── Component ──────────────────────────────────────────────────

export function EmbedConfigurator({ course, baseUrl, tier, apiKey }: { course: EmbedCourse; baseUrl?: string; tier?: string; apiKey?: string }) {
  const [config, setConfig] = useState<EmbedConfig>({
    format: "full",
    theme: "dark",
    accent: "default",
    width: FORMAT_DEFAULTS.full.width,
    height: FORMAT_DEFAULTS.full.height,
    borderRadius: "16px",
    position: "bottom-right",
    autoOpen: false,
  });
  const [copied, setCopied] = useState(false);
  const [previewTab, setPreviewTab] = useState<"preview" | "code">("preview");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const resolvedBaseUrl = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  // Preview uses raw params so it renders inline; production code uses API key
  const previewUrl = useMemo(() => generatePreviewUrl(course, config, resolvedBaseUrl, tier), [course, config, resolvedBaseUrl, tier]);
  const code = useMemo(() => generateCode(course, config, resolvedBaseUrl, tier, apiKey), [course, config, resolvedBaseUrl, tier, apiKey]);
  const embedUrl = previewUrl; // preview iframe uses raw params

  function setFormat(format: EmbedFormat) {
    const defaults = FORMAT_DEFAULTS[format];
    setConfig((c) => ({ ...c, format, width: defaults.width, height: defaults.height }));
  }

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveDefaults() {
    setSaveState("saving");
    setSaveMsg(null);
    try {
      const res = await fetch("/api/dashboard/embed-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          theme: config.theme,
          accent: config.accent,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveState("error");
        setSaveMsg(err.error || "Save failed");
        return;
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setSaveMsg("Network error");
    }
  }

  return (
    <div className="space-y-6">
      {/* Format selector */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Embed Format</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {FORMATS.map((f) => {
            const Icon = f.icon;
            const isActive = config.format === f.id;
            return (
              <button key={f.id} onClick={() => setFormat(f.id)}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                  isActive ? "border-zinc-500 bg-zinc-800" : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                }`}>
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${isActive ? "text-zinc-200" : "text-zinc-600"}`} />
                <div>
                  <p className={`text-sm font-medium ${isActive ? "text-zinc-100" : "text-zinc-400"}`}>{f.label}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{f.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme + Accent */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Theme</h3>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button key={t.id} onClick={() => setConfig((c) => ({ ...c, theme: t.id }))}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                  config.theme === t.id ? "border-zinc-500 bg-zinc-800" : "border-zinc-800 hover:border-zinc-700"
                }`}>
                <div className={`h-4 w-4 rounded-full border border-zinc-600 ${t.bg}`} />
                <span className={config.theme === t.id ? "text-zinc-200" : "text-zinc-500"}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Accent Color</h3>
          <div className="flex gap-1.5">
            {ACCENTS.map((a) => (
              <button key={a.id} onClick={() => setConfig((c) => ({ ...c, accent: a.id }))}
                title={a.label}
                className={`h-8 w-8 rounded-full border-2 transition-all ${
                  config.accent === a.id ? "border-zinc-300 scale-110" : "border-transparent hover:border-zinc-600"
                }`}
                style={{ backgroundColor: a.color }} />
            ))}
          </div>
        </div>
      </div>

      {/* Save defaults — persists theme + accent for keyed embed loads. */}
      {apiKey && (
        <div className="flex items-center gap-3">
          <button
            onClick={saveDefaults}
            disabled={saveState === "saving"}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {saveState === "saved" ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Save as default for this course"}
          </button>
          {saveState === "error" && saveMsg && (
            <span className="text-xs text-red-400">{saveMsg}</span>
          )}
          <span className="text-[11px] text-zinc-600">Applies to your `?key=` iframe URL.</span>
        </div>
      )}

      {/* Size controls (for card/corner formats) */}
      {(config.format === "card" || config.format === "corner") && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Width</label>
            <input value={config.width} onChange={(e) => setConfig((c) => ({ ...c, width: e.target.value }))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
          </div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Height</label>
            <input value={config.height} onChange={(e) => setConfig((c) => ({ ...c, height: e.target.value }))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none" />
          </div>
        </div>
      )}

      {/* Corner position */}
      {config.format === "corner" && (
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Position</h3>
          <div className="flex gap-2">
            {(["bottom-right", "bottom-left"] as const).map((pos) => (
              <button key={pos} onClick={() => setConfig((c) => ({ ...c, position: pos }))}
                className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                  config.position === pos ? "border-zinc-500 bg-zinc-800 text-zinc-200" : "border-zinc-800 text-zinc-500"
                }`}>
                {pos === "bottom-right" ? "Bottom Right" : "Bottom Left"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Border radius */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Border Radius</h3>
        <div className="flex gap-2">
          {["0px", "8px", "16px", "24px"].map((r) => (
            <button key={r} onClick={() => setConfig((c) => ({ ...c, borderRadius: r }))}
              className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                config.borderRadius === r ? "border-zinc-500 bg-zinc-800 text-zinc-200" : "border-zinc-800 text-zinc-500"
              }`}>
              {r === "0px" ? "None" : r}
            </button>
          ))}
        </div>
      </div>

      {/* Preview / Code tabs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex border-b border-zinc-800">
            <button onClick={() => setPreviewTab("preview")}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 ${
                previewTab === "preview" ? "text-zinc-100 border-zinc-100" : "text-zinc-500 border-transparent"
              }`}>Preview</button>
            <button onClick={() => setPreviewTab("code")}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 ${
                previewTab === "code" ? "text-zinc-100 border-zinc-100" : "text-zinc-500 border-transparent"
              }`}><Code className="h-3 w-3 inline mr-1.5" />Code</button>
          </div>
          <button onClick={copyCode}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white transition-colors">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>

        {previewTab === "preview" ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 flex items-center justify-center min-h-[200px]">
            {config.format === "corner" ? (
              <div className="text-center">
                <p className="text-xs text-zinc-500 mb-2">Corner widget preview — see code tab for full implementation</p>
                <iframe src={embedUrl} width="360" height="400"
                  style={{ border: "none", borderRadius: "16px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
                  title="TeeWeathr preview" />
              </div>
            ) : config.format === "banner" ? (
              <div className="w-full">
                <iframe src={embedUrl} width="100%" height={config.height}
                  style={{ border: "none" }}
                  title="TeeWeathr preview" />
              </div>
            ) : (
              <iframe src={embedUrl}
                width={config.width}
                height={config.height}
                style={{ border: "none", borderRadius: config.borderRadius }}
                title="TeeWeathr preview" />
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <pre className="p-4 text-xs text-zinc-300 overflow-x-auto whitespace-pre font-mono leading-relaxed">
              {code}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
