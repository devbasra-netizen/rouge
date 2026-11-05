// /admin/hq/* — ROUGE HQ, the private operating system. Protected by functions/admin/_middleware.js.
// The app itself is bundled from hq/src by scripts/build-hq.mjs into _lib/hq-assets.js and served here,
// so it never ships with the public site.

import { HQ_JS, HQ_CSS, HQ_VERSION, HQ_ICON } from "../../_lib/hq-assets.js"

const ASSET_CACHE = "private, max-age=31536000, immutable"

export async function onRequestGet({ params }) {
  const parts = Array.isArray(params.path) ? params.path : params.path ? [params.path] : []
  const last = parts.length === 1 ? String(parts[0]) : ""
  const asset = /^app\.([0-9a-f]{12})\.(js|css)$/.exec(last)
  if (asset) {
    // An old version name still gets the current file, just without long caching.
    const cache = asset[1] === HQ_VERSION ? ASSET_CACHE : "no-store"
    if (asset[2] === "js") return new Response(HQ_JS, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": cache } })
    return new Response(HQ_CSS, { headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": cache } })
  }
  if (last === "icon.png") {
    const bin = Uint8Array.from(atob(HQ_ICON), (c) => c.charCodeAt(0))
    return new Response(bin, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=604800" } })
  }

  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0c0809">
<meta name="color-scheme" content="dark light">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ROUGE HQ">
<title>ROUGE HQ</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/admin/hq/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap">
<link rel="stylesheet" href="/admin/hq/app.${HQ_VERSION}.css">
<script>try{var t=localStorage.getItem("hq:theme");t=t&&JSON.parse(t);if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
<script src="/admin/hq/app.${HQ_VERSION}.js" defer></script>
</head>
<body>
<div id="hq"></div>
<noscript><p style="padding:24px;font-family:sans-serif">ROUGE HQ needs JavaScript.</p></noscript>
</body>
</html>`
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": [
        "default-src 'none'",
        "script-src 'self' 'sha256-+bqGDYKRX4wboB/p4O1wHAguCXNdJU4k5CjTsAYFh64='",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
    },
  })
}
