// Guards every /admin/* page and API route on the server.
// Requests without a valid Cloudflare Access login for an allowed admin email are refused,
// including requests that arrive on www.rouge-london.com, where Access does not run.

import { verifyAccess } from "../_lib/rouge.js"

export async function onRequest(context) {
  let admin = null
  try {
    admin = await verifyAccess(context.request, context.env)
  } catch (err) {
    console.error("Access check failed:", err && err.message)
  }
  if (!admin) {
    return new Response("Access denied.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    })
  }
  context.data.admin = admin

  const res = await context.next()
  const out = new Response(res.body, res)
  out.headers.set("Cache-Control", "no-store")
  out.headers.set("X-Robots-Tag", "noindex, nofollow")
  out.headers.set("Referrer-Policy", "no-referrer")
  out.headers.set("X-Content-Type-Options", "nosniff")
  out.headers.set("X-Frame-Options", "SAMEORIGIN")
  return out
}
