// Venue enquiries: send approved drafts through ROUGE's verified Resend domain, log every message and
// reply on the venue, schedule follow-ups, and turn venue replies into confirmed quotes.
// Replies go straight to Dev's inbox (Reply-To), so attachments arrive intact; Dev also gets a copy (BCC).
// Exports no request handlers, so Pages does not turn this into a route.

import { json, setting, sendWithResend, escapeHtml } from "../rouge.js"
import { InputError, cleanRecord } from "./registry.js"
import { londonToday, addDays } from "./api.js"
import { followUpBody, enquiryBody, enquirySubject } from "./outreach.js"

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i
const FOLLOW_UP_DAYS = 5
const OWNER = "dev.basra@icloud.com"

export function enquirySettings(env) {
  return {
    from: setting(env, "ENQUIRY_FROM"),
    replyTo: String(env.ENQUIRY_REPLY_TO || "").trim() || OWNER,
    bcc: String(env.ENQUIRY_BCC || "").trim() || OWNER,
    ready: !!String(env.RESEND_API_KEY || "").trim(),
  }
}

function toHtml(text) {
  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1e0d10">${String(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`
}

export async function sendEnquiries(db, env, body) {
  const cfg = enquirySettings(env)
  if (!cfg.ready) return json({ error: "Email sending isn't configured (RESEND_API_KEY is missing in Cloudflare).", code: "not_configured" }, 503)
  if (!body || body.confirm !== true) throw new InputError("Confirm the final review before sending.")
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 30) : []
  if (!ids.length) throw new InputError("Pick at least one enquiry to send.")
  const today = londonToday()
  const results = []
  for (const id of ids) {
    const q = await db.prepare("SELECT q.*, v.name AS venue_name, v.status AS venue_status, v.next_follow_up FROM hq_enquiries q JOIN hq_venues v ON v.id = q.venue_id WHERE q.id = ?1").bind(id).first()
    if (!q) {
      results.push({ id, ok: false, error: "Not found" })
      continue
    }
    if (q.status !== "draft" && q.status !== "failed") {
      results.push({ id, ok: false, error: "Already sent" })
      continue
    }
    const to = String(q.to_email || "").trim()
    if (!EMAIL_RE.test(to)) {
      results.push({ id, ok: false, error: `“${to || "(empty)"}” isn't a valid email address` })
      continue
    }
    if (!q.subject || !q.body) {
      results.push({ id, ok: false, error: "Subject and message are required" })
      continue
    }
    const sent = await sendWithResend(env, {
      to,
      subject: q.subject,
      text: q.body,
      html: toHtml(q.body),
      from: cfg.from,
      replyTo: cfg.replyTo,
      bcc: cfg.bcc && cfg.bcc.toLowerCase() !== to.toLowerCase() ? cfg.bcc : undefined,
      idempotencyKey: `hq-enquiry-${q.id}-${q.updated_at}`,
      tags: [{ name: "kind", value: "venue_enquiry" }],
    })
    if (!sent.ok) {
      await db.prepare("UPDATE hq_enquiries SET status = 'failed', error = ?1, updated_at = datetime('now') WHERE id = ?2").bind(String(sent.error || "Send failed").slice(0, 400), q.id).run()
      results.push({ id, ok: false, error: sent.error || "Send failed", venue: q.venue_name })
      continue
    }
    const followUp = addDays(today, FOLLOW_UP_DAYS)
    await db.batch([
      db.prepare("UPDATE hq_enquiries SET status = 'sent', provider_id = ?1, error = NULL, sent_at = datetime('now'), follow_up_on = ?2, updated_at = datetime('now') WHERE id = ?3").bind(sent.id, followUp, q.id),
      db
        .prepare(
          "UPDATE hq_venues SET status = CASE WHEN status IN ('prospect', 'researching') THEN 'enquired' ELSE status END, last_contact = ?1, next_follow_up = CASE WHEN next_follow_up IS NULL OR next_follow_up < ?2 THEN ?2 ELSE next_follow_up END, updated_at = datetime('now') WHERE id = ?3",
        )
        .bind(today, followUp, q.venue_id),
      db.prepare("INSERT INTO hq_venue_log (venue_id, kind, date, title, body) VALUES (?1, 'email', ?2, ?3, ?4)").bind(q.venue_id, today, `${q.kind === "followup" ? "Follow-up" : "Enquiry"} sent to ${to}`, `Subject: ${q.subject}\n\n${q.body}`),
      db.prepare("INSERT INTO hq_activity (kind, entity, entity_id, event_id, summary) VALUES ('create', 'enquiries', ?1, ?2, ?3)").bind(q.id, q.event_id, `Sent ${q.kind === "followup" ? "follow-up" : "enquiry"} to ${q.venue_name}`),
    ])
    results.push({ id, ok: true, venue: q.venue_name })
  }
  return json({ results, sent: results.filter((r) => r.ok).length })
}

export async function draftEnquiry(db, body) {
  const v = await db.prepare("SELECT * FROM hq_venues WHERE id = ?1").bind(Number(body && body.venue_id)).first()
  if (!v) return json({ error: "Venue not found" }, 404)
  if (!v.contact_email) throw new InputError(`Add ${v.name}'s email address to the venue first.`)
  const open = await db.prepare("SELECT * FROM hq_enquiries WHERE venue_id = ?1 AND status IN ('draft', 'failed') LIMIT 1").bind(v.id).first()
  if (open) return json({ item: open })
  const e002 = await db.prepare("SELECT id FROM hq_events WHERE number = '002' ORDER BY id LIMIT 1").first()
  const item = await db
    .prepare("INSERT INTO hq_enquiries (venue_id, event_id, kind, status, include, to_email, subject, body) VALUES (?1, ?2, 'enquiry', 'draft', 1, ?3, ?4, ?5) RETURNING *")
    .bind(v.id, v.shortlist_event_id || (e002 && e002.id) || null, v.contact_email, enquirySubject(v), enquiryBody(v))
    .first()
  return json({ item }, 201)
}

export async function draftFollowUp(db, id) {
  const q = await db.prepare("SELECT q.*, v.name AS venue_name FROM hq_enquiries q JOIN hq_venues v ON v.id = q.venue_id WHERE q.id = ?1").bind(Number(id)).first()
  if (!q) return json({ error: "Not found" }, 404)
  if (q.status !== "sent") throw new InputError("Only a sent enquiry with no reply can be followed up.")
  const open = await db.prepare("SELECT id FROM hq_enquiries WHERE parent_id = ?1 AND status = 'draft'").bind(q.id).first()
  if (open) return json({ item: await db.prepare("SELECT * FROM hq_enquiries WHERE id = ?1").bind(open.id).first() })
  const item = await db
    .prepare("INSERT INTO hq_enquiries (venue_id, event_id, parent_id, kind, status, include, to_email, subject, body) VALUES (?1, ?2, ?3, 'followup', 'draft', 1, ?4, ?5, ?6) RETURNING *")
    .bind(q.venue_id, q.event_id, q.id, q.to_email, q.subject.startsWith("Re: ") ? q.subject : `Re: ${q.subject}`, followUpBody({ name: q.venue_name }, q.sent_at))
    .first()
  return json({ item }, 201)
}

export async function logReply(db, id, body) {
  const q = await db.prepare("SELECT q.*, v.name AS venue_name FROM hq_enquiries q JOIN hq_venues v ON v.id = q.venue_id WHERE q.id = ?1").bind(Number(id)).first()
  if (!q) return json({ error: "Not found" }, 404)
  const text = String((body && body.text) || "").trim()
  if (text.length < 2) throw new InputError("Paste the venue's reply.")
  if (text.length > 60000) throw new InputError("That reply is too long to store.")
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : londonToday()
  const declined = !!body.declined
  await db.batch([
    db.prepare("UPDATE hq_enquiries SET status = ?1, replied_at = ?2, reply_body = ?3, follow_up_on = NULL, updated_at = datetime('now') WHERE id = ?4 OR parent_id = ?4 OR id = ?5").bind(declined ? "closed" : "replied", date, text, q.id, q.parent_id || 0),
    db
      .prepare("UPDATE hq_venues SET status = CASE WHEN ?1 = 1 THEN 'rejected' WHEN status IN ('prospect', 'researching', 'enquired', 'awaiting') THEN 'negotiating' ELSE status END, last_contact = ?2, next_follow_up = NULL, updated_at = datetime('now') WHERE id = ?3")
      .bind(declined ? 1 : 0, date, q.venue_id),
    db.prepare("INSERT INTO hq_venue_log (venue_id, kind, date, title, body) VALUES (?1, 'email', ?2, ?3, ?4)").bind(q.venue_id, date, declined ? `${q.venue_name} declined` : `Reply from ${q.venue_name}`, text),
    db.prepare("INSERT INTO hq_activity (kind, entity, entity_id, summary) VALUES ('update', 'enquiries', ?1, ?2)").bind(q.id, declined ? `${q.venue_name} declined the enquiry` : `${q.venue_name} replied`),
  ])
  return json({ ok: true })
}

// ---------- quotes ----------

const QUOTE_FIELDS = ["room", "available_dates", "capacity", "hire_fee_pence", "hire_note", "bar_min_pence", "bar_min_note", "deposit_pence", "security_pence", "security_note", "dj_equipment", "licence", "ticketing", "other_costs"]

const EXTRACT_RULES = `You extract a venue's quoted terms from an email they sent to ROUGE, a London event brand.
Return ONLY a JSON object, no prose. Use null for anything the email does not state. Never infer, estimate or round.
Money fields are whole pence (e.g. £1,500 → 150000). If a price is given with VAT stated separately, use the figure as written and mention VAT in the matching note.
Keys:
room (string), available_dates (string, exactly the dates/days they offered), capacity (integer, licensed or quoted standing capacity),
hire_fee_pence (integer), hire_note (string: what the fee includes, VAT, hours), bar_min_pence (integer), bar_min_note (string),
deposit_pence (integer), security_pence (integer), security_note (string), dj_equipment (string: models as written),
licence (string: finish time / last entry), ticketing (string), other_costs (string),
evidence (object mapping each non-null key above to the exact sentence from the email that states it).`

export async function extractQuote(env, body) {
  const key = String(env.ANTHROPIC_API_KEY || "").trim()
  if (!key) return json({ error: "ROUGE AI isn't connected, so fill the quote in by hand.", code: "not_configured" }, 503)
  const text = String((body && body.text) || "").trim()
  if (text.length < 20) throw new InputError("Paste the venue's reply first.")
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: String(env.ANTHROPIC_MODEL || "").trim() || "claude-sonnet-5-5",
      max_tokens: 1500,
      system: EXTRACT_RULES,
      messages: [{ role: "user", content: `Venue email:\n\n${text.slice(0, 40000)}` }],
    }),
  })
  if (!res.ok) return json({ error: "Claude couldn't read that reply right now. Fill the quote in by hand." }, 502)
  const data = await res.json()
  const out = ((data.content || []).find((b) => b.type === "text") || {}).text || ""
  const match = out.match(/\{[\s\S]*\}/)
  let parsed = {}
  try {
    parsed = match ? JSON.parse(match[0]) : {}
  } catch {
    return json({ error: "Couldn't read the terms automatically. Fill the quote in by hand." }, 502)
  }
  // Keep only values whose evidence actually appears in the email.
  const evidence = parsed.evidence && typeof parsed.evidence === "object" ? parsed.evidence : {}
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim()
  const hay = norm(text)
  const quote = {}
  const kept = {}
  for (const k of QUOTE_FIELDS) {
    const v = parsed[k]
    if (v === null || v === undefined || v === "") continue
    const ev = evidence[k]
    if (!ev || !hay.includes(norm(ev).slice(0, 80))) continue
    quote[k] = v
    kept[k] = String(ev).slice(0, 400)
  }
  return json({ quote, evidence: kept })
}

// Saves a confirmed quote and marks the matching venue facts as verified, citing the reply.
export async function saveQuote(db, body) {
  const venueId = Number(body && body.venue_id)
  const v = await db.prepare("SELECT * FROM hq_venues WHERE id = ?1").bind(venueId).first()
  if (!v) return json({ error: "Venue not found" }, 404)
  const { columns, values } = cleanRecord("quotes", { ...body, received_on: body.received_on || londonToday() }, { creating: true })
  const item = await db.prepare(`INSERT INTO hq_quotes (${columns.join(", ")}) VALUES (${columns.map((_, i) => `?${i + 1}`).join(", ")}) RETURNING *`).bind(...values).first()
  if (body.apply_to_venue) {
    let facts = {}
    try {
      facts = JSON.parse(v.facts || "{}") || {}
    } catch {}
    const src = `Written quote from the venue, ${item.received_on}`
    const map = { capacity: "capacity", hire_fee_pence: "hire_fee_pence", bar_min_pence: "bar_min_pence", deposit_pence: "deposit_pence", dj_equipment: "cdjs", licence: "licence" }
    const sets = []
    const args = []
    for (const [qk, vk] of Object.entries(map)) {
      if (item[qk] === null || item[qk] === undefined) continue
      args.push(item[qk])
      sets.push(`${vk} = ?${args.length}`)
      facts[vk] = { c: "verified", s: src }
    }
    if (item.hire_note) (args.push(item.hire_note), sets.push(`hire_fee_note = ?${args.length}`))
    if (item.bar_min_note) (args.push(item.bar_min_note), sets.push(`bar_min_note = ?${args.length}`))
    if (item.security_note || item.security_pence != null) {
      args.push([item.security_pence != null ? `£${(item.security_pence / 100).toLocaleString("en-GB")}` : null, item.security_note].filter(Boolean).join(" · "))
      sets.push(`security = ?${args.length}`)
      facts.security = { c: "verified", s: src }
    }
    args.push(JSON.stringify(facts))
    sets.push(`facts = ?${args.length}`)
    args.push(v.id)
    await db.prepare(`UPDATE hq_venues SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?${args.length}`).bind(...args).run()
  }
  await db.prepare("INSERT INTO hq_activity (kind, entity, entity_id, summary) VALUES ('create', 'quotes', ?1, ?2)").bind(item.id, `Logged a confirmed quote from ${v.name}`).run()
  return json({ item }, 201)
}

export function outreachConfig(env) {
  const c = enquirySettings(env)
  return json({ from: c.from, reply_to: c.replyTo, bcc: c.bcc, ready: c.ready, follow_up_days: FOLLOW_UP_DAYS })
}
