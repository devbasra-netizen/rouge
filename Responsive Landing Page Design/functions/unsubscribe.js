// Public unsubscribe page: https://www.rouge-london.com/unsubscribe?u=<id>&t=<signed token>
// GET shows a confirm button (so email link scanners can't unsubscribe people by accident).
// POST unsubscribes. Gmail and Apple Mail's one-click "Unsubscribe" button also POSTs here.

import { escapeHtml, verifyUnsubscribe } from "./_lib/rouge.js"

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  if (url.searchParams.get("test") === "1") {
    return page("Test link", "This is the unsubscribe link from a test or preview email. Nothing has been changed.")
  }
  const u = url.searchParams.get("u")
  const t = url.searchParams.get("t")
  if (!(await verifyUnsubscribe(env, u, t))) {
    return page("Link not valid", "This unsubscribe link isn’t valid. Reply to any ROUGE email and we’ll remove you by hand.", 400)
  }
  const action = `/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`
  return page(
    "Unsubscribe",
    "Stop receiving ROUGE event emails?",
    200,
    `<form method="post" action="${escapeHtml(action)}"><button type="submit">Unsubscribe</button></form>`,
  )
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url)
  if (url.searchParams.get("test") === "1") {
    return page("Test link", "This is the unsubscribe link from a test or preview email. Nothing has been changed.")
  }
  const u = url.searchParams.get("u")
  const t = url.searchParams.get("t")
  if (!(await verifyUnsubscribe(env, u, t))) {
    return page("Link not valid", "This unsubscribe link isn’t valid. Reply to any ROUGE email and we’ll remove you by hand.", 400)
  }

  let oneClick = false
  try {
    const form = await request.formData()
    oneClick = form.get("List-Unsubscribe") === "One-Click"
  } catch {}

  const id = Number(u)
  const signup = await env.DB.prepare("SELECT id, email FROM signups WHERE id = ?1").bind(id).first()
  if (signup) {
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO unsubscribes (email, method) VALUES (?1, ?2)").bind(
        signup.email.toLowerCase(),
        oneClick ? "one_click" : "link",
      ),
      env.DB.prepare("UPDATE signups SET marketing_consent = 0 WHERE id = ?1").bind(id),
      env.DB.prepare("DELETE FROM deliveries WHERE signup_id = ?1 AND status = 'pending'").bind(id),
    ])
  }

  if (oneClick) {
    return new Response("Unsubscribed", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })
  }
  return page("Unsubscribed", "You won’t receive any more ROUGE event emails. Thank you for being here early.")
}

function page(title, message, status = 200, extra = "") {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)} · ROUGE</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#100909; color:#F2E9DF; font-family:"Helvetica Neue", Helvetica, Arial, sans-serif; }
  main { max-width:420px; padding:48px 24px; text-align:center; }
  .mark { font-family:"Bodoni 72", Didot, Georgia, serif; font-size:30px; letter-spacing:10px; margin:0 0 28px; }
  .rule { width:40px; height:1px; background:#9A2538; margin:0 auto 28px; }
  h1 { font-family:"Bodoni 72", Didot, Georgia, serif; font-weight:normal; font-size:26px; margin:0 0 14px; }
  p { color:#BFAEA6; line-height:1.6; margin:0 0 28px; }
  button { background:#9A2538; color:#F2E9DF; border:0; padding:15px 32px; font:inherit;
           font-size:13px; letter-spacing:3px; text-transform:uppercase; cursor:pointer; }
  button:focus-visible { outline:2px solid #F2E9DF; outline-offset:3px; }
</style>
</head>
<body>
<main>
  <p class="mark">ROUGE</p>
  <div class="rule"></div>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
  ${extra}
</main>
</body>
</html>`
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  })
}
