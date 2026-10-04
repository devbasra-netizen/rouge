// Receives sign-ups from the website form and stores them in the D1 database bound as DB.
export async function onRequestPost({ request, env }) {
  let data
  try {
    data = await request.json()
  } catch {
    return json({ error: "Invalid request" }, 400)
  }
  const email = String(data.email || "").trim().toLowerCase()
  const firstName = String(data.firstName || "").trim().slice(0, 100)
  const source = String(data.source || "").slice(0, 100)
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please enter a valid email address" }, 400)
  }
  if (data.marketingConsent !== true) {
    return json({ error: "Consent is required" }, 400)
  }
  await env.DB.prepare(
    "INSERT INTO signups (email, first_name, marketing_consent, source) VALUES (?1, ?2, 1, ?3) ON CONFLICT(email) DO UPDATE SET first_name = COALESCE(NULLIF(excluded.first_name, ''), signups.first_name)"
    ).bind(email, firstName, source).run()
  return json({ ok: true })
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
