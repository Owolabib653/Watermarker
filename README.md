# PixelGuard

PixelGuard is a zero-config, client-side watermark studio for creators and teams. It runs as a static site and processes images locally in the browser.

## Features

- Batch logo or text watermarking with PNG, JPEG, WebP, and AVIF export.
- Dynamic text tokens: `{filename}`, `{year}`, `{date}`, and `{index}`.
- Cached thumbnails, object URL memory cleanup, global drag-and-drop, and non-blocking batch packaging.
- Per-image interactive positioning with boundary locking and aspect-ratio-safe logo scaling.
- No uploads, telemetry, or server runtime required.

## Run locally

Serve the project directory with any static server, then open `index.html`. For example:

```bash
npx serve .
```

The same directory can be deployed to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or any static host. The ZIP and FileSaver dependencies are vendored in `vendor/`, so the app works offline after the initial download.

## Browser support

Use a current Chrome, Edge, Firefox, or Safari release with Canvas, `URL.createObjectURL`, WebP export, and optional AVIF export support. AVIF is feature-detected by the browser; PNG remains the compatibility fallback.

## Monetization

Set `config.enablePaywall` in `app.js` to `true`, adjust `freeExportLimit`, and set `paymentUrl` to a Stripe Checkout or Lemon Squeezy URL. The client-side gate is intentionally simple so buyers can replace it with their own entitlement service.

## Architecture

`index.html` contains the static shell, `styles.css` contains the responsive product UI, and `app.js` owns state, Canvas rendering, downloads, and local persistence. `vendor/` contains pinned local copies of JSZip and FileSaver.
