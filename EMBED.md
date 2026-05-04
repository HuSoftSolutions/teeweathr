# TeeWeathr — Embed Snippets

Reference for embedding the TeeWeathr widget on your course website.
Every embed needs an API key — sign up at <https://teeweathr.com/signup>
to get one. Free tier is supported (with a sponsor ad in the widget).

> **Just want to see how it looks first?** The landing page at
> <https://teeweathr.com> shows a live demo running on Pebble Beach Golf
> Links — same widget your golfers will see, no signup required to view.

---

## Quick start

1. **Sign up** at <https://teeweathr.com/signup>.
2. **Add your course** when prompted (search 16,000+ U.S. courses or add
   manually with coordinates).
3. **Customize** in your dashboard — pick theme, accent color, format.
4. **Copy your snippet** from the dashboard's Embed page. It comes
   pre-filled with your API key and the size you chose.
5. **Paste it** anywhere on your site that accepts HTML.

The dashboard configurator generates the snippet for you. The examples
below are reference patterns — replace `YOUR_API_KEY` with your real key
(everything starting `tw_…`).

---

## How to use the snippet

### Wix
**Add → Embed Code → Custom Embeds → Embed HTML** → paste your snippet.

### Squarespace
**Add Block → Code Block** → set the block type to HTML → paste your
snippet.

### WordPress
**Custom HTML block** (Gutenberg) or paste into a "Custom HTML" widget.

### Anywhere else
Anywhere you can paste raw `<iframe>` HTML, the widget will load.

---

## Size patterns

The widget auto-detects its container width and switches between four
layouts. Pick the size that fits your site, or use `width="100%"` and let
your site builder control the wrapper width.

### Badge — header strip · 320 × 80
Drop in a site header or top nav.

```html
<iframe
  src="https://teeweathr.com/embed?key=YOUR_API_KEY"
  width="320" height="80"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

### Compact — sidebar · 320 × 280
Sidebar / card slot.

```html
<iframe
  src="https://teeweathr.com/embed?key=YOUR_API_KEY"
  width="320" height="280"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

### Medium — content card · 400 × 440
Inline content card.

```html
<iframe
  src="https://teeweathr.com/embed?key=YOUR_API_KEY"
  width="400" height="440"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

### Full — booking page / hero · 500 × 640
Tee-time pages, hero blocks.

```html
<iframe
  src="https://teeweathr.com/embed?key=YOUR_API_KEY"
  width="500" height="640"
  style="border:0; border-radius:12px; max-width:100%"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

### Responsive
Set `width="100%"` and the widget adapts to whatever container holds it.

```html
<iframe
  src="https://teeweathr.com/embed?key=YOUR_API_KEY"
  width="100%" height="320"
  style="border:0; border-radius:12px"
  loading="lazy"
  title="TeeWeathr golf weather"
></iframe>
```

| Container width | Layout |
| --- | --- |
| ≤ 320 px | Badge (single-line) |
| ≤ 400 px | Compact |
| ≤ 500 px | Medium |
| 500 px+ | Full |

---

## URL parameters

The only required parameter is `key`. Everything else is configured server-
side from your dashboard, so you can change theme/accent/branding without
having to redeploy your snippet.

| Param | Values | Notes |
| --- | --- | --- |
| `key` | API key | **Required.** Issued at signup. |
| `course` | course id | Optional. If your business has multiple courses, pick which one. Defaults to your first. |

> **Tier features** (ads, branding, custom colors, white-label) are
> resolved server-side from your subscription. Changing tier in the
> dashboard or via Stripe propagates within ~10 minutes — usually
> immediately, since dashboard saves bust the cache via `revalidateTag`.

---

## Wix gotchas

- Wix's HTML embed sandboxes the iframe inside another iframe — that's
  fine, the widget handles being nested.
- If the layout looks cramped, give the Wix embed element ~20 px more
  height than the iframe `height` attribute.
- For responsive Wix sections, use `width="100%"` and let Wix's element
  settings drive the height.

---

## Need help?

- **Dashboard:** <https://teeweathr.com/dashboard/embed> — live preview,
  format picker, copy-paste snippet
- **Multi-course / white-label:** <hello@teeweathr.com>
- **Status / outages:** check <https://teeweathr.com> (the live demo on
  the landing page is always running on Pebble Beach Golf Links)
