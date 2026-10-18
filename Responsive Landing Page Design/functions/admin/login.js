// /admin/login: password sign-in for the dashboard. The password lives only in the
// ADMIN_PASSWORD Cloudflare secret; it is checked on the server and never sent to the browser.

import { checkPassword, escapeHtml, passwordLoginEnabled, sessionCookie, setting, sleep } from "../_lib/rouge.js"

export async function onRequestGet({ env }) {
  return page(env, passwordLoginEnabled(env) ? "" : "Sign-in isn’t set up yet: add the ADMIN_PASSWORD and APP_SECRET secrets in Cloudflare, then redeploy.")
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin")
  if (origin && origin !== new URL(request.url).origin) return page(env, "Request blocked.", 403)
  if (!passwordLoginEnabled(env)) return onRequestGet({ env })

  let password = ""
  try {
    const form = await request.formData()
    password = String(form.get("password") || "")
  } catch {}

  if (!(await checkPassword(env, password))) {
    await sleep(1000) // slows down guessing
    return page(env, "That password isn’t right.", 401)
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/admin/invites", "Set-Cookie": await sessionCookie(env), "Cache-Control": "no-store" },
  })
}

function page(env, error = "", status = 200) {
  const username = (setting(env, "ADMIN_EMAILS").split(",")[0] || "").trim()
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sign in · ROUGE Admin</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#100909;
         color:#F2E9DF; font-family:"Helvetica Neue", Helvetica, Arial, sans-serif; }
  main { width:100%; max-width:360px; padding:40px 24px; }
  .mark { font-family:"Bodoni 72", Didot, Georgia, serif; font-size:30px; letter-spacing:10px; margin:0; }
  .crumb { font-size:11px; letter-spacing:4px; color:#BFAEA6; margin:8px 0 28px; }
  .rule { width:40px; height:1px; background:#9A2538; margin:0 0 28px; }
  label { display:block; font-size:11px; letter-spacing:3px; color:#BFAEA6; margin-bottom:8px; }
  input[type=password] { width:100%; padding:14px 12px; font:inherit; font-size:16px; color:#F2E9DF; background:#170C0D;
         border:1px solid #33171C; border-radius:0; }
  input:focus-visible, button:focus-visible { outline:2px solid #F2E9DF; outline-offset:2px; }
  button { margin-top:16px; width:100%; min-height:48px; background:#9A2538; color:#F2E9DF; border:0; font:inherit;
           font-size:12px; letter-spacing:3px; text-transform:uppercase; cursor:pointer; }
  .err { color:#E0727F; font-size:14px; margin:0 0 16px; }
</style>
</head>
<body>
<main>
  <p class="mark">ROUGE</p>
  <p class="crumb">ADMIN / SIGN IN</p>
  <div class="rule"></div>
  ${error ? `<p class="err" role="alert">${escapeHtml(error)}</p>` : ""}
  <form method="post" action="/admin/login">
    <input type="text" name="username" value="${escapeHtml(username)}" autocomplete="username" hidden>
    <label for="password">PASSWORD</label>
    <input id="password" type="password" name="password" autocomplete="current-password" required autofocus>
    <button type="submit">Sign in</button>
  </form>
</main>
</body>
</html>`
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  })
}
