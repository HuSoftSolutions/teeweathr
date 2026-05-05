import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,

  // Iframe protection.
  //
  // Three rules, evaluated last-wins per header key for matching paths:
  //
  //   1. Default-deny on every path. /forecast, /, /integration, /dashboard,
  //      /admin etc. cannot be iframed by third-party sites — closes the
  //      "copy a public URL and embed it for free" loophole.
  //
  //   2. /embed?key=... → allow iframing from any origin. The keyed widget
  //      IS the embed product; access control is enforced server-side at
  //      /api/embed/[apiKey].
  //
  //   3. /embed without a `key` query param → same-origin only. The
  //      dashboard configurator's preview uses /embed?lat=&lon=&name= on
  //      a relative URL, which counts as same-origin and stays working.
  //      Third-party sites that try to iframe `/embed?lat=…` without a
  //      key are blocked.
  //
  // CSP `frame-ancestors` is the modern equivalent of the legacy
  // `X-Frame-Options` header. Every browser the widget targets supports
  // it. We don't set X-Frame-Options because it has no "allow any" value
  // — we'd need merge-order tricks to override a default DENY.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: "/embed",
        has: [{ type: "query", key: "key" }],
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        source: "/embed",
        missing: [{ type: "query", key: "key" }],
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
