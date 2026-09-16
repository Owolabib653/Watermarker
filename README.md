# PixelGuard

PixelGuard is a React + Vite, client-side watermark studio for creators and teams. It processes images locally in the browser.

## Features

- Batch logo or text watermarking with PNG, JPEG, WebP, and AVIF export.
- Dynamic text tokens: `{filename}`, `{year}`, `{date}`, and `{index}`.
- Native bitmap previews, object URL memory cleanup, global drag-and-drop, and worker-backed batch rendering.
- Per-image interactive positioning with boundary locking and aspect-ratio-safe logo scaling.
- No uploads, telemetry, or server runtime required.

## Run locally

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

The production bundle is generated with `npm run build` and can be deployed to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or any static host.

## Browser support

Use a current Chrome, Edge, Firefox, or Safari release with Canvas, `URL.createObjectURL`, WebP export, and optional AVIF export support. AVIF is feature-detected by the browser; PNG remains the compatibility fallback.

## Monetization

Set `config.enablePaywall` in `app.js` to `true`, adjust `freeExportLimit`, and set `paymentUrl` to a Stripe Checkout or Lemon Squeezy URL. The client-side gate is intentionally simple so buyers can replace it with their own entitlement service.

## Architecture

`src/App.jsx` owns the React state and workflow, `src/styles.css` contains the responsive product UI, and `src/export.worker.js` renders full-resolution exports off the main thread. `fflate` packages ZIP downloads without the legacy JSZip runtime.
