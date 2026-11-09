// Older sign-up endpoint, kept so cached pages keep working. It now feeds the same ROUGE Members
// list (signups + member profile) with the same email confirmation step as /api/members.
import { json } from "../_lib/rouge.js"
import { ensureCommunity, publicPostAllowed, readBody, ipHash, rateLimit, FormError, cleanEmail, joinMember } from "../_lib/community/core.js"

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Not available right now." }, 503)
  if (!publicPostAllowed(request)) return json({ error: "Request blocked." }, 403)
  try {
    await ensureCommunity(env)
    const ip = await ipHash(env, request)
    if (!(await rateLimit(env.DB, `members-ip:${ip}:join`, 12, 3600))) return json({ error: "Too many attempts. Please try again in an hour." }, 429)
    const data = await readBody(request)
    const email = cleanEmail(data.email)
    if (data.marketingConsent !== true) return json({ error: "Consent is required" }, 400)
    const firstName = String(data.firstName || "").trim().slice(0, 60)
    await joinMember(env, request, { firstName, email, instagram: null, location: null, interests: [], topics: [], consent: true, source: String(data.source || "rouge-london.com").slice(0, 80) }, { ip })
    return json({ ok: true, next: "confirm" })
  } catch (err) {
    if (err instanceof FormError) return json({ error: err.message }, 400)
    console.error("signup failed:", err && err.stack ? err.stack : err)
    return json({ error: "Something went wrong. Please try again." }, 500)
  }
}
