# TeeWeathr — Embed Snippets

Copy-paste `<iframe>` snippets for embedding the TeeWeathr widget on any site (Wix, Squarespace, WordPress, custom HTML, etc.).

> **Replace `https://teeweathr.com` with your actual production domain** if it differs.
> Course is Pebble Beach Golf Links — change `lat`, `lon`, `name`, `holes`, `par` to point at any course.

## How to use

### Wix
**Add → Embed Code → Custom Embeds → Embed HTML** → paste a snippet from below.

### Squarespace
**Add Block → Code Block** → set the block type to HTML → paste a snippet.

### WordPress
**Custom HTML block** (Gutenberg) or paste into a "Custom HTML" widget.

### Anywhere else
Anywhere you can paste raw `<iframe>` HTML, the widget will load.

## Live tester

`/embed-tester.html` (deployed alongside the site) renders all eight variants live with a per-card "copy snippet" button. Open it on whatever URL you want the snippets to point at — the page auto-detects its host.

---

## 1. Badge — header strip · Free, dark, ad on
**320 × 80** — drop in a site header or top nav.

```html
<iframe
  src="https://teeweathr.com/embed?lat=36.5685&lon=-121.9460&name=Pebble%20Beach%20Golf%20Links&holes=18&par=72&theme=dark&accent=default&ads=true&branding=true"
  width="320" height="80"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

## 2. Badge — Pro, light · no ads, branded
**320 × 80**

```html
<iframe
  src="https://teeweathr.com/embed?lat=36.5685&lon=-121.9460&name=Pebble%20Beach%20Golf%20Links&holes=18&par=72&theme=light&accent=default&ads=false&branding=true"
  width="320" height="80"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

## 3. Compact — sidebar · Free, dark, ad on
**320 × 280** — sidebar / card slot.

```html
<iframe
  src="https://teeweathr.com/embed?lat=36.5685&lon=-121.9460&name=Pebble%20Beach%20Golf%20Links&holes=18&par=72&theme=dark&accent=default&ads=true&branding=true"
  width="320" height="280"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

## 4. Compact — sidebar · Pro, light, blue accent
**320 × 280**

```html
<iframe
  src="https://teeweathr.com/embed?lat=36.5685&lon=-121.9460&name=Pebble%20Beach%20Golf%20Links&holes=18&par=72&theme=light&accent=blue&ads=false&branding=true"
  width="320" height="280"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

## 5. Medium — card · Free, dark, ad on
**400 × 440** — inline content card.

```html
<iframe
  src="https://teeweathr.com/embed?lat=36.5685&lon=-121.9460&name=Pebble%20Beach%20Golf%20Links&holes=18&par=72&theme=dark&accent=default&ads=true&branding=true"
  width="400" height="440"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

## 6. Medium — card · Pro, light, orange accent
**400 × 440** — for resort-style brand palettes.

```html
<iframe
  src="https://teeweathr.com/embed?lat=36.5685&lon=-121.9460&name=Pebble%20Beach%20Golf%20Links&holes=18&par=72&theme=light&accent=orange&ads=false&branding=true"
  width="400" height="440"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

## 7. Full — booking page · Pro, dark, no ads
**500 × 640** — tee-time pages, hero blocks.

```html
<iframe
  src="https://teeweathr.com/embed?lat=36.5685&lon=-121.9460&name=Pebble%20Beach%20Golf%20Links&holes=18&par=72&theme=dark&accent=default&ads=false&branding=true"
  width="500" height="640"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

## 8. Full — white-label · Enterprise, light, purple, branding off
**500 × 640** — looks fully native.

```html
<iframe
  src="https://teeweathr.com/embed?lat=36.5685&lon=-121.9460&name=Pebble%20Beach%20Golf%20Links&holes=18&par=72&theme=light&accent=purple&ads=false&branding=false"
  width="500" height="640"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

---

## URL parameter reference

| Param | Values | Notes |
| --- | --- | --- |
| `lat` | float | Course latitude |
| `lon` | float | Course longitude |
| `name` | string | Course name (URL-encoded — `%20` for spaces) |
| `holes` | `9` \| `18` \| `27` \| `36` | Optional |
| `par` | int | Optional |
| `theme` | `dark` \| `light` | Default: `dark` |
| `accent` | `default` \| `blue` \| `purple` \| `red` \| `orange` \| `zinc` | `default` is emerald green |
| `ads` | `true` \| `false` | Free tier defaults to `true` |
| `branding` | `true` \| `false` | "Powered by TeeWeathr" footer |
| `key` | API key | When present, **server-controlled** — URL params for ads/branding are ignored and tier features are enforced from the dashboard |

## Responsive sizing

The widget auto-detects its container width and switches between four layouts:

| Width | Layout |
| --- | --- |
| ≤ 320px | Badge (single-line) |
| ≤ 400px | Compact |
| ≤ 500px | Medium |
| 500px+ | Full |

Set the iframe `width="100%"` and let your site builder control the wrapper width — the widget adapts.

## Wix gotchas

- Wix's HTML embed sandboxes the iframe inside another iframe — that's fine, the widget handles being nested.
- If the layout looks cramped, give the Wix embed element ~20px more height than the iframe `height` attribute.
- For responsive Wix sections, change `width="320"` to `width="100%"` and let Wix's element settings drive the height.
