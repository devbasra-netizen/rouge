// ROUGE AI inside HQ: chat that knows the live HQ data, and deep research with web search and web fetch.
// The Anthropic key stays on the server. Responses are Anthropic's own event stream passed straight
// through to the signed-in admin's browser, which renders progress, text and citations as they arrive.
// Exports no request handlers, so Pages does not turn this into a route.

import { json } from "../rouge.js"
import { InputError } from "./registry.js"
import { londonToday, addDays } from "./api.js"

const DEFAULT_MODEL = "claude-sonnet-5-5"
const MAX_TURNS = 30
const MAX_TURN_CHARS = 12000

export const DEPTHS = {
  quick: { searches: 5, fetches: 3, max_tokens: 6000, label: "Quick scan" },
  standard: { searches: 10, fetches: 6, max_tokens: 10000, label: "Standard" },
  deep: { searches: 20, fetches: 12, max_tokens: 16000, label: "Deep dive" },
}

const LONDON = { type: "approximate", city: "London", region: "England", country: "GB", timezone: "Europe/London" }

function apiKey(env) {
  return String(env.ANTHROPIC_API_KEY || "").trim()
}

function chatModel(env) {
  return String(env.ANTHROPIC_MODEL || "").trim() || DEFAULT_MODEL
}

function researchModel(env) {
  return String(env.ANTHROPIC_RESEARCH_MODEL || env.ANTHROPIC_MODEL || "").trim() || DEFAULT_MODEL
}

const pounds = (p) => (p === null || p === undefined ? "—" : "£" + (p / 100).toLocaleString("en-GB", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 }))
const rows = (r) => (r && r.results) || []
const CONF = { verified: "verified", estimate: "estimate", confirm: "to confirm" }

// A compact, factual picture of ROUGE right now, built only from the database.
export async function buildContext(db, { focusEventId = null, focusVenueId = null } = {}) {
  const today = londonToday()
  const [notes, events, tasks, venues, ideas, ledger, budget, content, campaigns, radio, people] = await db.batch([
    db.prepare("SELECT title, kind, body FROM hq_notes WHERE ai_context = 1 ORDER BY pinned DESC, updated_at DESC LIMIT 6"),
    db.prepare("SELECT * FROM hq_events ORDER BY COALESCE(date, '9999'), number"),
    db.prepare("SELECT t.title, t.status, t.priority, t.due, t.owner, e.number AS ev FROM hq_tasks t LEFT JOIN hq_events e ON e.id = t.event_id WHERE t.parent_id IS NULL AND t.status != 'done' ORDER BY COALESCE(t.due, '9999'), CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END LIMIT 40"),
    db.prepare("SELECT * FROM hq_venues ORDER BY priority DESC, name LIMIT 30"),
    db.prepare("SELECT title, body, status, kind FROM hq_ideas WHERE status != 'converted' ORDER BY pinned DESC, updated_at DESC LIMIT 15"),
    db.prepare("SELECT event_id, kind, status, category, description, amount_pence, confidence FROM hq_ledger ORDER BY COALESCE(date, created_at) DESC LIMIT 60"),
    db.prepare("SELECT event_id, category, amount_pence, confidence FROM hq_budget ORDER BY event_id, sort"),
    db.prepare("SELECT title, channel, status, publish_date FROM hq_content WHERE status != 'published' ORDER BY COALESCE(publish_date, '9999') LIMIT 12"),
    db.prepare("SELECT title, status, start_date, end_date, goal FROM hq_campaigns WHERE status != 'done' LIMIT 8"),
    db.prepare("SELECT number, title, status, guest, release_date FROM hq_radio ORDER BY id DESC LIMIT 8"),
    db.prepare("SELECT name, role FROM hq_people LIMIT 20"),
  ])

  const out = [`Today is ${today} (Europe/London).`]
  const n = rows(notes)
  if (n.length) {
    out.push("## Brand & strategy notes (written by ROUGE)")
    let budgetChars = 9000
    for (const note of n) {
      const body = String(note.body || "").slice(0, Math.max(0, Math.min(3500, budgetChars)))
      budgetChars -= body.length
      out.push(`### ${note.title}\n${body}`)
      if (budgetChars <= 0) break
    }
  }

  const money = {}
  for (const l of rows(ledger)) {
    const m = (money[l.event_id ?? "brand"] ||= { inc: 0, exp: 0, planned: 0, unconfirmed: 0 })
    if (l.status === "actual" && l.kind === "income") m.inc += l.amount_pence
    if (l.status === "actual" && l.kind === "expense") m.exp += l.amount_pence
    if (l.status === "planned" && l.kind === "expense") m.planned += l.amount_pence
    if (l.confidence !== "verified") m.unconfirmed++
  }
  const budgets = {}
  for (const b of rows(budget)) (budgets[b.event_id] ||= []).push(b)

  out.push("## Events")
  for (const e of rows(events)) {
    const m = money[e.id]
    const b = budgets[e.id]
    const bits = [
      `**${e.name}**${e.number ? ` (#${e.number})` : ""} — ${e.status}`,
      e.date ? `date ${e.date}` : "date not set",
      e.venue_name ? `venue ${e.venue_name}` : "venue not set",
      e.capacity ? `capacity ${e.capacity}` : null,
      e.ticket_target ? `ticket target ${e.ticket_target}` : null,
      e.tickets_sold != null ? `tickets sold ${e.tickets_sold}` : null,
      e.attendance != null ? `attendance ${e.attendance}` : null,
      e.ticket_price ? `prices ${e.ticket_price}` : null,
      e.bar_minimum_pence != null ? `bar minimum ${pounds(e.bar_minimum_pence)}` : null,
      e.bar_takings_pence != null ? `venue bar takings ${pounds(e.bar_takings_pence)} (venue revenue, not ROUGE's)` : null,
      m ? `recorded income ${pounds(m.inc)}, costs ${pounds(m.exp)}${m.planned ? `, planned costs ${pounds(m.planned)}` : ""}${m.unconfirmed ? ` (${m.unconfirmed} entries still to confirm)` : ""}` : "no money recorded",
      b ? `budget ${pounds(b.reduce((s, x) => s + x.amount_pence, 0))} across ${b.length} lines (${b.filter((x) => x.confidence === "estimate").length} estimates)` : null,
    ].filter(Boolean)
    out.push("- " + bits.join("; "))
    if (e.tagline || e.summary) out.push(`  ${[e.tagline, e.summary].filter(Boolean).join(" ")}`.slice(0, 600))
  }

  const t = rows(tasks)
  if (t.length) {
    out.push(`## Open tasks (${t.length} shown)`)
    for (const x of t) out.push(`- ${x.title}${x.ev ? ` [${x.ev}]` : ""} — ${x.priority}${x.due ? `, due ${x.due}${x.due < today ? " (OVERDUE)" : ""}` : ", no date"}${x.owner ? `, owner ${x.owner}` : ""}${x.status === "doing" ? ", in progress" : ""}`)
  }

  const v = rows(venues)
  if (v.length) {
    out.push("## Venues (facts marked verified / estimate / to confirm)")
    for (const x of v) {
      let facts = {}
      try {
        facts = JSON.parse(x.facts || "{}") || {}
      } catch {}
      const f = (field, label, val) => (val === null || val === undefined || val === "" ? null : `${label} ${val}${facts[field] ? ` (${CONF[facts[field].c] || "to confirm"})` : ""}`)
      const bits = [
        `**${x.name}**${x.area ? `, ${x.area}` : ""} — ${x.status}${x.relationship ? ", existing relationship" : ""}${x.shortlist_event_id ? `, shortlisted for event id ${x.shortlist_event_id}` : ""}`,
        f("capacity", "capacity", x.capacity),
        f("rooftop", "rooftop/terrace", x.rooftop === 1 ? "yes" : x.rooftop === 0 ? "no" : null),
        f("sound_system", "sound", x.sound_system),
        f("cdjs", "CDJs", x.cdjs),
        f("mixer", "mixer", x.mixer),
        f("hire_fee_pence", "hire", x.hire_fee_pence != null ? pounds(x.hire_fee_pence) : null),
        x.hire_fee_note ? `hire note: ${x.hire_fee_note}` : null,
        f("bar_min_pence", "bar minimum", x.bar_min_pence != null ? pounds(x.bar_min_pence) : null),
        x.bar_min_note ? `bar note: ${x.bar_min_note}` : null,
        f("licence", "licence", x.licence),
        f("restrictions", "restrictions", x.restrictions),
        x.next_follow_up ? `next follow-up ${x.next_follow_up}` : null,
        x.negotiation_notes ? `notes: ${String(x.negotiation_notes).slice(0, 300)}` : null,
      ].filter(Boolean)
      out.push("- " + bits.join("; "))
    }
  }

  const i = rows(ideas)
  if (i.length) {
    out.push("## Ideas in the notebook")
    for (const x of i) out.push(`- ${x.title} (${x.kind}, ${x.status})${x.body ? `: ${String(x.body).slice(0, 200)}` : ""}`)
  }
  const c = rows(content)
  const cp = rows(campaigns)
  if (c.length || cp.length) {
    out.push("## Marketing")
    for (const x of cp) out.push(`- Campaign: ${x.title} (${x.status})${x.start_date ? ` from ${x.start_date}` : ""}${x.goal ? ` — ${x.goal}` : ""}`)
    for (const x of c) out.push(`- Content: ${x.title} (${x.channel || "channel tbc"}, ${x.status})${x.publish_date ? ` on ${x.publish_date}` : ""}`)
  }
  const r = rows(radio)
  if (r.length) {
    out.push("## ROUGE Radio")
    for (const x of r) out.push(`- ${x.title} (${x.status})${x.guest ? ` with ${x.guest}` : ""}${x.release_date ? `, release ${x.release_date}` : ""}`)
  }
  const p = rows(people)
  if (p.length) out.push("## Team\n" + p.map((x) => `- ${x.name}${x.role ? ` — ${x.role}` : ""}`).join("\n"))

  try {
    const s = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN date(created_at) > date(?1, '-30 days') THEN 1 ELSE 0 END) AS last30 FROM signups WHERE marketing_consent = 1").bind(today).first()
    if (s) out.push(`## Mailing list\n${s.total} consenting subscribers, ${s.last30 || 0} joined in the last 30 days.`)
  } catch {}

  if (focusEventId || focusVenueId) out.push(`## Focus\nThe user is looking at ${focusEventId ? `event id ${focusEventId}` : ""}${focusVenueId ? ` venue id ${focusVenueId}` : ""}.`)
  return out.join("\n").slice(0, 40000)
}

const CHAT_RULES = `You are ROUGE AI, the creative and operational partner inside ROUGE HQ — the private workspace of ROUGE, an intimate music gathering in London founded by DJ Dev.

How to work:
- Use the ROUGE data below for every fact about ROUGE: events, money, venues, tasks, audience. If something isn't in the data, say it isn't recorded yet rather than guessing.
- Never invent prices, quotes, venue technical specs, ticket numbers or financial figures. Label anything you estimate as an estimate and show the working.
- Venue facts marked "to confirm" are unverified; say so when they matter.
- Write in British English. Be concise and practical: Dev often reads on an iPhone. Lead with the answer, then the detail. Use short headings and lists when they help.
- When writing copy (captions, emails, announcements), match the ROUGE voice from the brand notes: short, confident, warm, never hype for its own sake.
- When asked to plan, give concrete next steps Dev can turn into tasks.`

function cleanChatMessages(raw) {
  if (!Array.isArray(raw)) return null
  const out = []
  for (const m of raw.slice(-MAX_TURNS)) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") continue
    const content = m.content.slice(0, MAX_TURN_CHARS).trim()
    if (!content) continue
    const last = out[out.length - 1]
    if (last && last.role === m.role) last.content += "\n\n" + content
    else out.push({ role: m.role, content })
  }
  while (out.length && out[0].role !== "user") out.shift()
  if (!out.length || out[out.length - 1].role !== "user") return null
  return out
}

async function callAnthropic(env, payload) {
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey(env), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!upstream.ok || !upstream.body) {
    let detail = ""
    try {
      const err = await upstream.json()
      detail = (err && err.error && err.error.message) || ""
    } catch {}
    console.error("Anthropic request failed:", upstream.status, detail)
    const code = upstream.status === 429 || upstream.status === 529 ? "rate_limited" : upstream.status === 401 ? "bad_key" : "upstream_error"
    const msg =
      code === "rate_limited"
        ? "Claude is busy right now. Try again in a minute."
        : code === "bad_key"
          ? "The ANTHROPIC_API_KEY in Cloudflare was rejected."
          : `Claude couldn't start${detail ? `: ${detail}` : "."}`
    return json({ error: msg, code }, 502)
  }
  return new Response(upstream.body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  })
}

export async function chat(db, env, body) {
  if (!apiKey(env)) return json({ error: "Add the ANTHROPIC_API_KEY secret in Cloudflare to use ROUGE AI.", code: "not_configured" }, 503)
  const messages = cleanChatMessages(body && body.messages)
  if (!messages) throw new InputError("Send a conversation that ends with your message.")
  const context = await buildContext(db, { focusEventId: Number(body.event_id) || null, focusVenueId: Number(body.venue_id) || null })
  const payload = {
    model: chatModel(env),
    max_tokens: 3000,
    system: [
      { type: "text", text: CHAT_RULES },
      { type: "text", text: "# ROUGE data (live from HQ)\n" + context, cache_control: { type: "ephemeral" } },
    ],
    messages,
    stream: true,
  }
  if (body.web) {
    payload.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4, user_location: LONDON }]
  }
  return callAnthropic(env, payload)
}

// ---------- deep research ----------

const RESEARCH_RULES = `You are ROUGE's research analyst. ROUGE is an intimate, independent music gathering in London (110–150 capacity rooms; R&B, soul, house and UK garage; audience in their 20s and 30s), run by its founder Dev alongside a full-time job.

Method:
- Research the question properly with web search. Use web fetch to read the most important primary sources in full (official venue sites, official pages, original reports) rather than relying on snippets.
- Prefer recent sources (2025–2026) and say when information may be out of date.
- Every specific claim about prices, capacities, equipment, licences, dates, statistics or policies must come from a source you found, with a citation. If sources disagree, say so and show both.
- Never invent quotes, prices, venue technical inventories or statistics. If you couldn't find something, say so plainly and add it to "Still to confirm".
- Keep any commentary before the final report to one short line at most.

Write the final report in Markdown, in British English, in this shape:
# <A clear title>
**Bottom line:** 2–4 sentences that answer the question.
## <Findings, in as many short sections as the question needs; use tables to compare options>
## What this means for ROUGE
Concrete, practical recommendations.
## Still to confirm
Bullets of facts that need a direct check (calls, emails, written quotes).`

export async function startResearch(db, body) {
  const question = String((body && body.question) || "").trim()
  if (question.length < 8) throw new InputError("Write a research question (a sentence or two).")
  if (question.length > 4000) throw new InputError("Keep the question under 4,000 characters.")
  const depth = DEPTHS[body.depth] ? body.depth : "standard"
  const eventId = body.event_id ? Number(body.event_id) : null
  const venueId = body.venue_id ? Number(body.venue_id) : null
  const item = await db
    .prepare("INSERT INTO hq_research (question, depth, status, event_id, venue_id) VALUES (?1, ?2, 'queued', ?3, ?4) RETURNING *")
    .bind(question, depth, Number.isInteger(eventId) ? eventId : null, Number.isInteger(venueId) ? venueId : null)
    .first()
  return json({ item }, 201)
}

async function researchBrief(db, job) {
  const parts = []
  const brand = await db.prepare("SELECT body FROM hq_notes WHERE kind = 'brand' ORDER BY pinned DESC, updated_at DESC LIMIT 1").first()
  if (brand && brand.body) parts.push("ROUGE brand summary:\n" + String(brand.body).slice(0, 1800))
  if (job.event_id) {
    const e = await db.prepare("SELECT * FROM hq_events WHERE id = ?1").bind(job.event_id).first()
    if (e) parts.push(`Related event: ${e.name} (${e.status})${e.date ? `, ${e.date}` : ", date not set"}${e.venue_name ? `, venue ${e.venue_name}` : ""}. ${e.tagline || ""} ${e.summary || ""}`.slice(0, 1200))
  }
  if (job.venue_id) {
    const v = await db.prepare("SELECT * FROM hq_venues WHERE id = ?1").bind(job.venue_id).first()
    if (v) {
      const known = ["address", "area", "website", "capacity", "sound_system", "cdjs", "mixer", "turntables", "hire_fee_note", "bar_min_note", "licence", "restrictions", "sources"]
        .filter((k) => v[k] !== null && v[k] !== "")
        .map((k) => `${k.replace(/_/g, " ")}: ${v[k]}`)
        .join("\n")
      parts.push(`Related venue: ${v.name}. What HQ currently holds (much of it unverified):\n${known}`.slice(0, 2500))
    }
  }
  return parts.join("\n\n")
}

export async function runResearch(db, env, id, body) {
  if (!apiKey(env)) return json({ error: "Add the ANTHROPIC_API_KEY secret in Cloudflare to use deep research.", code: "not_configured" }, 503)
  const job = await db.prepare("SELECT * FROM hq_research WHERE id = ?1").bind(Number(id)).first()
  if (!job) return json({ error: "Not found" }, 404)
  const d = DEPTHS[job.depth] || DEPTHS.standard
  const brief = await researchBrief(db, job)
  const userText = `${job.question}\n\n---\nContext from ROUGE HQ (for relevance; verify anything you rely on):\n${brief || "None."}\n\nToday is ${londonToday()}.`
  const messages = [{ role: "user", content: userText }]
  // Continuing after pause_turn: the browser sends back the assistant content it received, unchanged.
  if (body && Array.isArray(body.continuation) && body.continuation.length) {
    const size = JSON.stringify(body.continuation).length
    if (size > 6_000_000) throw new InputError("That research run is too large to continue.")
    messages.push({ role: "assistant", content: body.continuation })
  }
  await db.prepare("UPDATE hq_research SET status = 'running', updated_at = datetime('now') WHERE id = ?1").bind(job.id).run()
  return callAnthropic(env, {
    model: researchModel(env),
    max_tokens: d.max_tokens,
    system: RESEARCH_RULES,
    messages,
    tools: [
      { type: "web_search_20250305", name: "web_search", max_uses: d.searches, user_location: LONDON },
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: d.fetches, citations: { enabled: true }, max_content_tokens: 16000 },
    ],
    stream: true,
  })
}

function cleanSources(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, 200)
    .filter((s) => s && typeof s.url === "string" && /^https?:\/\//i.test(s.url))
    .map((s) => ({ url: s.url.slice(0, 2000), title: String(s.title || "").slice(0, 300), cited: !!s.cited, n: Number.isInteger(s.n) ? s.n : null }))
}

export async function finishResearch(db, id, body) {
  const job = await db.prepare("SELECT * FROM hq_research WHERE id = ?1").bind(Number(id)).first()
  if (!job) return json({ error: "Not found" }, 404)
  const ok = body && body.status === "done"
  const report = String((body && body.report) || "").slice(0, 200000)
  const sources = cleanSources(body && body.sources)
  const queries = Array.isArray(body && body.queries) ? body.queries.slice(0, 100).map((q) => String(q).slice(0, 300)) : []
  let noteId = job.note_id
  if (ok && report.trim()) {
    const title = (report.match(/^#\s+(.+)$/m) || [])[1] || job.question.slice(0, 90)
    const body2 = `${report.trim()}\n\n---\n*Deep research · ${DEPTHS[job.depth] ? DEPTHS[job.depth].label : job.depth} · ${londonToday()} · ${queries.length} searches*\n\n**Question:** ${job.question}`
    if (noteId) {
      await db.prepare("UPDATE hq_notes SET title = ?1, body = ?2, sources = ?3, updated_at = datetime('now') WHERE id = ?4").bind(title.slice(0, 300), body2, JSON.stringify(sources), noteId).run()
    } else {
      const note = await db
        .prepare("INSERT INTO hq_notes (title, body, kind, tags, event_id, venue_id, sources) VALUES (?1, ?2, 'research', 'deep research', ?3, ?4, ?5) RETURNING id")
        .bind(title.slice(0, 300), body2, job.event_id, job.venue_id, JSON.stringify(sources))
        .first()
      noteId = note.id
    }
    await db
      .prepare("INSERT INTO hq_activity (kind, entity, entity_id, event_id, summary) VALUES ('create', 'research', ?1, ?2, ?3)")
      .bind(job.id, job.event_id, `Deep research finished: “${title.slice(0, 120)}”`)
      .run()
  }
  const item = await db
    .prepare("UPDATE hq_research SET status = ?1, report = ?2, sources = ?3, queries = ?4, searches = ?5, note_id = ?6, error = ?7, finished_at = datetime('now'), updated_at = datetime('now') WHERE id = ?8 RETURNING *")
    .bind(ok ? "done" : "failed", report || null, JSON.stringify(sources), JSON.stringify(queries), queries.length, noteId, ok ? null : String((body && body.error) || "Stopped").slice(0, 400), job.id)
    .first()
  return json({ item })
}

export { addDays }
