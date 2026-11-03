// /admin/study: Dev's DSI Assignment 1 revision guide (protected by functions/admin/_middleware.js).
// The guide itself lives in study/guide.html; scripts/build-study.mjs bundles it into _lib/study-page.js.

import { STUDY_HTML } from "../_lib/study-page.js"

export async function onRequestGet() {
  const nonce = crypto.randomUUID().replace(/-/g, "")
  const body = STUDY_HTML.replace(/<script>/g, `<script nonce="${nonce}">`)
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Study">
<meta name="theme-color" content="#0D1518">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>`
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": [
        "default-src 'none'",
        `script-src 'nonce-${nonce}'`,
        "style-src 'unsafe-inline' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        "connect-src 'self'",
        "img-src 'self' data:",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join("; "),
    },
  })
}
