// ROUGE HQ: Members (Audience → Members) and ROUGE Radio applications (Radio → Applications).
// Called only from the admin API, which sits behind the admin sign-in.
// Exports no request handlers, so Pages does not turn this into a route.

import { json, setting, sendWithResend } from "../rouge.js"
import { ensureCommunity, getSetting, setSetting } from "../community/schema.js"
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS, renderEmail, loadTemplate, fill } from "../community/templates.js"
import { eraseMember, runRetention, prefsUrl, MUSIC, TOPICS, RADIO_GENRES, PERFORMANCE, CAN_RECORD, ACKS } from "../community/core.js"
import { InputError } from "./registry.js"
import { londonToday } from "./api.js"

const rows = (r) => (r && r.results) || []
const STATUS_SQL = `CASE WHEN EXISTS (SELECT 1 FROM unsubscribes x WHERE x.email = s.email) THEN 'unsubscribed'
  WHEN s.marketing_consent = 1 THEN 'subscribed' WHEN p.signup_id IS NOT NULL AND p.verified_at IS NULL THEN 'pending' ELSE 'member' END`
export const APP_STATUSES = ["new", "reviewing", "shortlisted", "contacted", "accepted", "declined", "withdrawn", "archived"]
const DECIDED = new Set(["accepted", "declined", "withdrawn", "archived"])

function csv(rowsOut, filename) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v)
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s // stop spreadsheet formula injection
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const body = rowsOut.map((r) => r.map(esc).join(",")).join("\r\n")
  return new Response("﻿" + body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } })
}

// ---------- members ----------

function memberWhere(url) {
  const where = []
  const args = []
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  if (q) {
    args.push(`%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`)
    where.push(`(s.email LIKE ?${args.length} ESCAPE '\\' OR s.first_name LIKE ?${args.length} ESCAPE '\\' OR p.instagram LIKE ?${args.length} ESCAPE '\\' OR p.location LIKE ?${args.length} ESCAPE '\\')`)
  }
  const interest = url.searchParams.get("interest")
  if (interest && MUSIC[interest]) where.push(`p.interests LIKE '%"${interest}"%'`)
  const topic = url.searchParams.get("topic")
  if (topic && TOPICS[topic]) where.push(`p.topics LIKE '%"${topic}"%'`)
  const status = url.searchParams.get("status")
  if (["subscribed", "pending", "member", "unsubscribed"].includes(status)) {
    args.push(status)
    where.push(`(${STATUS_SQL}) = ?${args.length}`)
  }
  const source = url.searchParams.get("source")
  if (source) {
    args.push(source.slice(0, 120))
    where.push(`COALESCE(NULLIF(s.source, ''), 'unknown') = ?${args.length}`)
  }
  return { sql: where.length ? "WHERE " + where.join(" AND ") : "", args }
}

const MEMBER_COLS = `s.id, s.email, s.first_name, s.source, s.created_at, s.marketing_consent, p.member_uid, p.instagram, p.location, p.interests, p.topics, p.verified_at, (${STATUS_SQL}) AS status`

export async function listMembers(db, url) {
  const { sql, args } = memberWhere(url)
  const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 1000)
  const [items, totals, interests, topics, sources, weekly, count] = await db.batch([
    db.prepare(`SELECT ${MEMBER_COLS} FROM signups s LEFT JOIN member_profiles p ON p.signup_id = s.id ${sql} ORDER BY s.id DESC LIMIT ${limit}`).bind(...args),
    db.prepare(`SELECT (${STATUS_SQL}) AS status, COUNT(*) AS n FROM signups s LEFT JOIN member_profiles p ON p.signup_id = s.id GROUP BY 1`),
    db.prepare("SELECT j.value AS k, COUNT(*) AS n FROM member_profiles p, json_each(p.interests) j GROUP BY 1 ORDER BY n DESC"),
    db.prepare("SELECT j.value AS k, COUNT(*) AS n FROM member_profiles p, json_each(p.topics) j GROUP BY 1 ORDER BY n DESC"),
    db.prepare("SELECT COALESCE(NULLIF(source, ''), 'unknown') AS source, COUNT(*) AS n FROM signups GROUP BY 1 ORDER BY n DESC LIMIT 12"),
    db.prepare("SELECT strftime('%Y-%W', created_at) AS week, MIN(date(created_at)) AS start, COUNT(*) AS n FROM signups WHERE date(created_at) > date('now', '-84 days') GROUP BY week ORDER BY week"),
    db.prepare(`SELECT COUNT(*) AS n FROM signups s LEFT JOIN member_profiles p ON p.signup_id = s.id ${sql}`).bind(...args),
  ])
  const t = Object.fromEntries(rows(totals).map((r) => [r.status, r.n]))
  const recent = await db.prepare("SELECT SUM(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) AS d7, SUM(CASE WHEN created_at > datetime('now', '-30 days') THEN 1 ELSE 0 END) AS d30 FROM signups").first()
  return json({
    summary: { total: Object.values(t).reduce((a, b) => a + b, 0), subscribed: t.subscribed || 0, pending: t.pending || 0, member: t.member || 0, unsubscribed: t.unsubscribed || 0, last7: (recent && recent.d7) || 0, last30: (recent && recent.d30) || 0 },
    items: rows(items),
    matched: rows(count)[0] ? rows(count)[0].n : 0,
    interests: rows(interests),
    topics: rows(topics),
    sources: rows(sources),
    weekly: rows(weekly),
    labels: { music: MUSIC, topics: TOPICS },
  })
}

export async function getMember(db, env, id) {
  const m = await db.prepare(`SELECT ${MEMBER_COLS}, p.privacy_accepted_at, p.welcomed_at, p.pending FROM signups s LEFT JOIN member_profiles p ON p.signup_id = s.id WHERE s.id = ?1`).bind(Number(id)).first()
  if (!m) return json({ error: "Not found" }, 404)
  const events = rows(await db.prepare("SELECT kind, source, wording, created_at FROM consent_events WHERE signup_id = ?1 ORDER BY id DESC").bind(m.id).all())
  let deliveries = []
  try {
    deliveries = rows(await db.prepare("SELECT c.name, d.status, d.accepted_at, d.delivered_at FROM deliveries d JOIN campaigns c ON c.id = d.campaign_id WHERE d.signup_id = ?1 ORDER BY d.id DESC").bind(m.id).all())
  } catch {}
  const apps = rows(await db.prepare("SELECT id, ref, artist_name, status, created_at FROM radio_applications WHERE email = ?1").bind(m.email).all())
  return json({ member: { ...m, pending: m.pending ? true : false }, events, deliveries, applications: apps, prefs_url: await prefsUrl(env, m.id) })
}

export async function exportMembers(db, url) {
  const { sql, args } = memberWhere(url)
  const items = rows(await db.prepare(`SELECT ${MEMBER_COLS} FROM signups s LEFT JOIN member_profiles p ON p.signup_id = s.id ${sql} ORDER BY s.id`).bind(...args).all())
  const out = [["member_id", "first_name", "email", "instagram", "location", "music", "hear_about", "status", "email_confirmed", "joined", "source"]]
  for (const m of items) {
    out.push([m.member_uid || `S${m.id}`, m.first_name, m.email, m.instagram, m.location, JSON.parse(m.interests || "[]").map((k) => MUSIC[k] || k).join("; "), JSON.parse(m.topics || "[]").map((k) => TOPICS[k] || k).join("; "), m.status, m.verified_at || "", m.created_at, m.source])
  }
  return csv(out, `rouge-members-${londonToday()}.csv`)
}

export async function adminUnsubscribe(db, id) {
  const s = await db.prepare("SELECT * FROM signups WHERE id = ?1").bind(Number(id)).first()
  if (!s) return json({ error: "Not found" }, 404)
  await db.batch([
    db.prepare("UPDATE signups SET marketing_consent = 0 WHERE id = ?1").bind(s.id),
    db.prepare("INSERT OR IGNORE INTO unsubscribes (email, method) VALUES (?1, 'admin')").bind(s.email),
    db.prepare("INSERT INTO consent_events (signup_id, kind, source) VALUES (?1, 'marketing_opt_out', 'Removed from emails by admin')").bind(s.id),
  ])
  return json({ ok: true })
}

export async function adminErase(db, id) {
  const ok = await eraseMember(db, Number(id))
  if (ok) await db.prepare("INSERT INTO hq_activity (kind, entity, summary) VALUES ('delete', 'members', 'Deleted a member record (erasure)')").run()
  return json({ ok })
}

// ---------- Radio applications ----------

function appWhere(url) {
  const where = []
  const args = []
  const status = url.searchParams.get("status")
  if (status === "open") where.push("a.status NOT IN ('declined', 'withdrawn', 'archived')")
  else if (APP_STATUSES.includes(status)) {
    args.push(status)
    where.push(`a.status = ?${args.length}`)
  }
  const genre = url.searchParams.get("genre")
  if (genre && RADIO_GENRES[genre]) where.push(`a.genres LIKE '%"${genre}"%'`)
  const tag = (url.searchParams.get("tag") || "").trim().slice(0, 40)
  if (tag) {
    args.push(`%${JSON.stringify(tag).replace(/[\\%_]/g, (c) => "\\" + c)}%`)
    where.push(`a.tags LIKE ?${args.length} ESCAPE '\\'`)
  }
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  if (q) {
    args.push(`%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`)
    where.push(`(a.artist_name LIKE ?${args.length} ESCAPE '\\' OR a.location LIKE ?${args.length} ESCAPE '\\' OR a.full_name LIKE ?${args.length} ESCAPE '\\' OR a.session_concept LIKE ?${args.length} ESCAPE '\\' OR a.ref LIKE ?${args.length} ESCAPE '\\')`)
  }
  return { sql: where.length ? "WHERE " + where.join(" AND ") : "", args }
}

const LIST_COLS = "a.id, a.ref, a.artist_name, a.location, a.genres, a.profile_url, a.mix_url, a.status, a.tags, a.created_at, a.rating_selection, a.rating_originality, a.rating_fit, a.rating_overall, a.radio_episode_id, a.session_title, (SELECT COUNT(*) FROM radio_application_events e WHERE e.application_id = a.id AND e.kind = 'note') AS notes"

export async function listApplications(db, url) {
  const { sql, args } = appWhere(url)
  const [items, counts, tags] = await db.batch([
    db.prepare(`SELECT ${LIST_COLS} FROM radio_applications a ${sql} ORDER BY CASE a.status WHEN 'new' THEN 0 ELSE 1 END, a.id DESC LIMIT 500`).bind(...args),
    db.prepare("SELECT status, COUNT(*) AS n FROM radio_applications GROUP BY status"),
    db.prepare("SELECT j.value AS tag, COUNT(*) AS n FROM radio_applications a, json_each(a.tags) j GROUP BY 1 ORDER BY n DESC LIMIT 40"),
  ])
  return json({ items: rows(items), counts: Object.fromEntries(rows(counts).map((r) => [r.status, r.n])), tags: rows(tags), labels: { genres: RADIO_GENRES, performance: PERFORMANCE, can_record: CAN_RECORD, acks: ACKS }, statuses: APP_STATUSES })
}

export async function getApplication(db, id) {
  const a = await db.prepare("SELECT * FROM radio_applications WHERE id = ?1").bind(Number(id)).first()
  if (!a) return json({ error: "Not found" }, 404)
  const [events, others, episode] = await db.batch([
    db.prepare("SELECT * FROM radio_application_events WHERE application_id = ?1 ORDER BY id DESC").bind(a.id),
    db.prepare("SELECT id, ref, status, created_at, mix_url FROM radio_applications WHERE email = ?1 AND id != ?2 ORDER BY id DESC").bind(a.email, a.id),
    db.prepare("SELECT id, number, title, status FROM hq_radio WHERE id = ?1").bind(a.radio_episode_id || 0),
  ])
  const { ip_hash, submission_key, ...safe } = a
  return json({ application: safe, events: rows(events), history: rows(others), episode: rows(episode)[0] || null, labels: { genres: RADIO_GENRES, performance: PERFORMANCE, can_record: CAN_RECORD, acks: ACKS }, statuses: APP_STATUSES })
}

export async function updateApplication(db, id, body) {
  const a = await db.prepare("SELECT * FROM radio_applications WHERE id = ?1").bind(Number(id)).first()
  if (!a) return json({ error: "Not found" }, 404)
  const sets = []
  const args = []
  const add = (col, v) => {
    args.push(v)
    sets.push(`${col} = ?${args.length}`)
  }
  if (body.status !== undefined) {
    if (!APP_STATUSES.includes(body.status)) throw new InputError("Unknown status.")
    if (body.status !== a.status) {
      add("status", body.status)
      if (DECIDED.has(body.status)) sets.push("decided_at = datetime('now')")
    }
  }
  if (body.tags !== undefined) {
    const tags = (Array.isArray(body.tags) ? body.tags : []).map((t) => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean)
    add("tags", JSON.stringify([...new Set(tags)].slice(0, 12)))
  }
  for (const k of ["rating_selection", "rating_originality", "rating_fit", "rating_overall"]) {
    if (body[k] === undefined) continue
    const v = body[k] === null ? null : Number(body[k])
    if (v !== null && (!Number.isInteger(v) || v < 1 || v > 5)) throw new InputError("Ratings are 1 to 5.")
    add(k, v)
  }
  if (!sets.length) return getApplication(db, a.id)
  args.push(a.id)
  await db.prepare(`UPDATE radio_applications SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?${args.length}`).bind(...args).run()
  if (body.status !== undefined && body.status !== a.status) {
    await db.prepare("INSERT INTO radio_application_events (application_id, kind, from_status, to_status) VALUES (?1, 'status', ?2, ?3)").bind(a.id, a.status, body.status).run()
    await db.prepare("INSERT INTO hq_activity (kind, entity, entity_id, summary) VALUES ('update', 'radio_applications', ?1, ?2)").bind(a.id, `Radio application from ${a.artist_name} → ${body.status}`).run()
  }
  return getApplication(db, a.id)
}

export async function addNote(db, id, body) {
  const text = String((body && body.body) || "").trim().slice(0, 4000)
  if (!text) throw new InputError("Write a note first.")
  const a = await db.prepare("SELECT id FROM radio_applications WHERE id = ?1").bind(Number(id)).first()
  if (!a) return json({ error: "Not found" }, 404)
  await db.prepare("INSERT INTO radio_application_events (application_id, kind, body) VALUES (?1, 'note', ?2)").bind(a.id, text).run()
  return getApplication(db, a.id)
}

const REPLY_STATUS = { radio_more_info: "contacted", radio_shortlisted: "shortlisted", radio_accepted: "accepted", radio_declined: "declined" }

export async function draftReply(db, id, body) {
  const a = await db.prepare("SELECT * FROM radio_applications WHERE id = ?1").bind(Number(id)).first()
  if (!a) return json({ error: "Not found" }, 404)
  const key = String((body && body.template) || "")
  if (!REPLY_STATUS[key]) throw new InputError("Pick a reply template.")
  const t = await loadTemplate(db, key)
  const vars = { artist_name: a.artist_name, ref: a.ref }
  return json({ subject: fill(t.subject, vars), heading: fill(t.heading, vars), body: fill(t.body, vars), suggested_status: REPLY_STATUS[key] })
}

export async function sendReply(db, env, id, body) {
  if (!String(env.RESEND_API_KEY || "").trim()) return json({ error: "Email sending isn't configured (RESEND_API_KEY)." }, 503)
  const a = await db.prepare("SELECT * FROM radio_applications WHERE id = ?1").bind(Number(id)).first()
  if (!a) return json({ error: "Not found" }, 404)
  if (!a.contact_ok) throw new InputError("This applicant hasn't agreed to be contacted.")
  const subject = String(body.subject || "").trim().slice(0, 200)
  const text = String(body.body || "").trim().slice(0, 8000)
  if (!subject || !text) throw new InputError("Add a subject and a message.")
  if (/\[[^\]\n]{2,60}\]/.test(subject + text)) throw new InputError("Fill in the [bracketed] gaps before sending.")
  const mail = renderEmail({ subject, heading: String(body.heading || "").slice(0, 120), body: text }, {}, { label: "ROUGE RADIO", footer: ["You're receiving this about your ROUGE Radio application. Reply to this email to get in touch."] })
  const sent = await sendWithResend(env, { to: a.email, ...mail, from: setting(env, "RADIO_FROM"), replyTo: setting(env, "RADIO_REPLY_TO"), tags: [{ name: "kind", value: "radio_reply" }] })
  if (!sent.ok) return json({ error: `Not sent: ${sent.error}` }, 502)
  await db.prepare("INSERT INTO radio_application_events (application_id, kind, subject, body) VALUES (?1, 'email', ?2, ?3)").bind(a.id, subject, text).run()
  if (body.set_status && APP_STATUSES.includes(body.set_status) && body.set_status !== a.status) return updateApplication(db, a.id, { status: body.set_status })
  return getApplication(db, a.id)
}

// Accepted DJ → draft ROUGE Radio episode, guest profile and production tasks. Nothing is published.
export async function createEpisode(db, id) {
  const a = await db.prepare("SELECT * FROM radio_applications WHERE id = ?1").bind(Number(id)).first()
  if (!a) return json({ error: "Not found" }, 404)
  if (a.radio_episode_id) {
    const ep = await db.prepare("SELECT id FROM hq_radio WHERE id = ?1").bind(a.radio_episode_id).first()
    if (ep) throw new InputError("This application already has a draft episode.")
  }
  const next = await db.prepare("SELECT printf('%03d', COALESCE(MAX(CAST(number AS INTEGER)), 0) + 1) AS n FROM hq_radio WHERE number GLOB '[0-9]*'").first()
  const genres = JSON.parse(a.genres || "[]").map((g) => RADIO_GENRES[g] || g).join(", ")
  const notes = [
    `Guest selector: ${a.artist_name}${a.pronouns ? ` (${a.pronouns})` : ""} — ${a.location}. Application ${a.ref}.`,
    `Proposed concept: ${a.session_concept}`,
    a.session_different ? `What makes it different: ${a.session_different}` : null,
    `Sound: ${genres}${a.performance ? ` · ${PERFORMANCE[a.performance]}` : ""}${a.mix_length ? ` · ${a.mix_length}` : ""}`,
    a.can_record ? `Can record a clean set: ${CAN_RECORD[a.can_record]}` : null,
    a.technical_notes ? `Technical notes: ${a.technical_notes}` : null,
    `Reference mix: ${a.mix_url}`,
    "Status: draft. Not announced. Agree recording, promotion and distribution permissions, and check music licensing, before any release.",
    "Final audio: (add the link when received)",
    "Artwork: (to do)",
  ].filter(Boolean).join("\n")
  const ep = await db
    .prepare("INSERT INTO hq_radio (number, title, guest, status, platform, notes) VALUES (?1, ?2, ?3, 'booked', 'Mixcloud', ?4) RETURNING id, number, title")
    .bind(next ? next.n : null, a.session_title || `ROUGE Radio — ${a.artist_name}`, a.artist_name, notes)
    .first()
  let person = a.person_id ? await db.prepare("SELECT id FROM hq_people WHERE id = ?1").bind(a.person_id).first() : null
  if (!person) {
    person = await db
      .prepare("INSERT INTO hq_people (name, role, email, instagram, areas, notes) VALUES (?1, 'ROUGE Radio guest selector', ?2, ?3, 'radio', ?4) RETURNING id")
      .bind(a.artist_name, a.email, /instagram\.com\//.test(a.profile_url) ? "@" + a.profile_url.split("instagram.com/")[1].replace(/\/.*$/, "") : null, `From Radio application ${a.ref}. ${a.location}.`)
      .first()
  }
  const tasks = [
    [`Agree session details with ${a.artist_name}`, "high", "Concept, length, recording date, how the set is captured."],
    [`Agree permissions with ${a.artist_name}`, "high", "Recording, promotion and distribution, in writing."],
    [`Music licensing check: ${ep.title}`, "high", "Review licensing and platform rules before any public release."],
    [`Artwork: ${ep.title}`, "normal", null],
    [`Receive final audio from ${a.artist_name}`, "normal", "Add the link to the episode when it arrives."],
  ]
  await db.batch(tasks.map(([title, priority, note], i) => db.prepare("INSERT INTO hq_tasks (title, section, priority, notes, owner, sort) VALUES (?1, 'Radio', ?2, ?3, 'Dev', ?4)").bind(title, priority, note, i)))
  await db.batch([
    db.prepare("UPDATE radio_applications SET radio_episode_id = ?1, person_id = ?2, updated_at = datetime('now') WHERE id = ?3").bind(ep.id, person.id, a.id),
    db.prepare("INSERT INTO radio_application_events (application_id, kind, body) VALUES (?1, 'system', ?2)").bind(a.id, `Draft episode ${ep.number ? ep.number + " " : ""}“${ep.title}” created with ${tasks.length} production tasks. Not published.`),
    db.prepare("INSERT INTO hq_activity (kind, entity, entity_id, summary) VALUES ('create', 'radio', ?1, ?2)").bind(ep.id, `Draft Radio episode for ${a.artist_name} created from their application`),
  ])
  return json({ episode: ep, person_id: person.id }, 201)
}

export async function exportApplications(db, url) {
  const { sql, args } = appWhere(url)
  const items = rows(await db.prepare(`SELECT a.* FROM radio_applications a ${sql} ORDER BY a.id`).bind(...args).all())
  const out = [["ref", "submitted", "status", "artist_name", "full_name", "pronouns", "email", "location", "profile", "website", "genres", "mix_1", "mix_2", "session_title", "session_concept", "mix_length", "performance", "can_record", "tags", "rating_selection", "rating_originality", "rating_fit", "rating_overall"]]
  for (const a of items) {
    out.push([a.ref, a.created_at, a.status, a.artist_name, a.full_name, a.pronouns, a.email, a.location, a.profile_url, a.website, JSON.parse(a.genres || "[]").map((g) => RADIO_GENRES[g] || g).join("; "), a.mix_url, a.mix_url_2, a.session_title, a.session_concept, a.mix_length, a.performance, a.can_record, JSON.parse(a.tags || "[]").join("; "), a.rating_selection, a.rating_originality, a.rating_fit, a.rating_overall])
  }
  return csv(out, `rouge-radio-applications-${londonToday()}.csv`)
}

// ---------- templates & settings ----------

export async function listTemplates(db) {
  const items = rows(await db.prepare("SELECT * FROM email_templates").all())
  const order = Object.fromEntries(TEMPLATE_KEYS.map((k, i) => [k, i]))
  items.sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99))
  return json({ items, settings: { notify_applications: await getSetting(db, "notify_applications", "on"), member_digest: await getSetting(db, "member_digest", "weekly"), retention_last_run: await getSetting(db, "retention_last_run", null) } })
}

export async function saveTemplate(db, key, body) {
  if (!TEMPLATE_KEYS.includes(key)) return json({ error: "Not found" }, 404)
  const subject = String(body.subject || "").trim().slice(0, 200)
  const text = String(body.body || "").trim().slice(0, 8000)
  if (!subject || !text) throw new InputError("Subject and message can't be empty.")
  await db
    .prepare("UPDATE email_templates SET subject = ?1, heading = ?2, body = ?3, cta_label = ?4, updated_at = datetime('now') WHERE key = ?5")
    .bind(subject, String(body.heading || "").trim().slice(0, 120) || null, text, String(body.cta_label || "").trim().slice(0, 60) || null, key)
    .run()
  return listTemplates(db)
}

export async function resetTemplate(db, key) {
  const d = DEFAULT_TEMPLATES.find((t) => t.key === key)
  if (!d) return json({ error: "Not found" }, 404)
  await db.prepare("UPDATE email_templates SET subject = ?1, heading = ?2, body = ?3, cta_label = ?4, updated_at = datetime('now') WHERE key = ?5").bind(d.subject, d.heading || null, d.body, d.cta_label || null, key).run()
  return listTemplates(db)
}

const SAMPLE = { first_name: "Ama", artist_name: "Selector Sam", ref: "RR-7K3Q2P" }
export function previewTemplate(body) {
  const label = String(body.key || "").startsWith("radio") ? "ROUGE RADIO" : "LONDON"
  const ctaUrl = body.cta_label ? "https://www.rouge-london.com/" : null
  const mail = renderEmail({ subject: body.subject, heading: body.heading, body: body.body, cta_label: body.cta_label }, SAMPLE, { ctaUrl, label, footer: ["Preview with sample details. Links and unsubscribe options are added when it's sent."] })
  return json({ html: mail.html, subject: mail.subject })
}

export async function saveSettings(db, body) {
  if (body.notify_applications !== undefined) await setSetting(db, "notify_applications", body.notify_applications === "on" ? "on" : "off")
  if (body.member_digest !== undefined) await setSetting(db, "member_digest", ["off", "daily", "weekly"].includes(body.member_digest) ? body.member_digest : "off")
  return listTemplates(db)
}

export async function retentionNow(db) {
  return json({ result: await runRetention(db) })
}

// Once a day, opportunistically, when HQ is used.
export async function retentionTick(db) {
  const last = await getSetting(db, "retention_last_run", null)
  if (last && Date.now() - Date.parse(last) < 86400000) return
  try {
    await runRetention(db)
  } catch (err) {
    console.error("retention failed:", err && err.message)
  }
}

export { ensureCommunity }
