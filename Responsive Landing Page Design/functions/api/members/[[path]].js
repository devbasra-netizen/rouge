// Public ROUGE Members API.
//   POST /api/members                 join (or update details); always the same answer, double opt-in by email
//   POST /api/members/confirm         { u, n, t } from the confirmation email
//   GET  /api/members/preferences     ?u=&t=  (signed link from every member email)
//   POST /api/members/preferences     { u, t, ... }
//   POST /api/members/delete          { u, t, confirm: "DELETE" }  right to erasure

import { json } from "../../_lib/rouge.js"
import { ensureCommunity, publicPostAllowed, readBody, ipHash, rateLimit, FormError, memberInput, joinMember, confirmMember, memberPreferences, updatePreferences, eraseMember, verifyPrefs } from "../../_lib/community/core.js"

export async function onRequest({ request, env, params }) {
  const parts = Array.isArray(params.path) ? params.path : params.path ? [params.path] : []
  const action = parts.join("/")
  if (!env.DB) return json({ error: "Not available right now." }, 503)
  try {
    await ensureCommunity(env)
    const ip = await ipHash(env, request)
    if (request.method === "GET" && action === "preferences") {
      const url = new URL(request.url)
      const u = url.searchParams.get("u")
      if (!(await verifyPrefs(env, u, url.searchParams.get("t")))) return json({ error: "This link isn't valid." }, 400)
      const prefs = await memberPreferences(env, u)
      return prefs ? json({ ok: true, prefs }) : json({ error: "We couldn't find that membership." }, 404)
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405)
    if (!publicPostAllowed(request)) return json({ error: "Request blocked." }, 403)
    if (!(await rateLimit(env.DB, `members-ip:${ip}:${action || "join"}`, 12, 3600))) return json({ error: "Too many attempts. Please try again in an hour." }, 429)
    const body = await readBody(request)

    if (action === "") {
      // Honeypot and too-fast submissions get a normal-looking answer and nothing else.
      if (body.company || (Number.isFinite(body.elapsed) && body.elapsed < 1500)) return json({ ok: true, next: "confirm" })
      const input = memberInput(body)
      await joinMember(env, request, input, { ip })
      return json({ ok: true, next: "confirm" })
    }
    if (action === "confirm") {
      const r = await confirmMember(env, request, body, { ip })
      return r.ok ? json(r) : json({ error: r.reason === "expired" ? "This link has expired. Join again and we'll send a fresh one." : "This link isn't valid." }, 400)
    }
    if (action === "preferences" || action === "delete") {
      if (!(await verifyPrefs(env, body.u, body.t))) return json({ error: "This link isn't valid." }, 400)
      if (action === "delete") {
        if (body.confirm !== "DELETE") return json({ error: "Type DELETE to confirm." }, 400)
        await eraseMember(env.DB, Number(body.u))
        return json({ ok: true })
      }
      const ok = await updatePreferences(env, request, body.u, body, { ip })
      return ok ? json({ ok: true, prefs: await memberPreferences(env, body.u) }) : json({ error: "We couldn't find that membership." }, 404)
    }
    return json({ error: "Not found" }, 404)
  } catch (err) {
    if (err instanceof FormError) return json({ error: err.message, field: err.field }, 400)
    console.error("members api failed:", err && err.stack ? err.stack : err)
    return json({ error: "Something went wrong on our side. Please try again in a moment." }, 500)
  }
}
