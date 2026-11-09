// POST /api/radio/apply — ROUGE Radio guest selector applications (not event bookings).
import { json } from "../../_lib/rouge.js"
import { ensureCommunity, publicPostAllowed, readBody, ipHash, rateLimit, FormError, radioInput, submitApplication } from "../../_lib/community/core.js"

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Applications aren't open right now." }, 503)
  if (!publicPostAllowed(request)) return json({ error: "Request blocked." }, 403)
  try {
    await ensureCommunity(env)
    const ip = await ipHash(env, request)
    if (!(await rateLimit(env.DB, `apply-ip:${ip}`, 6, 3600))) return json({ error: "Too many applications from this connection. Please try again later." }, 429)
    const body = await readBody(request, 60000)
    if (body.company || (Number.isFinite(body.elapsed) && body.elapsed < 8000)) return json({ ok: true, ref: "RR-RECEIVED" })
    const input = radioInput(body)
    const r = await submitApplication(env, request, input, { ip })
    return json({ ok: true, ref: r.ref })
  } catch (err) {
    if (err instanceof FormError) return json({ error: err.message, field: err.field }, 400)
    console.error("radio apply failed:", err && err.stack ? err.stack : err)
    return json({ error: "Something went wrong on our side. Your answers are saved on this device — please try again in a moment." }, 500)
  }
}

export const onRequestGet = () => new Response(null, { status: 302, headers: { Location: "/radio/apply" } })
