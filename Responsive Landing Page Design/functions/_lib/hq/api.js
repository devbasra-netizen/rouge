// ROUGE HQ API handlers. Called from functions/admin/api/hq/[[path]].js, which sits behind the admin
// middleware, so every handler here already has a signed-in admin.
// Exports no request handlers, so Pages does not turn this into a route.

import { json, setting, baseUrl } from "../rouge.js"
import { TYPES, LIST_OMIT, cleanRecord, InputError } from "./registry.js"
import { PHASES, RUN_TEMPLATE, ROLES } from "./templates.js"
import { SCHEMA_VERSION } from "./schema.js"

const LOGGED = new Set(["events", "tasks", "venues", "venue_log", "ideas", "notes", "ledger", "campaigns", "content", "radio", "docs", "people", "budget"])

// ---------- dates ----------

export function londonToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

export function addDays(iso, days) {
  const d = new Date(iso + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------- small helpers ----------

const rows = (r) => (r && r.results) || []
const one = (r) => rows(r)[0] || null

function idParam(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new InputError("Bad id.")
  return n
}

function likeTerm(q) {
  return "%" + String(q).replace(/[\\%_]/g, (c) => "\\" + c) + "%"
}

async function logActivity(db, kind, entity, entityId, summary, eventId = null) {
  try {
    await db
      .prepare("INSERT INTO hq_activity (kind, entity, entity_id, event_id, summary) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(kind, entity, entityId, eventId, String(summary).slice(0, 300))
      .run()
  } catch (err) {
    console.error("activity log failed:", err && err.message)
  }
}

async function tableExists(db, name) {
  const r = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1").bind(name).first()
  return !!r
}

function friendlyDbError(err) {
  const msg = String((err && err.message) || "")
  if (/FOREIGN KEY/i.test(msg)) return new InputError("That links to a record that doesn't exist any more.")
  if (/UNIQUE/i.test(msg)) return new InputError("That already exists.")
  return err
}

// ---------- generic records ----------

export async function listRecords(db, type, url) {
  const def = TYPES[type]
  if (!def) return json({ error: "Not found" }, 404)
  const where = []
  const args = []
  for (const f of def.filters) {
    if (!url.searchParams.has(f)) continue
    const v = url.searchParams.get(f)
    if (v === "null") where.push(`${f} IS NULL`)
    else {
      args.push(v)
      where.push(`${f} = ?${args.length}`)
    }
  }
  const q = (url.searchParams.get("q") || "").trim()
  if (q) {
    args.push(likeTerm(q.slice(0, 100)))
    where.push("(" + def.search.map((c) => `${c} LIKE ?${args.length} ESCAPE '\\'`).join(" OR ") + ")")
  }
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 500, 1), 1000)
  const omit = LIST_OMIT[type] || []
  const cols = omit.length ? ["id", "created_at", "updated_at", ...Object.keys(def.fields).filter((c) => !omit.includes(c))].join(", ") : "*"
  const sql = `SELECT ${cols} FROM ${def.table}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY ${def.order} LIMIT ${limit}`
  const r = await db.prepare(sql).bind(...args).all()
  return json({ items: rows(r) })
}

export async function getRecord(db, type, id) {
  const def = TYPES[type]
  if (!def) return json({ error: "Not found" }, 404)
  const item = await db.prepare(`SELECT * FROM ${def.table} WHERE id = ?1`).bind(idParam(id)).first()
  if (!item) return json({ error: "Not found" }, 404)
  return json({ item })
}

export async function createRecord(db, type, body, opts = {}) {
  const def = TYPES[type]
  if (!def) return json({ error: "Not found" }, 404)
  const item = await insertRecord(db, type, body, opts)
  return json({ item }, 201)
}

export async function insertRecord(db, type, body, { internal = false, quiet = false } = {}) {
  const def = TYPES[type]
  const { columns, values } = cleanRecord(type, body, { creating: true, internal })
  if (type === "tasks" && values[columns.indexOf("status")] === "done") {
    columns.push("done_at")
    values.push(new Date().toISOString())
  }
  const sql = `INSERT INTO ${def.table} (${columns.join(", ")}) VALUES (${columns.map((_, i) => `?${i + 1}`).join(", ")}) RETURNING *`
  let item
  try {
    item = await db.prepare(sql).bind(...values).first()
  } catch (err) {
    throw friendlyDbError(err)
  }
  if (!quiet && LOGGED.has(type) && !(type === "tasks" && item.parent_id)) {
    await logActivity(db, "create", type, item.id, `Added ${def.label} “${item[def.title]}”`, eventIdOf(type, item))
  }
  return item
}

function eventIdOf(type, item) {
  if (type === "events") return item.id
  return item.event_id ?? null
}

export async function updateRecord(db, type, id, body) {
  const def = TYPES[type]
  if (!def) return json({ error: "Not found" }, 404)
  id = idParam(id)
  const before = await db.prepare(`SELECT * FROM ${def.table} WHERE id = ?1`).bind(id).first()
  if (!before) return json({ error: "Not found" }, 404)
  const { columns, values } = cleanRecord(type, body, { creating: false })
  if (!columns.length) return json({ item: before })
  const sets = columns.map((c, i) => `${c} = ?${i + 1}`)
  if (type === "tasks" && columns.includes("status")) {
    const status = values[columns.indexOf("status")]
    if (status === "done" && before.status !== "done") sets.push("done_at = datetime('now')")
    if (status !== "done") sets.push("done_at = NULL")
  }
  sets.push("updated_at = datetime('now')")
  values.push(id)
  let item
  try {
    item = await db.prepare(`UPDATE ${def.table} SET ${sets.join(", ")} WHERE id = ?${values.length} RETURNING *`).bind(...values).first()
  } catch (err) {
    throw friendlyDbError(err)
  }
  if (LOGGED.has(type) && columns.includes("status") && before.status !== item.status && !(type === "tasks" && item.parent_id)) {
    const verb = type === "tasks" && item.status === "done" ? `Completed ${def.label}` : `Moved ${def.label}`
    const tail = type === "tasks" && item.status === "done" ? "" : ` to ${String(item.status).replace(/_/g, " ")}`
    await logActivity(db, "update", type, id, `${verb} “${item[def.title]}”${tail}`, eventIdOf(type, item))
  }
  return json({ item })
}

export async function deleteRecord(db, env, type, id) {
  const def = TYPES[type]
  if (!def) return json({ error: "Not found" }, 404)
  id = idParam(id)
  const before = await db.prepare(`SELECT * FROM ${def.table} WHERE id = ?1`).bind(id).first()
  if (!before) return json({ ok: true })
  const extra = []
  if (type === "venues") extra.push(db.prepare("UPDATE hq_events SET venue_id = NULL WHERE venue_id = ?1").bind(id))
  if (type === "docs") extra.push(db.prepare("UPDATE hq_ledger SET doc_id = NULL WHERE doc_id = ?1").bind(id))
  if (type === "people") extra.push(db.prepare("UPDATE hq_tasks SET person_id = NULL WHERE person_id = ?1").bind(id))
  await db.batch([...extra, db.prepare(`DELETE FROM ${def.table} WHERE id = ?1`).bind(id)])
  if (type === "docs" && before.r2_key && env.HQ_FILES) {
    try {
      await env.HQ_FILES.delete(before.r2_key)
    } catch (err) {
      console.error("R2 delete failed:", err && err.message)
    }
  }
  if (LOGGED.has(type) && !(type === "tasks" && before.parent_id)) {
    await logActivity(db, "delete", type, id, `Deleted ${def.label} “${before[def.title]}”`, eventIdOf(type, before))
  }
  return json({ ok: true })
}

// ---------- boot & settings ----------

export async function boot(db, env, admin) {
  const counts = {}
  const names = Object.keys(TYPES)
  const res = await db.batch(names.map((t) => db.prepare(`SELECT COUNT(*) AS n FROM ${TYPES[t].table}`)))
  names.forEach((t, i) => (counts[t] = one(res[i]) ? one(res[i]).n : 0))
  const [events, people, templates] = await db.batch([
    db.prepare(`SELECT id, number, name, status, date, venue_id, venue_name, cover FROM hq_events ORDER BY ${TYPES.events.order}`),
    db.prepare("SELECT id, name, role FROM hq_people ORDER BY name COLLATE NOCASE"),
    db.prepare("SELECT id, name, notes FROM hq_templates ORDER BY id"),
  ])
  return json({
    me: { email: admin && admin.email, method: admin && admin.method, name: "Dev" },
    today: londonToday(),
    config: {
      ai: !!String(env.ANTHROPIC_API_KEY || "").trim(),
      model: String(env.ANTHROPIC_MODEL || "").trim() || "claude-sonnet-5-5",
      research_model: String(env.ANTHROPIC_RESEARCH_MODEL || env.ANTHROPIC_MODEL || "").trim() || "claude-sonnet-5-5",
      files: !!env.HQ_FILES,
      email: !!String(env.RESEND_API_KEY || "").trim(),
      site: baseUrl(env),
      schema: SCHEMA_VERSION,
    },
    counts,
    events: rows(events),
    people: rows(people),
    templates: rows(templates),
    phases: PHASES,
    roles: ROLES,
  })
}

// ---------- events ----------

export async function eventWorkspace(db, id) {
  id = idParam(id)
  const event = await db.prepare("SELECT * FROM hq_events WHERE id = ?1").bind(id).first()
  if (!event) return json({ error: "Not found" }, 404)
  const [tasks, milestones, run, assignments, ledger, budget, docs, campaigns, content, notes, ideas, shortlist, shares, research, venue] = await db.batch([
    db.prepare(`SELECT * FROM hq_tasks WHERE event_id = ?1 ORDER BY ${TYPES.tasks.order}`).bind(id),
    db.prepare(`SELECT * FROM hq_milestones WHERE event_id = ?1 ORDER BY ${TYPES.milestones.order}`).bind(id),
    db.prepare(`SELECT * FROM hq_run WHERE event_id = ?1 ORDER BY ${TYPES.run.order}`).bind(id),
    db.prepare(`SELECT a.*, p.name AS person_display, p.phone AS person_phone, p.email AS person_email FROM hq_assignments a LEFT JOIN hq_people p ON p.id = a.person_id WHERE a.event_id = ?1 ORDER BY COALESCE(a.shift_start, '99:99'), a.role`).bind(id),
    db.prepare(`SELECT * FROM hq_ledger WHERE event_id = ?1 ORDER BY ${TYPES.ledger.order}`).bind(id),
    db.prepare(`SELECT * FROM hq_budget WHERE event_id = ?1 ORDER BY ${TYPES.budget.order}`).bind(id),
    db.prepare(`SELECT * FROM hq_docs WHERE event_id = ?1 ORDER BY ${TYPES.docs.order}`).bind(id),
    db.prepare(`SELECT * FROM hq_campaigns WHERE event_id = ?1 ORDER BY ${TYPES.campaigns.order}`).bind(id),
    db.prepare(`SELECT * FROM hq_content WHERE event_id = ?1 ORDER BY ${TYPES.content.order}`).bind(id),
    db.prepare("SELECT id, title, kind, updated_at, pinned FROM hq_notes WHERE event_id = ?1 ORDER BY pinned DESC, updated_at DESC").bind(id),
    db.prepare("SELECT id, title, status, kind FROM hq_ideas WHERE event_id = ?1 ORDER BY updated_at DESC").bind(id),
    db.prepare(`SELECT * FROM hq_venues WHERE shortlist_event_id = ?1 ORDER BY ${TYPES.venues.order}`).bind(id),
    db.prepare("SELECT id, label, areas, expires_at, revoked, last_seen, created_at FROM hq_shares WHERE event_id = ?1 ORDER BY id DESC").bind(id),
    db.prepare("SELECT id, question, status, created_at, note_id FROM hq_research WHERE event_id = ?1 ORDER BY id DESC LIMIT 10").bind(id),
    db.prepare("SELECT * FROM hq_venues WHERE id = ?1").bind(event.venue_id || 0),
  ])
  return json({
    event,
    venue: one(venue),
    tasks: rows(tasks),
    milestones: rows(milestones),
    run: rows(run),
    assignments: rows(assignments),
    ledger: rows(ledger),
    budget: rows(budget),
    docs: rows(docs),
    campaigns: rows(campaigns),
    content: rows(content),
    notes: rows(notes),
    ideas: rows(ideas),
    shortlist: rows(shortlist),
    shares: rows(shares),
    research: rows(research),
  })
}

export async function applyTemplate(db, eventId, body) {
  eventId = idParam(eventId)
  const event = await db.prepare("SELECT * FROM hq_events WHERE id = ?1").bind(eventId).first()
  if (!event) return json({ error: "Not found" }, 404)
  const tpl = await db.prepare("SELECT * FROM hq_templates WHERE id = ?1").bind(idParam(body.template_id)).first()
  if (!tpl) return json({ error: "Template not found" }, 404)
  let items = []
  try {
    items = JSON.parse(tpl.items || "[]")
  } catch {}
  const existing = new Set(rows(await db.prepare("SELECT lower(title) AS t FROM hq_tasks WHERE event_id = ?1 AND parent_id IS NULL").bind(eventId).all()).map((r) => r.t))
  const fresh = items.filter((it) => it && it.title && !existing.has(String(it.title).toLowerCase())).slice(0, 200)
  const base = (await db.prepare("SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM hq_tasks WHERE event_id = ?1 AND parent_id IS NULL").bind(eventId).first()).s
  const due = (offset) => (event.date && Number.isInteger(offset) ? addDays(event.date, offset) : null)
  const parentStmts = fresh.map((it, i) =>
    db
      .prepare("INSERT INTO hq_tasks (event_id, title, section, phase, priority, offset_days, due, sort) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id")
      .bind(eventId, String(it.title).slice(0, 400), it.section || null, it.phase || null, ["low", "normal", "high", "urgent"].includes(it.priority) ? it.priority : "normal", Number.isInteger(it.offset) ? it.offset : null, due(it.offset), base + i),
  )
  const added = parentStmts.length ? await db.batch(parentStmts) : []
  const childStmts = []
  fresh.forEach((it, i) => {
    const pid = one(added[i]) && one(added[i]).id
    ;(Array.isArray(it.subtasks) ? it.subtasks : []).slice(0, 30).forEach((title, j) => {
      childStmts.push(
        db
          .prepare("INSERT INTO hq_tasks (event_id, parent_id, title, section, phase, priority, sort) VALUES (?1, ?2, ?3, ?4, ?5, 'normal', ?6)")
          .bind(eventId, pid, String(title).slice(0, 400), it.section || null, it.phase || null, j),
      )
    })
  })
  if (childStmts.length) await db.batch(childStmts)
  const ms = await db.prepare("SELECT COUNT(*) AS n FROM hq_milestones WHERE event_id = ?1").bind(eventId).first()
  if (!ms.n) await db.batch(milestoneStatements(db, eventId, event.date))
  await logActivity(db, "update", "events", eventId, `Applied “${tpl.name}” to ${event.name} (${fresh.length} tasks)`, eventId)
  return json({ added: fresh.length })
}

function milestoneStatements(db, eventId, date) {
  return PHASES.map((p, i) =>
    db
      .prepare("INSERT INTO hq_milestones (event_id, phase, title, start_offset, due_offset, start_date, due_date, sort) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
      .bind(eventId, p.key, p.title, p.start, p.due, date ? addDays(date, p.start) : null, date ? addDays(date, p.due) : null, i),
  )
}

export async function addMilestones(db, eventId) {
  eventId = idParam(eventId)
  const event = await db.prepare("SELECT * FROM hq_events WHERE id = ?1").bind(eventId).first()
  if (!event) return json({ error: "Not found" }, 404)
  const ms = await db.prepare("SELECT COUNT(*) AS n FROM hq_milestones WHERE event_id = ?1").bind(eventId).first()
  if (!ms.n) await db.batch(milestoneStatements(db, eventId, event.date))
  return json({ ok: true })
}

export async function scheduleFromDate(db, eventId, body) {
  eventId = idParam(eventId)
  const event = await db.prepare("SELECT * FROM hq_events WHERE id = ?1").bind(eventId).first()
  if (!event) return json({ error: "Not found" }, 404)
  if (!event.date) throw new InputError("Set the event date first.")
  const overwrite = body && body.overwrite ? 1 : 0
  const res = await db.batch([
    db
      .prepare("UPDATE hq_tasks SET due = date(?1, printf('%+d days', offset_days)), updated_at = datetime('now') WHERE event_id = ?2 AND offset_days IS NOT NULL AND status != 'done' AND (due IS NULL OR ?3 = 1)")
      .bind(event.date, eventId, overwrite),
    db
      .prepare(
        "UPDATE hq_milestones SET start_date = CASE WHEN start_offset IS NULL THEN start_date ELSE date(?1, printf('%+d days', start_offset)) END, due_date = CASE WHEN due_offset IS NULL THEN due_date ELSE date(?1, printf('%+d days', due_offset)) END, updated_at = datetime('now') WHERE event_id = ?2 AND (due_date IS NULL OR ?3 = 1)",
      )
      .bind(event.date, eventId, overwrite),
  ])
  await logActivity(db, "update", "events", eventId, `Scheduled ${event.name} from ${event.date}`, eventId)
  return json({ ok: true, changed: res.map((r) => (r && r.meta && r.meta.changes) || 0) })
}

export async function runTemplate(db, eventId) {
  eventId = idParam(eventId)
  const n = await db.prepare("SELECT COUNT(*) AS n FROM hq_run WHERE event_id = ?1").bind(eventId).first()
  if (n.n) throw new InputError("This running order already has items.")
  await db.batch(
    RUN_TEMPLATE.map(([time, activity, location], i) =>
      db.prepare("INSERT INTO hq_run (event_id, time, activity, location, sort) VALUES (?1, ?2, ?3, ?4, ?5)").bind(eventId, time, activity, location, i),
    ),
  )
  return json({ ok: true })
}

export async function saveAsTemplate(db, eventId, body) {
  eventId = idParam(eventId)
  const event = await db.prepare("SELECT * FROM hq_events WHERE id = ?1").bind(eventId).first()
  if (!event) return json({ error: "Not found" }, 404)
  const all = rows(await db.prepare("SELECT * FROM hq_tasks WHERE event_id = ?1 ORDER BY sort, id").bind(eventId).all())
  const days = (a, b) => Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86400000)
  const items = all
    .filter((t) => !t.parent_id)
    .map((t) => ({
      title: t.title,
      section: t.section,
      phase: t.phase,
      priority: t.priority,
      offset: Number.isInteger(t.offset_days) ? t.offset_days : t.due && event.date ? days(t.due, event.date) : null,
      subtasks: all.filter((s) => s.parent_id === t.id).map((s) => s.title),
    }))
  const name = String((body && body.name) || `${event.name} checklist`).slice(0, 120)
  const item = await insertRecord(db, "templates", { name, kind: "checklist", items, notes: `Saved from ${event.name}.` }, { quiet: true })
  return json({ item }, 201)
}

export async function reorder(db, body) {
  const allowed = { run: "hq_run", tasks: "hq_tasks", budget: "hq_budget", milestones: "hq_milestones" }
  const table = allowed[body && body.type]
  if (!table) throw new InputError("Can't reorder that.")
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 500).map(idParam) : []
  if (!ids.length) return json({ ok: true })
  await db.batch(ids.map((id, i) => db.prepare(`UPDATE ${table} SET sort = ?1 WHERE id = ?2`).bind(i, id)))
  return json({ ok: true })
}

// ---------- ideas ----------

export async function convertIdea(db, id, body) {
  id = idParam(id)
  const idea = await db.prepare("SELECT * FROM hq_ideas WHERE id = ?1").bind(id).first()
  if (!idea) return json({ error: "Not found" }, 404)
  const to = body && body.to
  const eventId = body && body.event_id ? idParam(body.event_id) : idea.event_id || null
  const note = idea.body ? `${idea.body}\n\nFrom the idea “${idea.title}”.` : `From the idea “${idea.title}”.`
  let type, item
  if (to === "task") (type = "tasks"), (item = await insertRecord(db, "tasks", { title: idea.title, notes: note, event_id: eventId, priority: "normal" }))
  else if (to === "event") (type = "events"), (item = await insertRecord(db, "events", { name: idea.title, status: "idea", summary: idea.body }))
  else if (to === "campaign") (type = "campaigns"), (item = await insertRecord(db, "campaigns", { title: idea.title, brief: note, event_id: eventId, status: "idea" }))
  else if (to === "note") (type = "notes"), (item = await insertRecord(db, "notes", { title: idea.title, body: note, event_id: eventId }))
  else if (to === "radio") (type = "radio"), (item = await insertRecord(db, "radio", { title: idea.title, notes: note, status: "idea", event_id: eventId }))
  else if (to === "content") (type = "content"), (item = await insertRecord(db, "content", { title: idea.title, notes: note, event_id: eventId, status: "idea" }))
  else throw new InputError("Convert to task, event, campaign, content, note or radio.")
  await db.prepare("UPDATE hq_ideas SET status = 'converted', converted_type = ?1, converted_id = ?2, updated_at = datetime('now') WHERE id = ?3").bind(type, item.id, id).run()
  return json({ type, item })
}

// ---------- search ----------

const SEARCHABLE = [
  ["events", "name", "number"],
  ["tasks", "title", "section"],
  ["venues", "name", "area"],
  ["ideas", "title", "kind"],
  ["notes", "title", "kind"],
  ["people", "name", "role"],
  ["campaigns", "title", "status"],
  ["content", "title", "channel"],
  ["radio", "title", "status"],
  ["docs", "title", "kind"],
  ["research", "question", "status"],
  ["ledger", "description", "category"],
]

export async function search(db, url) {
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  if (q.length < 2) return json({ results: [] })
  const term = likeTerm(q)
  const stmts = SEARCHABLE.map(([type, title, sub]) => {
    const def = TYPES[type]
    const extra = type === "tasks" ? ", event_id, parent_id" : ["ledger", "campaigns", "content", "notes", "docs"].includes(type) ? ", event_id" : ""
    return db
      .prepare(`SELECT id, ${title} AS title, ${sub} AS sub${extra} FROM ${def.table} WHERE ${def.search.map((c) => `${c} LIKE ?1 ESCAPE '\\'`).join(" OR ")} ORDER BY id DESC LIMIT 6`)
      .bind(term)
  })
  const res = await db.batch(stmts)
  const results = []
  SEARCHABLE.forEach(([type], i) => rows(res[i]).forEach((r) => results.push({ type, ...r })))
  return json({ results })
}

// ---------- calendar ----------

export async function calendar(db, url) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from") || "") ? url.searchParams.get("from") : addDays(londonToday(), -7)
  const to = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to") || "") ? url.searchParams.get("to") : addDays(from, 60)
  const ev = url.searchParams.get("event_id")
  const eid = ev ? idParam(ev) : null
  const E = (col) => (eid ? ` AND ${col} = ${eid}` : "")
  const res = await db.batch([
    db.prepare(`SELECT id, name AS title, date, status, 'event' AS type, id AS event_id FROM hq_events WHERE date BETWEEN ?1 AND ?2${E("id")}`).bind(from, to),
    db.prepare(`SELECT id, title, due_date AS date, start_date, status, 'milestone' AS type, event_id FROM hq_milestones WHERE (due_date BETWEEN ?1 AND ?2 OR start_date BETWEEN ?1 AND ?2)${E("event_id")}`).bind(from, to),
    db.prepare(`SELECT id, title, due AS date, status, priority, 'task' AS type, event_id FROM hq_tasks WHERE parent_id IS NULL AND due BETWEEN ?1 AND ?2${E("event_id")}`).bind(from, to),
    db.prepare(`SELECT id, title, publish_date AS date, status, channel, 'content' AS type, event_id FROM hq_content WHERE publish_date BETWEEN ?1 AND ?2${E("event_id")}`).bind(from, to),
    db.prepare(`SELECT id, title, release_date AS date, status, 'radio' AS type, event_id FROM hq_radio WHERE release_date BETWEEN ?1 AND ?2${E("event_id")}`).bind(from, to),
    eid
      ? db.prepare("SELECT id, name AS title, next_follow_up AS date, status, 'followup' AS type FROM hq_venues WHERE shortlist_event_id = ?3 AND next_follow_up BETWEEN ?1 AND ?2").bind(from, to, eid)
      : db.prepare("SELECT id, name AS title, next_follow_up AS date, status, 'followup' AS type FROM hq_venues WHERE next_follow_up BETWEEN ?1 AND ?2").bind(from, to),
  ])
  return json({ from, to, items: res.flatMap(rows) })
}

// ---------- dashboard ----------

const OPEN_EVENT = "status NOT IN ('completed', 'cancelled')"

export async function dashboard(db) {
  const today = londonToday()
  const in3 = addDays(today, 3)
  const in7 = addDays(today, 7)
  const in14 = addDays(today, 14)
  const T = "SELECT t.id, t.title, t.due, t.priority, t.status, t.event_id, t.section, e.number AS event_number, e.name AS event_name FROM hq_tasks t LEFT JOIN hq_events e ON e.id = t.event_id"
  const [events, priority, overdue, overdueCount, deadlines, msDue, tickets, content, campaigns, notes, venues, totals, perEvent, budgets, progress, msProgress, ideas, followups, activity, planned, radio, shortlists] = await db.batch([
    db.prepare(`SELECT * FROM hq_events ORDER BY ${TYPES.events.order}`),
    db.prepare(`${T} WHERE t.status != 'done' AND t.parent_id IS NULL AND t.priority IN ('urgent', 'high') ORDER BY COALESCE(t.due, '9999'), CASE t.priority WHEN 'urgent' THEN 0 ELSE 1 END, t.sort LIMIT 6`),
    db.prepare(`${T} WHERE t.status != 'done' AND t.due < ?1 ORDER BY t.due LIMIT 8`).bind(today),
    db.prepare("SELECT COUNT(*) AS n FROM hq_tasks WHERE status != 'done' AND due < ?1").bind(today),
    db.prepare(`${T} WHERE t.status != 'done' AND t.parent_id IS NULL AND t.due BETWEEN ?1 AND ?2 ORDER BY t.due LIMIT 8`).bind(today, in14),
    db.prepare("SELECT m.id, m.title, m.due_date, m.status, m.event_id, e.number AS event_number FROM hq_milestones m LEFT JOIN hq_events e ON e.id = m.event_id WHERE m.status != 'done' AND m.due_date BETWEEN ?1 AND ?2 ORDER BY m.due_date LIMIT 6").bind(today, in14),
    db.prepare("SELECT l.*, e.number AS event_number FROM hq_ledger l LEFT JOIN hq_events e ON e.id = l.event_id WHERE l.kind = 'income' AND l.category IN ('Tickets', 'Door') ORDER BY COALESCE(l.date, l.created_at) DESC, l.id DESC LIMIT 5"),
    db.prepare("SELECT c.*, e.number AS event_number FROM hq_content c LEFT JOIN hq_events e ON e.id = c.event_id WHERE c.status != 'published' AND (c.publish_date IS NULL OR c.publish_date >= ?1) ORDER BY COALESCE(c.publish_date, '9999'), c.id DESC LIMIT 5").bind(addDays(today, -1)),
    db.prepare("SELECT * FROM hq_campaigns WHERE status IN ('planning', 'live') ORDER BY COALESCE(start_date, '9999') LIMIT 4"),
    db.prepare("SELECT id, title, kind, updated_at, substr(body, 1, 220) AS excerpt FROM hq_notes ORDER BY updated_at DESC LIMIT 4"),
    db.prepare("SELECT id, name, area, status, next_follow_up, last_contact FROM hq_venues WHERE status IN ('enquired', 'awaiting', 'negotiating', 'visited') ORDER BY COALESCE(next_follow_up, '9999') LIMIT 6"),
    db.prepare("SELECT kind, status, SUM(amount_pence) AS total, SUM(confidence != 'verified') AS unconfirmed, COUNT(*) AS n FROM hq_ledger GROUP BY kind, status"),
    db.prepare("SELECT event_id, kind, status, SUM(amount_pence) AS total, SUM(confidence != 'verified') AS unconfirmed FROM hq_ledger WHERE event_id IS NOT NULL GROUP BY event_id, kind, status"),
    db.prepare("SELECT event_id, SUM(amount_pence) AS total, SUM(confidence = 'estimate') AS estimates, COUNT(*) AS n FROM hq_budget GROUP BY event_id"),
    db.prepare("SELECT event_id, COUNT(*) AS total, SUM(status = 'done') AS done FROM hq_tasks WHERE parent_id IS NULL AND event_id IS NOT NULL GROUP BY event_id"),
    db.prepare("SELECT event_id, COUNT(*) AS total, SUM(status = 'done') AS done FROM hq_milestones GROUP BY event_id"),
    db.prepare("SELECT * FROM hq_ideas WHERE status IN ('spark', 'developing') ORDER BY pinned DESC, created_at DESC LIMIT 6"),
    db.prepare("SELECT id, name, next_follow_up, status FROM hq_venues WHERE next_follow_up IS NOT NULL AND next_follow_up <= ?1 AND status NOT IN ('rejected', 'booked', 'past') ORDER BY next_follow_up LIMIT 6").bind(in3),
    db.prepare("SELECT * FROM hq_activity ORDER BY id DESC LIMIT 8"),
    db.prepare("SELECT l.*, e.number AS event_number FROM hq_ledger l LEFT JOIN hq_events e ON e.id = l.event_id WHERE l.kind = 'expense' AND l.status = 'planned' ORDER BY COALESCE(l.date, '9999') LIMIT 5"),
    db.prepare("SELECT id, title, number, status, record_date, release_date FROM hq_radio WHERE (release_date BETWEEN ?1 AND ?2) OR (record_date BETWEEN ?1 AND ?2) ORDER BY COALESCE(record_date, release_date)").bind(today, in7),
    db.prepare("SELECT shortlist_event_id AS event_id, COUNT(*) AS n FROM hq_venues WHERE shortlist_event_id IS NOT NULL AND status != 'rejected' GROUP BY shortlist_event_id"),
  ])

  const evs = rows(events)
  const money = {}
  for (const r of rows(perEvent)) {
    const m = (money[r.event_id] ||= { income: 0, expense: 0, planned: 0, unconfirmed: 0 })
    if (r.kind === "income" && r.status === "actual") m.income += r.total || 0
    if (r.kind === "expense" && r.status === "actual") m.expense += r.total || 0
    if (r.kind === "expense" && r.status === "planned") m.planned += r.total || 0
    if (r.status === "actual") m.unconfirmed += r.unconfirmed || 0
  }
  const budgetBy = Object.fromEntries(rows(budgets).map((r) => [r.event_id, r]))
  const progBy = Object.fromEntries(rows(progress).map((r) => [r.event_id, r]))
  const msBy = Object.fromEntries(rows(msProgress).map((r) => [r.event_id, r]))
  const shortBy = Object.fromEntries(rows(shortlists).map((r) => [r.event_id, r.n]))

  const open = evs.filter((e) => !["completed", "cancelled"].includes(e.status))
  const dated = open.filter((e) => e.date && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const rank = { on_sale: 0, confirmed: 1, planning: 2, idea: 3 }
  const byRank = [...open].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || String(a.number || "").localeCompare(String(b.number || "")))
  const nextEvent = dated[0] || byRank[0] || null
  const completed = evs.filter((e) => e.status === "completed").sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
  const last = completed[0] || null

  const decorate = (e) =>
    e && {
      ...e,
      days_to_go: e.date ? Math.round((Date.parse(e.date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000) : null,
      tasks: progBy[e.id] || { total: 0, done: 0 },
      milestones: msBy[e.id] || { total: 0, done: 0 },
      money: money[e.id] || { income: 0, expense: 0, planned: 0, unconfirmed: 0 },
      budget: budgetBy[e.id] || null,
      shortlist: shortBy[e.id] || 0,
    }

  let nextMilestones = []
  if (nextEvent) {
    nextMilestones = rows(await db.prepare(`SELECT id, title, phase, status, due_date FROM hq_milestones WHERE event_id = ?1 ORDER BY ${TYPES.milestones.order}`).bind(nextEvent.id).all())
  }

  // Ticket and door revenue across all events, only from recorded ledger rows.
  const tr = one(await db.prepare("SELECT SUM(amount_pence) AS total, SUM(confidence != 'verified') AS unconfirmed, COUNT(*) AS n FROM hq_ledger WHERE kind = 'income' AND status = 'actual' AND category IN ('Tickets', 'Door')").all())
  const totalsRows = rows(totals)
  const sumOf = (kind, status) => totalsRows.filter((r) => r.kind === kind && r.status === status).reduce((s, r) => s + (r.total || 0), 0)
  const plannedTotal = sumOf("expense", "planned")

  const audience = await audienceSummary(db, today)
  const nextDec = decorate(nextEvent)
  const pulse = {
    ticket_revenue: tr && tr.n ? { value: tr.total || 0, unconfirmed: tr.unconfirmed || 0, entries: tr.n } : null,
    event_profit: last && money[last.id] ? { event: last.name, value: money[last.id].income - money[last.id].expense, unconfirmed: money[last.id].unconfirmed } : null,
    list_growth: audience.available ? { total: audience.eligible, last30: audience.last30, prev30: audience.prev30 } : null,
    attendance: last ? { event: last.name, value: last.attendance, capacity: last.capacity } : null,
    upcoming_costs: rows(planned).length ? { value: plannedTotal, items: rows(planned) } : null,
    budget_remaining:
      nextDec && nextDec.budget && nextDec.budget.n
        ? { event: nextDec.name, budget: nextDec.budget.total, spent: nextDec.money.expense, value: nextDec.budget.total - nextDec.money.expense, estimates: nextDec.budget.estimates }
        : null,
  }

  const reminders = []
  for (const v of rows(followups)) reminders.push({ kind: "followup", id: v.id, text: `Follow up with ${v.name}`, date: v.next_follow_up, overdue: v.next_follow_up < today })
  for (const m of rows(msDue)) if (m.due_date <= in7) reminders.push({ kind: "milestone", id: m.id, event_id: m.event_id, text: `${m.title}${m.event_number ? ` · ${m.event_number}` : ""}`, date: m.due_date })
  for (const r of rows(radio)) reminders.push({ kind: "radio", id: r.id, text: `${r.title}: ${r.record_date && r.record_date <= in7 && r.record_date >= today ? "recording" : "release"}`, date: r.record_date || r.release_date })
  if (nextDec && nextDec.days_to_go !== null && nextDec.days_to_go >= 0 && nextDec.days_to_go <= 14) reminders.push({ kind: "event", id: nextDec.id, text: `${nextDec.name} is in ${nextDec.days_to_go} day${nextDec.days_to_go === 1 ? "" : "s"}`, date: nextDec.date })
  reminders.sort((a, b) => String(a.date).localeCompare(String(b.date)))

  return json({
    today,
    next_event: nextDec,
    next_milestones: nextMilestones,
    last_event: decorate(last),
    priority: rows(priority),
    overdue: rows(overdue),
    overdue_count: one(overdueCount) ? one(overdueCount).n : 0,
    deadlines: [...rows(deadlines).map((t) => ({ ...t, kind: "task", date: t.due })), ...rows(msDue).map((m) => ({ ...m, kind: "milestone", date: m.due_date }))].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8),
    tickets: rows(tickets),
    marketing: { content: rows(content), campaigns: rows(campaigns) },
    notes: rows(notes),
    venues_pending: rows(venues),
    finance: {
      income: sumOf("income", "actual"),
      expense: sumOf("expense", "actual"),
      planned: plannedTotal,
      entries: totalsRows.reduce((s, r) => s + r.n, 0),
      unconfirmed: totalsRows.filter((r) => r.status === "actual").reduce((s, r) => s + (r.unconfirmed || 0), 0),
    },
    audience,
    ideas: rows(ideas),
    reminders,
    activity: rows(activity),
    pulse,
  })
}

// ---------- audience (reads the existing signup tables; never writes them) ----------

async function audienceSummary(db, today) {
  if (!(await tableExists(db, "signups"))) return { available: false }
  const hasUnsubs = await tableExists(db, "unsubscribes")
  const eligible = hasUnsubs
    ? "s.marketing_consent = 1 AND NOT EXISTS (SELECT 1 FROM unsubscribes u WHERE u.email = lower(s.email))"
    : "s.marketing_consent = 1"
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN ${eligible} THEN 1 ELSE 0 END) AS eligible,
        SUM(CASE WHEN date(s.created_at) > date(?1, '-7 days') THEN 1 ELSE 0 END) AS last7,
        SUM(CASE WHEN date(s.created_at) > date(?1, '-30 days') THEN 1 ELSE 0 END) AS last30,
        SUM(CASE WHEN date(s.created_at) > date(?1, '-60 days') AND date(s.created_at) <= date(?1, '-30 days') THEN 1 ELSE 0 END) AS prev30
       FROM signups s`,
    )
    .bind(today)
    .first()
  return { available: true, total: r.total || 0, eligible: r.eligible || 0, last7: r.last7 || 0, last30: r.last30 || 0, prev30: r.prev30 || 0 }
}

export async function audience(db) {
  const today = londonToday()
  const summary = await audienceSummary(db, today)
  if (!summary.available) return json({ summary, weekly: [], sources: [], recent: [], campaigns: [] })
  const hasUnsubs = await tableExists(db, "unsubscribes")
  const [weekly, sources, recent, unsubs] = await db.batch([
    db.prepare("SELECT strftime('%Y-%W', created_at) AS week, MIN(date(created_at)) AS start, COUNT(*) AS n FROM signups WHERE date(created_at) > date(?1, '-84 days') GROUP BY week ORDER BY week").bind(today),
    db.prepare("SELECT COALESCE(NULLIF(source, ''), 'unknown') AS source, COUNT(*) AS n FROM signups GROUP BY 1 ORDER BY n DESC LIMIT 8"),
    db.prepare("SELECT id, first_name, email, source, marketing_consent, created_at FROM signups ORDER BY id DESC LIMIT 25"),
    hasUnsubs ? db.prepare("SELECT COUNT(*) AS n FROM unsubscribes") : db.prepare("SELECT 0 AS n"),
  ])
  let campaigns = []
  if ((await tableExists(db, "campaigns")) && (await tableExists(db, "deliveries"))) {
    campaigns = rows(
      await db
        .prepare(
          "SELECT c.slug, c.name, c.status, c.launched_at, COUNT(d.id) AS deliveries, SUM(d.status = 'delivered') AS delivered, SUM(d.status IN ('bounced', 'complained', 'failed')) AS problems FROM campaigns c LEFT JOIN deliveries d ON d.campaign_id = c.id GROUP BY c.id ORDER BY c.id DESC",
        )
        .all(),
    )
  }
  return json({ summary: { ...summary, unsubscribed: one(unsubs) ? one(unsubs).n : 0 }, weekly: rows(weekly), sources: rows(sources), recent: rows(recent), campaigns })
}

// ---------- finance ----------

export async function finance(db) {
  const [byEvent, budgets, byCategory, monthly, events, totals] = await db.batch([
    db.prepare("SELECT event_id, kind, status, SUM(amount_pence) AS total, SUM(confidence != 'verified') AS unconfirmed, COUNT(*) AS n FROM hq_ledger GROUP BY event_id, kind, status"),
    db.prepare("SELECT event_id, SUM(amount_pence) AS total, SUM(confidence = 'estimate') AS estimates, COUNT(*) AS n FROM hq_budget GROUP BY event_id"),
    db.prepare("SELECT kind, COALESCE(NULLIF(category, ''), 'Uncategorised') AS category, SUM(amount_pence) AS total FROM hq_ledger WHERE status = 'actual' GROUP BY kind, 2 ORDER BY total DESC"),
    db.prepare("SELECT substr(COALESCE(date, created_at), 1, 7) AS month, kind, SUM(amount_pence) AS total FROM hq_ledger WHERE status = 'actual' GROUP BY 1, kind ORDER BY 1"),
    db.prepare(`SELECT id, number, name, status, date FROM hq_events ORDER BY ${TYPES.events.order}`),
    db.prepare("SELECT kind, status, SUM(amount_pence) AS total, SUM(confidence != 'verified') AS unconfirmed, COUNT(*) AS n FROM hq_ledger GROUP BY kind, status"),
  ])
  const per = {}
  for (const r of rows(byEvent)) {
    const k = r.event_id ?? "brand"
    const m = (per[k] ||= { income: 0, expense: 0, planned_income: 0, planned_expense: 0, unconfirmed: 0, entries: 0 })
    const key = r.status === "planned" ? `planned_${r.kind}` : r.kind
    m[key] += r.total || 0
    m.unconfirmed += r.unconfirmed || 0
    m.entries += r.n || 0
  }
  const budgetBy = Object.fromEntries(rows(budgets).map((r) => [r.event_id, r]))
  const eventsOut = rows(events).map((e) => ({ ...e, money: per[e.id] || null, budget: budgetBy[e.id] || null }))
  const t = rows(totals)
  const sum = (kind, status) => t.filter((r) => r.kind === kind && r.status === status).reduce((s, r) => s + (r.total || 0), 0)
  return json({
    totals: {
      income: sum("income", "actual"),
      expense: sum("expense", "actual"),
      planned_expense: sum("expense", "planned"),
      planned_income: sum("income", "planned"),
      entries: t.reduce((s, r) => s + r.n, 0),
      unconfirmed: t.filter((r) => r.status === "actual").reduce((s, r) => s + (r.unconfirmed || 0), 0),
    },
    brand: per.brand || null,
    events: eventsOut,
    categories: rows(byCategory),
    monthly: rows(monthly),
  })
}

// ---------- crew links ----------

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export { sha256Hex }

const SHARE_AREAS = ["run", "team", "tasks", "venue"]

export async function createShare(db, env, body) {
  const eventId = idParam(body && body.event_id)
  const event = await db.prepare("SELECT id, name FROM hq_events WHERE id = ?1").bind(eventId).first()
  if (!event) return json({ error: "Event not found" }, 404)
  const areas = (Array.isArray(body.areas) ? body.areas : ["run", "team"]).filter((a) => SHARE_AREAS.includes(a))
  if (!areas.length) throw new InputError("Pick at least one area to share.")
  const days = Math.min(Math.max(Number(body.days) || 14, 1), 120)
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  const expires = new Date(Date.now() + days * 86400000).toISOString()
  const label = String(body.label || "Crew").slice(0, 80)
  const item = await db
    .prepare("INSERT INTO hq_shares (token_hash, event_id, label, areas, expires_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id, label, areas, expires_at, revoked, created_at")
    .bind(await sha256Hex(token), eventId, label, areas.join(","), expires)
    .first()
  await logActivity(db, "create", "shares", item.id, `Created crew link “${label}” for ${event.name}`, eventId)
  // The token is shown once; only its hash is stored.
  return json({ item, url: `${baseUrl(env)}/crew/${token}` }, 201)
}

export async function revokeShare(db, id) {
  await db.prepare("UPDATE hq_shares SET revoked = 1 WHERE id = ?1").bind(idParam(id)).run()
  return json({ ok: true })
}

// ---------- files (optional R2 bucket bound as HQ_FILES) ----------

const INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif", "application/pdf", "text/plain"])
const MAX_UPLOAD = 25 * 1024 * 1024

export async function uploadFile(db, env, request, url) {
  if (!env.HQ_FILES) return json({ error: "File storage isn't connected yet. See Settings → Storage.", code: "no_storage" }, 503)
  const size = Number(request.headers.get("Content-Length") || 0)
  if (size > MAX_UPLOAD) return json({ error: "Files can be up to 25 MB." }, 413)
  const name = String(url.searchParams.get("name") || "file").replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file"
  const mime = String(request.headers.get("Content-Type") || "application/octet-stream").split(";")[0].trim().slice(0, 100)
  const meta = {
    title: url.searchParams.get("title") || name,
    kind: url.searchParams.get("kind") || (mime.startsWith("image/") ? "photo" : "other"),
    event_id: url.searchParams.get("event_id") || null,
    venue_id: url.searchParams.get("venue_id") || null,
    ledger_id: url.searchParams.get("ledger_id") || null,
  }
  cleanRecord("docs", meta, { creating: true }) // validate before storing anything
  const buf = await request.arrayBuffer()
  if (buf.byteLength > MAX_UPLOAD) return json({ error: "Files can be up to 25 MB." }, 413)
  if (!buf.byteLength) throw new InputError("That file is empty.")
  const key = `hq/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${name}`
  await env.HQ_FILES.put(key, buf, { httpMetadata: { contentType: mime } })
  const item = await insertRecord(db, "docs", { ...meta, r2_key: key, mime, size: buf.byteLength }, { internal: true })
  if (meta.ledger_id) await db.prepare("UPDATE hq_ledger SET doc_id = ?1 WHERE id = ?2").bind(item.id, Number(meta.ledger_id)).run()
  return json({ item }, 201)
}

export async function downloadFile(db, env, id, url) {
  const doc = await db.prepare("SELECT * FROM hq_docs WHERE id = ?1").bind(idParam(id)).first()
  if (!doc || !doc.r2_key) return json({ error: "Not found" }, 404)
  if (!env.HQ_FILES) return json({ error: "File storage isn't connected." }, 503)
  const obj = await env.HQ_FILES.get(doc.r2_key)
  if (!obj) return json({ error: "The stored file is missing." }, 404)
  const mime = doc.mime || "application/octet-stream"
  const inline = INLINE_TYPES.has(mime) && url.searchParams.get("download") !== "1"
  const filename = doc.r2_key.split("/").pop().replace(/^[0-9a-f-]{36}-/, "")
  return new Response(obj.body, {
    headers: {
      "Content-Type": inline ? mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/"/g, "")}"`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

// ---------- export ----------

export async function exportAll(db) {
  const names = Object.keys(TYPES)
  const res = await db.batch([...names.map((t) => db.prepare(`SELECT * FROM ${TYPES[t].table}`)), db.prepare("SELECT * FROM hq_activity ORDER BY id")])
  const out = { exported_at: new Date().toISOString(), schema: SCHEMA_VERSION }
  names.forEach((t, i) => (out[t] = rows(res[i])))
  out.activity = rows(res[names.length])
  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="rouge-hq-${londonToday()}.json"`,
      "Cache-Control": "no-store",
    },
  })
}

export { setting }
