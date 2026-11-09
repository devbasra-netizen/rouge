// Tables for ROUGE Members and ROUGE Radio applications. Created automatically, idempotently.
// Members are NOT a second list: every member is a row in the existing `signups` table (the one the
// invitations use), with an optional 1:1 `member_profiles` row for the extra details they choose to give.
// Exports no request handlers, so Pages does not turn this into a route.

import { DEFAULT_TEMPLATES } from "./templates.js"

export const COMMUNITY_VERSION = 1
const STAMPS = "created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))"

// The signup/invitation tables, exactly as the invitation system defined them. CREATE IF NOT EXISTS
// never alters an existing table; this only matters on a brand-new database.
const BASE = [
  `CREATE TABLE IF NOT EXISTS signups (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, first_name TEXT,
    marketing_consent INTEGER NOT NULL DEFAULT 1, source TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS unsubscribes (email TEXT PRIMARY KEY, unsubscribed_at TEXT NOT NULL DEFAULT (datetime('now')), method TEXT)`,
]

const DDL = [
  `CREATE TABLE IF NOT EXISTS member_profiles (signup_id INTEGER PRIMARY KEY REFERENCES signups(id) ON DELETE CASCADE,
    member_uid TEXT NOT NULL UNIQUE, instagram TEXT, location TEXT, interests TEXT NOT NULL DEFAULT '[]', topics TEXT NOT NULL DEFAULT '[]',
    verified_at TEXT, confirm_nonce TEXT, confirm_sent_at TEXT, pending TEXT, privacy_accepted_at TEXT, welcomed_at TEXT, ${STAMPS})`,
  `CREATE TABLE IF NOT EXISTS consent_events (id INTEGER PRIMARY KEY AUTOINCREMENT, signup_id INTEGER REFERENCES signups(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, source TEXT, wording TEXT, ip_hash TEXT, user_agent TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_consent_events_signup ON consent_events (signup_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS radio_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT NOT NULL UNIQUE, submission_key TEXT UNIQUE,
    artist_name TEXT NOT NULL, full_name TEXT, pronouns TEXT, email TEXT NOT NULL, location TEXT NOT NULL, profile_url TEXT NOT NULL,
    website TEXT, other_socials TEXT, bio TEXT NOT NULL, genres TEXT NOT NULL DEFAULT '[]', genre_other TEXT, selection_style TEXT NOT NULL,
    mix_url TEXT NOT NULL, mix_url_2 TEXT, mix_why TEXT, session_concept TEXT NOT NULL, session_different TEXT, session_title TEXT,
    mix_length TEXT, performance TEXT, can_record TEXT, technical_notes TEXT, discovery TEXT, extra TEXT,
    contact_ok INTEGER NOT NULL DEFAULT 1, acknowledgements TEXT NOT NULL, marketing_opt_in INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new', tags TEXT NOT NULL DEFAULT '[]', rating_selection INTEGER, rating_originality INTEGER,
    rating_fit INTEGER, rating_overall INTEGER, radio_episode_id INTEGER, person_id INTEGER, ip_hash TEXT, decided_at TEXT, ${STAMPS})`,
  `CREATE INDEX IF NOT EXISTS idx_radio_apps_status ON radio_applications (status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_radio_apps_email ON radio_applications (email)`,
  `CREATE TABLE IF NOT EXISTS radio_application_events (id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES radio_applications(id) ON DELETE CASCADE, kind TEXT NOT NULL,
    from_status TEXT, to_status TEXT, subject TEXT, body TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_radio_app_events ON radio_application_events (application_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS email_templates (key TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, subject TEXT NOT NULL,
    heading TEXT, body TEXT NOT NULL, cta_label TEXT, notes TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL)`,
]

let ready = null
export function ensureCommunity(env) {
  if (!ready) {
    ready = migrate(env.DB).catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}

async function migrate(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT)").run()
  const row = await db.prepare("SELECT value FROM site_settings WHERE key = 'community_version'").first()
  if (row && Number(row.value) >= COMMUNITY_VERSION) return
  await db.batch([...BASE, ...DDL].map((sql) => db.prepare(sql)))
  await db.batch([
    ...DEFAULT_TEMPLATES.map((t) =>
      db
        .prepare("INSERT OR IGNORE INTO email_templates (key, name, kind, subject, heading, body, cta_label, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
        .bind(t.key, t.name, t.kind, t.subject, t.heading || null, t.body, t.cta_label || null, t.notes || null),
    ),
    db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES ('notify_applications', 'on')"),
    db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES ('member_digest', 'weekly')"),
    db.prepare("INSERT INTO site_settings (key, value) VALUES ('community_version', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(COMMUNITY_VERSION)),
  ])
}

export async function getSetting(db, key, fallback = null) {
  const r = await db.prepare("SELECT value FROM site_settings WHERE key = ?1").bind(key).first()
  return r ? r.value : fallback
}

export async function setSetting(db, key, value) {
  await db.prepare("INSERT INTO site_settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value)).run()
}
