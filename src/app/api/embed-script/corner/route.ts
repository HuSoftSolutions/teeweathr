import { NextRequest, NextResponse } from "next/server";

// Self-installing corner-popup widget.
//
// Customer pastes a single <script src=".../api/embed-script/corner?..."> tag
// anywhere in their HTML/JSX. The script appends a fixed-position wrapper to
// document.body containing the trigger pill (its own iframe) and the popup
// (another iframe). All event handlers attach via addEventListener so React
// / Vue / etc. don't strip inline-onclick handlers, and document.body isn't
// required to exist before the script runs.
//
// Bake every parameter into the response so customers paste exactly one
// URL — same as how Crisp/Drift/Intercom installers work.

function safeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function originFor(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return new URL(req.url).origin;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = sp.get("key") || "";
  const course = sp.get("course") || "";
  const theme = sp.get("theme") || "dark";
  const accent = sp.get("accent") || "default";
  const position = sp.get("position") === "bottom-left" ? "bottom-left" : "bottom-right";
  const width = sp.get("width") || "360px";
  const height = sp.get("height") || "460px";

  const origin = originFor(req);
  const sideKey = position === "bottom-right" ? "right" : "left";
  const alignItems = position === "bottom-right" ? "flex-end" : "flex-start";

  // Deterministic id keyed on (apiKey, course) so a duplicate <script>
  // tag (e.g. customer pasted into both layout and a page template)
  // doesn't double-inject — the second invocation finds the existing
  // wrapper and bails out.
  const id = `teeweathr-corner-${safeId(key || "raw")}-${safeId(course || "x")}`;
  const popupId = `${id}-popup`;
  const triggerId = `${id}-trigger`;

  // Build the embed iframe URL with the params we received.
  const embedParams = new URLSearchParams();
  if (key) embedParams.set("key", key);
  if (course) embedParams.set("course", course);
  if (theme && theme !== "dark") embedParams.set("theme", theme);
  if (accent && accent !== "default") embedParams.set("accent", accent);
  const embedUrl = `${origin}/embed?${embedParams.toString()}`;
  const pillUrl = embedUrl + (embedParams.toString() ? "&" : "") + "view=pill";

  // JSON-encode strings going into the JS body — defends against any
  // exotic characters in apiKey/course that could break the script.
  const J = (s: string) => JSON.stringify(s);

  const js = `(function(){
  if (document.getElementById(${J(id)})) return;

  function inject() {
    if (!document.body) { setTimeout(inject, 30); return; }

    var wrapper = document.createElement('div');
    wrapper.id = ${J(id)};
    wrapper.style.cssText = ${J(`position:fixed;${sideKey}:20px;bottom:20px;z-index:2147483647;max-width:calc(100vw - 40px);display:flex;flex-direction:column;align-items:${alignItems};`)};

    var popup = document.createElement('div');
    popup.id = ${J(popupId)};
    popup.style.cssText = ${J(`display:none;position:relative;margin-bottom:12px;width:${width};max-width:calc(100vw - 40px);`)};

    var popupIframe = document.createElement('iframe');
    popupIframe.src = ${J(embedUrl)};
    popupIframe.title = "TeeWeathr forecast";
    popupIframe.loading = "lazy";
    popupIframe.setAttribute('width', ${J(width)});
    popupIframe.setAttribute('height', ${J(height)});
    popupIframe.style.cssText = ${J(`border:none;border-radius:16px;display:block;width:100%;height:${height};max-height:calc(100vh - 100px);`)};
    popup.appendChild(popupIframe);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close forecast');
    closeBtn.textContent = '\\u00d7';
    closeBtn.style.cssText = ${J(`position:absolute;top:8px;${sideKey}:8px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.5);color:white;border:none;cursor:pointer;font-size:16px;line-height:1;`)};
    closeBtn.addEventListener('click', function(){ popup.style.display = 'none'; });
    popup.appendChild(closeBtn);

    var trigger = document.createElement('div');
    trigger.id = ${J(triggerId)};
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('aria-label', 'Open forecast');
    trigger.style.cssText = "cursor:pointer;width:160px;height:44px;border-radius:22px;overflow:hidden;";

    var pillIframe = document.createElement('iframe');
    pillIframe.src = ${J(pillUrl)};
    pillIframe.title = "TeeWeathr forecast";
    pillIframe.loading = "lazy";
    pillIframe.setAttribute('width', '160');
    pillIframe.setAttribute('height', '44');
    pillIframe.style.cssText = "border:none;display:block;pointer-events:none;";
    trigger.appendChild(pillIframe);

    function toggle(){ popup.style.display = popup.style.display === 'none' ? 'block' : 'none'; }
    trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

    wrapper.appendChild(popup);
    wrapper.appendChild(trigger);
    document.body.appendChild(wrapper);
  }

  inject();
})();
`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Cache aggressively at the edge — the response only changes when
      // the customer regenerates their snippet (different params).
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
