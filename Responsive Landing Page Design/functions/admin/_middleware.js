// Guards every /admin/* page and API route on the server.
// A request gets through only with a valid admin session (password login) or a valid
// Cloudflare Access login for an allowed email. /admin/login and /admin/logout are the only exceptions.

import { verifyAdmin } from "../_lib/rouge.js"

const OPEN_PATHS = new Set(["/admin/login", "/admin/logout"])

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const path = url.pathname.replace(/\/+$/, "") || "/"

  if (!OPEN_PATHS.has(path)) {
    const admin = await verifyAdmin(context.request, context.env)
    if (!admin) {
      const wantsPage = context.request.method === "GET" && !path.startsWith("/admin/api/")
      if (wantsPage) {
        return new Response(null, { status: 302, headers: { Location: "/admin/login", "Cache-Control": "no-store" } })
      }
      return new Response(JSON.stringify({ error: "Not signed in." }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      })
    }
    context.data.admin = admin
  }

  const res = await context.next()
  const out = new Response(res.body, res)
  out.headers.set("Cache-Control", "no-store")
  out.headers.set("X-Robots-Tag", "noindex, nofollow")
  out.headers.set("Referrer-Policy", "same-origin")
  out.headers.set("X-Content-Type-Options", "nosniff")
  out.headers.set("X-Frame-Options", "SAMEORIGIN")
  out.headers.set("Strict-Transport-Security", "max-age=31536000")
  return out
}
