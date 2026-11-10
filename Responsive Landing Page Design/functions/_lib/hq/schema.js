// ROUGE HQ database schema. Tables are created automatically the first time HQ is opened, so nothing
// has to be pasted into the D1 console. Every statement is idempotent (IF NOT EXISTS), and the existing
// invitation tables (signups, campaigns, deliveries, unsubscribes) are never altered.
// Exports no request handlers, so Pages does not turn this into a route.

import { seedStatements } from "./seed.js"
import { applyOutreach, applyVenueAdditions } from "./outreach.js"

export const SCHEMA_VERSION = 2

const STAMPS = "created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))"

const DDL = [
  `CREATE TABLE IF NOT EXISTS hq_events (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'idea',
    date TEXT, start_time TEXT, end_time TEXT, venue_id INTEGER, venue_name TEXT, capacity INTEGER, ticket_target INTEGER, tickets_sold INTEGER,
    attendance INTEGER, ticket_price TEXT, ticket_url TEXT, bar_minimum_pence INTEGER, bar_takings_pence INTEGER, tagline TEXT, summary TEXT,
    notes TEXT, cover TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER REFERENCES hq_events(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES hq_tasks(id) ON DELETE CASCADE, title TEXT NOT NULL, section TEXT, phase TEXT, status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'normal', owner TEXT, person_id INTEGER, due TEXT, offset_days INTEGER, notes TEXT, sort INTEGER NOT NULL DEFAULT 0,
    done_at TEXT, ${STAMPS})`,
  `CREATE INDEX IF NOT EXISTS idx_hq_tasks_event ON hq_tasks (event_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_hq_tasks_due ON hq_tasks (status, due)`,
  `CREATE TABLE IF NOT EXISTS hq_milestones (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES hq_events(id) ON DELETE CASCADE,
    phase TEXT, title TEXT NOT NULL, start_date TEXT, due_date TEXT, start_offset INTEGER, due_offset INTEGER, status TEXT NOT NULL DEFAULT 'todo',
    notes TEXT, sort INTEGER NOT NULL DEFAULT 0, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_run (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES hq_events(id) ON DELETE CASCADE,
    time TEXT, activity TEXT NOT NULL, person TEXT, location TEXT, notes TEXT, done INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 0, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT, email TEXT, phone TEXT, instagram TEXT,
    areas TEXT, notes TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES hq_events(id) ON DELETE CASCADE,
    person_id INTEGER REFERENCES hq_people(id) ON DELETE SET NULL, person_name TEXT, role TEXT NOT NULL, shift_start TEXT, shift_end TEXT,
    confirmed INTEGER NOT NULL DEFAULT 0, notes TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_venues (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT, area TEXT, contact_name TEXT,
    contact_email TEXT, contact_phone TEXT, website TEXT, instagram TEXT, capacity INTEGER, spaces TEXT, indoor_outdoor TEXT, rooftop INTEGER,
    sound_system TEXT, cdjs TEXT, mixer TEXT, turntables TEXT, serato TEXT, security TEXT, hire_fee_pence INTEGER, hire_fee_note TEXT,
    bar_min_pence INTEGER, bar_min_note TEXT, deposit_pence INTEGER, deposit_note TEXT, licence TEXT, restrictions TEXT,
    status TEXT NOT NULL DEFAULT 'prospect', shortlist_event_id INTEGER REFERENCES hq_events(id) ON DELETE SET NULL, relationship INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0, negotiation_notes TEXT, last_contact TEXT, next_follow_up TEXT, score_econ INTEGER, score_sound INTEGER,
    score_atmos INTEGER, score_safety INTEGER, score_location INTEGER, facts TEXT, sources TEXT, notes TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_venue_log (id INTEGER PRIMARY KEY AUTOINCREMENT, venue_id INTEGER NOT NULL REFERENCES hq_venues(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'note', date TEXT, title TEXT NOT NULL, body TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_ideas (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT, kind TEXT NOT NULL DEFAULT 'other',
    status TEXT NOT NULL DEFAULT 'spark', pinned INTEGER NOT NULL DEFAULT 0, event_id INTEGER REFERENCES hq_events(id) ON DELETE SET NULL,
    converted_type TEXT, converted_id INTEGER, source TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT, kind TEXT NOT NULL DEFAULT 'note', tags TEXT,
    event_id INTEGER REFERENCES hq_events(id) ON DELETE SET NULL, venue_id INTEGER REFERENCES hq_venues(id) ON DELETE SET NULL,
    pinned INTEGER NOT NULL DEFAULT 0, ai_context INTEGER NOT NULL DEFAULT 0, sources TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_docs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'other',
    event_id INTEGER REFERENCES hq_events(id) ON DELETE SET NULL, venue_id INTEGER REFERENCES hq_venues(id) ON DELETE SET NULL, ledger_id INTEGER,
    link TEXT, notes TEXT, r2_key TEXT, mime TEXT, size INTEGER, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER REFERENCES hq_events(id) ON DELETE SET NULL,
    kind TEXT NOT NULL, category TEXT, description TEXT NOT NULL, amount_pence INTEGER NOT NULL DEFAULT 0, qty INTEGER,
    status TEXT NOT NULL DEFAULT 'actual', confidence TEXT NOT NULL DEFAULT 'verified', date TEXT, party TEXT,
    doc_id INTEGER REFERENCES hq_docs(id) ON DELETE SET NULL, notes TEXT, ${STAMPS})`,
  `CREATE INDEX IF NOT EXISTS idx_hq_ledger_event ON hq_ledger (event_id, kind, status)`,
  `CREATE TABLE IF NOT EXISTS hq_budget (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES hq_events(id) ON DELETE CASCADE,
    category TEXT NOT NULL, amount_pence INTEGER NOT NULL DEFAULT 0, confidence TEXT NOT NULL DEFAULT 'estimate', notes TEXT,
    sort INTEGER NOT NULL DEFAULT 0, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER REFERENCES hq_events(id) ON DELETE SET NULL,
    title TEXT NOT NULL, goal TEXT, channel TEXT, status TEXT NOT NULL DEFAULT 'idea', start_date TEXT, end_date TEXT, budget_pence INTEGER,
    brief TEXT, notes TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_content (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER REFERENCES hq_campaigns(id) ON DELETE SET NULL,
    event_id INTEGER REFERENCES hq_events(id) ON DELETE SET NULL, title TEXT NOT NULL, channel TEXT, format TEXT, status TEXT NOT NULL DEFAULT 'idea',
    publish_date TEXT, caption TEXT, link TEXT, notes TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_radio (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, title TEXT NOT NULL, guest TEXT, status TEXT NOT NULL DEFAULT 'idea',
    record_date TEXT, release_date TEXT, platform TEXT, link TEXT, tracklist TEXT, notes TEXT,
    event_id INTEGER REFERENCES hq_events(id) ON DELETE SET NULL, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'checklist',
    items TEXT NOT NULL DEFAULT '[]', notes TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_research (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT NOT NULL, depth TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'queued', report TEXT, sources TEXT, queries TEXT, searches INTEGER NOT NULL DEFAULT 0, note_id INTEGER,
    event_id INTEGER REFERENCES hq_events(id) ON DELETE SET NULL, venue_id INTEGER REFERENCES hq_venues(id) ON DELETE SET NULL,
    error TEXT, finished_at TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_chats (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, messages TEXT NOT NULL DEFAULT '[]', ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS hq_activity (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, entity TEXT, entity_id INTEGER, event_id INTEGER,
    summary TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_hq_activity_created ON hq_activity (created_at)`,
  `CREATE TABLE IF NOT EXISTS hq_shares (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL UNIQUE,
    event_id INTEGER NOT NULL REFERENCES hq_events(id) ON DELETE CASCADE, label TEXT, areas TEXT NOT NULL DEFAULT 'run,team',
    person_id INTEGER REFERENCES hq_people(id) ON DELETE SET NULL, expires_at TEXT, revoked INTEGER NOT NULL DEFAULT 0, last_seen TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  // v2: venue outreach
  `CREATE TABLE IF NOT EXISTS hq_enquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, venue_id INTEGER NOT NULL REFERENCES hq_venues(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES hq_events(id) ON DELETE SET NULL, parent_id INTEGER, kind TEXT NOT NULL DEFAULT 'enquiry', status TEXT NOT NULL DEFAULT 'draft',
    include INTEGER NOT NULL DEFAULT 1, to_email TEXT, subject TEXT, body TEXT, provider_id TEXT, error TEXT, sent_at TEXT, follow_up_on TEXT,
    replied_at TEXT, reply_body TEXT, ${STAMPS})`,
  `CREATE INDEX IF NOT EXISTS idx_hq_enquiries_venue ON hq_enquiries (venue_id, status)`,
  `CREATE TABLE IF NOT EXISTS hq_quotes (id INTEGER PRIMARY KEY AUTOINCREMENT, venue_id INTEGER NOT NULL REFERENCES hq_venues(id) ON DELETE CASCADE,
    enquiry_id INTEGER, received_on TEXT, room TEXT, available_dates TEXT, capacity INTEGER, hire_fee_pence INTEGER, hire_note TEXT,
    bar_min_pence INTEGER, bar_min_note TEXT, deposit_pence INTEGER, security_pence INTEGER, security_note TEXT, dj_equipment TEXT,
    licence TEXT, ticketing TEXT, other_costs TEXT, notes TEXT, evidence TEXT, ${STAMPS})`,
]

let ready = null

// Runs once per Worker instance; later requests reuse the same promise.
export function ensureHq(env) {
  if (!ready) {
    ready = migrate(env.DB).catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}

async function migrate(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS hq_meta (key TEXT PRIMARY KEY, value TEXT)").run()
  const row = await db.prepare("SELECT value FROM hq_meta WHERE key = 'schema_version'").first()
  if (!row || Number(row.value) < SCHEMA_VERSION) {
    await db.batch(DDL.map((sql) => db.prepare(sql)))
    await db
      .prepare("INSERT INTO hq_meta (key, value) VALUES ('schema_version', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(String(SCHEMA_VERSION))
      .run()
  }
  await seedOnce(db)
  try {
    await applyOutreach(db)
  } catch (err) {
    console.error("HQ outreach update failed:", err && err.message)
  }
  try {
    await applyVenueAdditions(db)
  } catch (err) {
    console.error("HQ venue additions failed:", err && err.message)
  }
}

async function seedOnce(db) {
  const seeded = await db.prepare("SELECT value FROM hq_meta WHERE key = 'seeded'").first()
  if (seeded) return
  const existing = await db.prepare("SELECT COUNT(*) AS n FROM hq_events").first()
  if (existing && existing.n > 0) {
    await db.prepare("INSERT OR IGNORE INTO hq_meta (key, value) VALUES ('seeded', datetime('now'))").run()
    return
  }
  try {
    // One transaction. The first statement claims the seed, so a second concurrent attempt fails and rolls back.
    await db.batch(seedStatements(db))
  } catch (err) {
    const again = await db.prepare("SELECT value FROM hq_meta WHERE key = 'seeded'").first()
    if (!again) console.error("HQ seed failed:", err && err.message)
  }
}
