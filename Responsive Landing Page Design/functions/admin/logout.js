// /admin/logout: ends the dashboard session.

import { clearedSessionCookie } from "../_lib/rouge.js"

export async function onRequest() {
  return new Response(null, {
    status: 303,
    headers: { Location: "/admin/login", "Set-Cookie": clearedSessionCookie(), "Cache-Control": "no-store" },
  })
}
