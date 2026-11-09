// Members and ROUGE Radio applications: validation, abuse protection, consent records and emails.
// Exports no request handlers, so Pages does not turn this into a route.

import { json, setting, baseUrl, signedToken, safeEqual, sendWithResend, unsubscribeUrl, listUnsubscribeHeaders, escapeHtml } from "../rouge.js"
import { ensureCommunity, getSetting, setSetting } from "./schema.js"
import { loadTemplate, renderEmail } from "./templates.js"

export const MUSIC = { rnb: "R&B", soul: "Soul / neo-soul", house: "House", garage: "UK garage", amapiano: "Amapiano", hiphop: "Hip-hop", other: "Other" }
export const TOPICS = { events: "ROUGE events", radio: "ROUGE Radio" }
export const RADIO_GENRES = {
  rnb: "R&B", soul: "Soul / neo-soul", soulful_house: "Soulful house", deep_house: "Deep house", classic_house: "Classic house",
  garage: "UK garage", amapiano: "Amapiano", hiphop: "Hip-hop", disco_funk: "Disco / funk", electronic: "Electronic", other: "Other",
}
export const PERFORMANCE = { vinyl: "Vinyl", digital: "Digital", hybrid: "Hybrid" }
export const CAN_RECORD = { yes: "Yes", no: "No", not_sure: "Not sure yet" }
export const ACKS = {
  no_guarantee: "Applying doesn't guarantee selection.",
  no_schedule: "ROUGE Radio hasn't announced a confirmed broadcast schedule.",
  rights: "I'm entitled to submit and share the material I've provided.",
  permissions: "Recording, promotion and distribution would be agreed separately if I'm selected.",
  licensing: "Music licensing and distribution requirements are reviewed before any mix is released.",
}
export const CONSENT_WORDING = "Yes, email me about ROUGE gatherings, ROUGE Radio and what's taking shape. I can unsubscribe at any time."
export const PRIVACY_WORDING = "I've read the ROUGE privacy notice."

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i

export class FormError extends Error {
  constructor(message, field) {
    super(message)
    this.field = field
  }
}

// ---------- request hygiene ----------

// Public forms only accept same-site JSON. Browsers can't send JSON cross-site without a CORS preflight,
// which these routes never approve, so this doubles as CSRF protection.
export function publicPostAllowed(request) {
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return false
  const origin = request.headers.get("Origin")
  if (!origin || origin === "null") return true
  const here = new URL(request.url)
  try {
    const o = new URL(origin)
    return o.host === here.host || o.host.replace(/^www\./, "") === here.host.replace(/^www\./, "")
  } catch {
    return false
  }
}

export async function readBody(request, max = 40000) {
  const text = await request.text()
  if (text.length > max) throw new FormError("That's too much text. Please shorten your answers.")
  try {
    return JSON.parse(text || "{}")
  } catch {
    throw new FormError("Something went wrong sending the form. Please try again.")
  }
}

export async function ipHash(env, request) {
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown"
  return (await signedToken(env, `rouge-ip:v1:${ip}`)).slice(0, 22)
}

// Fixed-window counter in D1. Returns false once `limit` is exceeded within `seconds`.
export async function rateLimit(db, key, limit, seconds) {
  const now = Math.floor(Date.now() / 1000)
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, window_start) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.window_start <= ?3 THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start <= ?3 THEN ?2 ELSE rate_limits.window_start END
       RETURNING count`,
    )
    .bind(key, now, now - seconds)
    .first()
  return !row || row.count <= limit
}

const clean = (v, max) => {
  const s = String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()
  return s.length > max ? s.slice(0, max) : s
}

function words(s) {
  return String(s || "").trim().split(/\s+/).filter(Boolean).length
}

export function cleanEmail(v) {
  const e = clean(v, 254).toLowerCase()
  if (!EMAIL_RE.test(e)) throw new FormError("Please enter a valid email address.", "email")
  return e
}

function pickList(v, allowed) {
  const list = Array.isArray(v) ? v : []
  return [...new Set(list.map(String).filter((x) => Object.prototype.hasOwnProperty.call(allowed, x)))]
}

function cleanHandle(v) {
  let s = clean(v, 120)
  if (!s) return null
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").replace(/^@/, "")
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) throw new FormError("That doesn't look like an Instagram username.", "instagram")
  return "@" + s
}

// Only public http(s) links, no credentials, no local or private hosts.
export function cleanUrl(v, field, { required = false } = {}) {
  let s = clean(v, 500)
  if (!s) {
    if (required) throw new FormError("Please add a link.", field)
    return null
  }
  if (!/^https?:\/\//i.test(s)) s = "https://" + s
  let u
  try {
    u = new URL(s)
  } catch {
    throw new FormError("That link doesn't look right. Copy it from your browser's address bar.", field)
  }
  const host = u.hostname.toLowerCase()
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || !host.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new FormError("Please use a public link (for example SoundCloud, Mixcloud or YouTube).", field)
  }
  u.hash = ""
  return u.toString()
}

const MIX_HOSTS = ["soundcloud.com", "on.soundcloud.com", "mixcloud.com", "youtube.com", "youtu.be", "m.youtube.com", "bandcamp.com", "hearthis.at", "nts.live", "audiomack.com", "drive.google.com", "dropbox.com", "vimeo.com", "spotify.com", "twitch.tv"]
export function mixHostKnown(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "")
    return MIX_HOSTS.some((d) => h === d || h.endsWith("." + d))
  } catch {
    return false
  }
}

function randomRef(prefix, n = 6) {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return prefix + [...bytes].map((b) => alphabet[b % alphabet.length]).join("")
}

// ---------- tokens ----------

export async function confirmToken(env, signupId, nonce) {
  return signedToken(env, `rouge-member-confirm:v1:${signupId}:${nonce}`)
}
export async function prefsToken(env, signupId) {
  return signedToken(env, `rouge-member-prefs:v1:${signupId}`)
}
export async function prefsUrl(env, signupId) {
  return `${baseUrl(env)}/members/preferences?u=${signupId}&t=${await prefsToken(env, signupId)}`
}
export async function verifyPrefs(env, u, t) {
  if (!/^\d{1,12}$/.test(String(u || "")) || typeof t !== "string" || t.length > 100) return false
  return safeEqual(await prefsToken(env, u), t)
}

// ---------- members ----------

function canEmail(env) {
  return !!String(env.RESEND_API_KEY || "").trim()
}

async function logConsent(db, signupId, kind, { source = null, wording = null, ip = null, ua = null } = {}) {
  await db.prepare("INSERT INTO consent_events (signup_id, kind, source, wording, ip_hash, user_agent) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(signupId, kind, source, wording, ip, ua ? String(ua).slice(0, 160) : null).run()
}

export function memberInput(body) {
  const firstName = clean(body.firstName, 60)
  if (!firstName) throw new FormError("Please tell us your first name.", "firstName")
  const email = cleanEmail(body.email)
  if (body.privacyAccepted !== true) throw new FormError("Please confirm you've read the privacy notice.", "privacy")
  return {
    firstName,
    email,
    instagram: cleanHandle(body.instagram),
    location: clean(body.location, 80) || null,
    interests: pickList(body.interests, MUSIC),
    topics: pickList(body.topics, TOPICS),
    consent: body.marketingConsent === true,
    source: clean(body.source, 80) || "rouge-london.com/members",
  }
}

// Join or re-join. Always answers the same way, so nobody can test whether an address is on the list.
// Details only take effect once the address owner clicks the confirmation link.
export async function joinMember(env, request, input, { ip }) {
  const db = env.DB
  if (!(await rateLimit(db, `join-email:${input.email}`, 3, 3600))) return { ok: true, throttled: true }
  let signup = await db.prepare("SELECT * FROM signups WHERE email = ?1").bind(input.email).first()
  if (!signup) {
    signup = await db
      .prepare("INSERT INTO signups (email, first_name, marketing_consent, source) VALUES (?1, ?2, 0, ?3) ON CONFLICT(email) DO UPDATE SET email = excluded.email RETURNING *")
      .bind(input.email, input.firstName, `members:${input.source}`)
      .first()
  }
  const pending = JSON.stringify({ firstName: input.firstName, instagram: input.instagram, location: input.location, interests: input.interests, topics: input.topics, consent: input.consent, source: input.source, at: new Date().toISOString() })
  const nonce = randomRef("", 16)
  const profile = await db.prepare("SELECT * FROM member_profiles WHERE signup_id = ?1").bind(signup.id).first()
  const recentlySent = profile && profile.confirm_sent_at && Date.now() - Date.parse(profile.confirm_sent_at + "Z") < 10 * 60 * 1000
  if (profile) {
    await db.prepare("UPDATE member_profiles SET pending = ?1, confirm_nonce = ?2, updated_at = datetime('now') WHERE signup_id = ?3").bind(pending, nonce, signup.id).run()
  } else {
    await db.prepare("INSERT INTO member_profiles (signup_id, member_uid, pending, confirm_nonce) VALUES (?1, ?2, ?3, ?4)").bind(signup.id, randomRef("RM-", 8), pending, nonce).run()
  }
  const ua = request.headers.get("User-Agent")
  await logConsent(db, signup.id, "privacy_acknowledged", { source: input.source, wording: PRIVACY_WORDING, ip, ua })
  if (input.consent) await logConsent(db, signup.id, "marketing_opt_in_requested", { source: input.source, wording: CONSENT_WORDING, ip, ua })
  if (!recentlySent && canEmail(env)) {
    const url = `${baseUrl(env)}/members/confirm?u=${signup.id}&n=${nonce}&t=${await confirmToken(env, signup.id, nonce)}`
    const tpl = await loadTemplate(db, "member_confirm")
    const mail = renderEmail(tpl, { first_name: input.firstName }, { ctaUrl: url, footer: ["You're receiving this because someone used this address to join ROUGE at rouge-london.com. If it wasn't you, ignore it."] })
    const sent = await sendWithResend(env, { to: input.email, ...mail, tags: [{ name: "kind", value: "member_confirm" }] })
    if (sent.ok) await db.prepare("UPDATE member_profiles SET confirm_sent_at = datetime('now') WHERE signup_id = ?1").bind(signup.id).run()
    else console.error("member confirm email failed:", sent.error)
  }
  // A light-touch digest for the admin rides along with sign-ups instead of a scheduler.
  await maybeSendDigest(env).catch((e) => console.error("digest failed:", e && e.message))
  return { ok: true }
}

export async function confirmMember(env, request, body, { ip }) {
  const db = env.DB
  const id = String(body.u || "")
  const nonce = String(body.n || "")
  if (!/^\d{1,12}$/.test(id) || !/^[0-9A-Z]{16}$/.test(nonce) || typeof body.t !== "string") return { ok: false, reason: "invalid" }
  if (!safeEqual(await confirmToken(env, id, nonce), body.t)) return { ok: false, reason: "invalid" }
  const profile = await db.prepare("SELECT p.*, s.email, s.first_name, s.marketing_consent FROM member_profiles p JOIN signups s ON s.id = p.signup_id WHERE p.signup_id = ?1").bind(Number(id)).first()
  if (!profile) return { ok: false, reason: "invalid" }
  if (profile.confirm_nonce !== nonce) return profile.verified_at ? { ok: true, already: true, firstName: profile.first_name } : { ok: false, reason: "expired" }
  if (profile.confirm_sent_at && Date.now() - Date.parse(profile.confirm_sent_at + "Z") > 14 * 86400000) return { ok: false, reason: "expired" }
  let p = {}
  try {
    p = JSON.parse(profile.pending || "{}") || {}
  } catch {}
  const ua = request.headers.get("User-Agent")
  const stmts = [
    db
      .prepare("UPDATE member_profiles SET instagram = COALESCE(?1, instagram), location = COALESCE(?2, location), interests = ?3, topics = ?4, verified_at = COALESCE(verified_at, datetime('now')), privacy_accepted_at = COALESCE(privacy_accepted_at, datetime('now')), pending = NULL, confirm_nonce = NULL, updated_at = datetime('now') WHERE signup_id = ?5")
      .bind(p.instagram || null, p.location || null, JSON.stringify(p.interests || JSON.parse(profile.interests || "[]")), JSON.stringify(p.topics || JSON.parse(profile.topics || "[]")), profile.signup_id),
    db.prepare("UPDATE signups SET first_name = COALESCE(NULLIF(?1, ''), first_name) WHERE id = ?2").bind(p.firstName || "", profile.signup_id),
  ]
  if (p.consent) {
    stmts.push(
      db.prepare("UPDATE signups SET marketing_consent = 1 WHERE id = ?1").bind(profile.signup_id),
      db.prepare("DELETE FROM unsubscribes WHERE email = ?1").bind(profile.email),
    )
  }
  await db.batch(stmts)
  if (!profile.verified_at) await logConsent(db, profile.signup_id, "email_verified", { source: p.source, ip, ua })
  if (p.consent) await logConsent(db, profile.signup_id, "marketing_opt_in_confirmed", { source: p.source, wording: CONSENT_WORDING, ip, ua })
  const consented = p.consent || profile.marketing_consent === 1
  if (consented && !profile.welcomed_at && canEmail(env)) {
    const tpl = await loadTemplate(db, "member_welcome")
    const unsub = await unsubscribeUrl(env, profile.signup_id)
    const prefs = await prefsUrl(env, profile.signup_id)
    const mail = renderEmail(tpl, { first_name: p.firstName || profile.first_name || "there" }, {
      ctaUrl: `${baseUrl(env)}/archive`,
      footer: [`You're receiving this because you joined ROUGE. <a href="${escapeHtml(prefs)}" style="color:#948480;">Manage your preferences</a> · <a href="${escapeHtml(unsub)}" style="color:#948480;">Unsubscribe</a>`],
    })
    const sent = await sendWithResend(env, { to: profile.email, ...mail, headers: listUnsubscribeHeaders(unsub), tags: [{ name: "kind", value: "member_welcome" }] })
    if (sent.ok) await db.prepare("UPDATE member_profiles SET welcomed_at = datetime('now') WHERE signup_id = ?1").bind(profile.signup_id).run()
  }
  return { ok: true, firstName: p.firstName || profile.first_name, consented, prefs: await prefsUrl(env, profile.signup_id) }
}

export async function memberPreferences(env, u) {
  const db = env.DB
  const row = await db
    .prepare("SELECT s.id, s.email, s.first_name, s.marketing_consent, s.created_at, p.member_uid, p.instagram, p.location, p.interests, p.topics, p.verified_at, (SELECT 1 FROM unsubscribes x WHERE x.email = s.email) AS unsubscribed FROM signups s LEFT JOIN member_profiles p ON p.signup_id = s.id WHERE s.id = ?1")
    .bind(Number(u))
    .first()
  if (!row) return null
  const masked = row.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "•".repeat(Math.min(6, b.length)) + c)
  return {
    firstName: row.first_name,
    email: masked,
    instagram: row.instagram,
    location: row.location,
    interests: JSON.parse(row.interests || "[]"),
    topics: JSON.parse(row.topics || "[]"),
    marketing: row.marketing_consent === 1 && !row.unsubscribed,
    joined: row.created_at,
    memberId: row.member_uid,
  }
}

export async function updatePreferences(env, request, u, body, { ip }) {
  const db = env.DB
  const id = Number(u)
  const s = await db.prepare("SELECT * FROM signups WHERE id = ?1").bind(id).first()
  if (!s) return false
  const firstName = clean(body.firstName, 60) || s.first_name
  const instagram = cleanHandle(body.instagram)
  const location = clean(body.location, 80) || null
  const interests = pickList(body.interests, MUSIC)
  const topics = pickList(body.topics, TOPICS)
  const marketing = body.marketing === true
  const prof = await db.prepare("SELECT signup_id FROM member_profiles WHERE signup_id = ?1").bind(id).first()
  const stmts = [db.prepare("UPDATE signups SET first_name = ?1, marketing_consent = ?2 WHERE id = ?3").bind(firstName, marketing ? 1 : 0, id)]
  if (prof) stmts.push(db.prepare("UPDATE member_profiles SET instagram = ?1, location = ?2, interests = ?3, topics = ?4, verified_at = COALESCE(verified_at, datetime('now')), updated_at = datetime('now') WHERE signup_id = ?5").bind(instagram, location, JSON.stringify(interests), JSON.stringify(topics), id))
  else stmts.push(db.prepare("INSERT INTO member_profiles (signup_id, member_uid, instagram, location, interests, topics, verified_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))").bind(id, randomRef("RM-", 8), instagram, location, JSON.stringify(interests), JSON.stringify(topics)))
  if (marketing) stmts.push(db.prepare("DELETE FROM unsubscribes WHERE email = ?1").bind(s.email))
  else stmts.push(db.prepare("INSERT OR IGNORE INTO unsubscribes (email, method) VALUES (?1, 'preferences')").bind(s.email), db.prepare("DELETE FROM deliveries WHERE signup_id = ?1 AND status = 'pending'").bind(id))
  try {
    await db.batch(stmts)
  } catch (e) {
    // deliveries may not exist on a brand-new database
    if (!/no such table/i.test(String(e && e.message))) throw e
    await db.batch(stmts.slice(0, -1))
  }
  const was = s.marketing_consent === 1
  const ua = request.headers.get("User-Agent")
  if (marketing !== was) await logConsent(db, id, marketing ? "marketing_opt_in_confirmed" : "marketing_opt_out", { source: "preferences page", wording: marketing ? CONSENT_WORDING : null, ip, ua })
  await logConsent(db, id, "preferences_updated", { source: "preferences page", ip, ua })
  return true
}

// Right to erasure: removes the list entry, profile, consent log and any delivery records.
export async function eraseMember(db, signupId) {
  const s = await db.prepare("SELECT email FROM signups WHERE id = ?1").bind(signupId).first()
  if (!s) return false
  const stmts = [
    db.prepare("DELETE FROM consent_events WHERE signup_id = ?1").bind(signupId),
    db.prepare("DELETE FROM member_profiles WHERE signup_id = ?1").bind(signupId),
    db.prepare("DELETE FROM unsubscribes WHERE email = ?1").bind(s.email),
    db.prepare("DELETE FROM signups WHERE id = ?1").bind(signupId),
  ]
  try {
    await db.batch([db.prepare("DELETE FROM deliveries WHERE signup_id = ?1").bind(signupId), ...stmts])
  } catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e
    await db.batch(stmts)
  }
  return true
}

// ---------- ROUGE Radio applications ----------

export function radioInput(body) {
  const artist = clean(body.artistName, 80)
  if (!artist) throw new FormError("Please add your DJ or artist name.", "artistName")
  const email = cleanEmail(body.email)
  const location = clean(body.location, 80)
  if (!location) throw new FormError("Where are you based?", "location")
  const profile = cleanUrl(body.profileUrl && !/^@/.test(String(body.profileUrl).trim()) ? body.profileUrl : body.profileUrl ? `https://instagram.com/${String(body.profileUrl).trim().slice(1)}` : "", "profileUrl", { required: true })
  const bio = clean(body.bio, 1500)
  if (words(bio) < 5) throw new FormError("Tell us a little about yourself (a few sentences).", "bio")
  if (words(bio) > 200) throw new FormError("Please keep your bio under 200 words.", "bio")
  const genres = pickList(body.genres, RADIO_GENRES)
  if (!genres.length) throw new FormError("Pick at least one sound.", "genres")
  const style = clean(body.selectionStyle, 1500)
  if (words(style) < 5) throw new FormError("Tell us about your selection style.", "selectionStyle")
  if (words(style) > 200) throw new FormError("Please keep this under 200 words.", "selectionStyle")
  const mix = cleanUrl(body.mixUrl, "mixUrl", { required: true })
  const mix2 = cleanUrl(body.mixUrl2, "mixUrl2")
  const concept = clean(body.sessionConcept, 1200)
  if (words(concept) < 3) throw new FormError("Tell us the kind of session you'd like to create.", "sessionConcept")
  if (words(concept) > 150) throw new FormError("Please keep your idea under 150 words.", "sessionConcept")
  const acks = pickList(body.acknowledgements, ACKS)
  if (acks.length !== Object.keys(ACKS).length) throw new FormError("Please confirm each of the points in Final details.", "acknowledgements")
  if (body.contactOk !== true) throw new FormError("We need your OK to contact you about your application.", "contactOk")
  const opt = (k, max) => clean(body[k], max) || null
  return {
    artist_name: artist,
    full_name: opt("fullName", 100),
    pronouns: opt("pronouns", 40),
    email,
    location,
    profile_url: profile,
    website: cleanUrl(body.website, "website"),
    other_socials: opt("otherSocials", 300),
    bio,
    genres: JSON.stringify(genres),
    genre_other: genres.includes("other") ? opt("genreOther", 80) : null,
    selection_style: style,
    mix_url: mix,
    mix_url_2: mix2,
    mix_why: opt("mixWhy", 800),
    session_concept: concept,
    session_different: opt("sessionDifferent", 800),
    session_title: opt("sessionTitle", 100),
    mix_length: opt("mixLength", 40),
    performance: Object.prototype.hasOwnProperty.call(PERFORMANCE, body.performance) ? body.performance : null,
    can_record: Object.prototype.hasOwnProperty.call(CAN_RECORD, body.canRecord) ? body.canRecord : null,
    technical_notes: opt("technicalNotes", 600),
    discovery: opt("discovery", 200),
    extra: opt("extra", 800),
    contact_ok: 1,
    acknowledgements: JSON.stringify({ accepted: acks, at: new Date().toISOString(), wording: ACKS }),
    marketing_opt_in: body.joinMembers === true ? 1 : 0,
    submission_key: /^[A-Za-z0-9-]{16,64}$/.test(String(body.submissionKey || "")) ? String(body.submissionKey) : null,
  }
}

export async function submitApplication(env, request, input, { ip }) {
  const db = env.DB
  if (input.submission_key) {
    const dup = await db.prepare("SELECT ref FROM radio_applications WHERE submission_key = ?1").bind(input.submission_key).first()
    if (dup) return { ok: true, ref: dup.ref, duplicate: true }
  }
  const recent = await db.prepare("SELECT ref FROM radio_applications WHERE email = ?1 AND mix_url = ?2 AND created_at > datetime('now', '-30 days')").bind(input.email, input.mix_url).first()
  if (recent) return { ok: true, ref: recent.ref, duplicate: true }
  if (!(await rateLimit(db, `apply-email:${input.email}`, 3, 86400))) throw new FormError("We've already received a few applications from this email today. Please try again tomorrow.")
  const ref = randomRef("RR-")
  const cols = Object.keys(input)
  const app = await db
    .prepare(`INSERT INTO radio_applications (ref, ip_hash, ${cols.join(", ")}) VALUES (?1, ?2, ${cols.map((_, i) => `?${i + 3}`).join(", ")}) RETURNING *`)
    .bind(ref, ip, ...cols.map((c) => input[c]))
    .first()
  await db.prepare("INSERT INTO radio_application_events (application_id, kind, to_status, body) VALUES (?1, 'system', 'new', 'Application received through rouge-london.com/radio/apply')").bind(app.id).run()

  if (canEmail(env)) {
    const tpl = await loadTemplate(db, "radio_received")
    const mail = renderEmail(tpl, { artist_name: app.artist_name, ref }, { label: "ROUGE RADIO", footer: ["You're receiving this because you applied to play on ROUGE Radio. This isn't a marketing email."] })
    const sent = await sendWithResend(env, { to: app.email, ...mail, from: setting(env, "RADIO_FROM"), replyTo: setting(env, "RADIO_REPLY_TO"), idempotencyKey: `radio-ack-${ref}`, tags: [{ name: "kind", value: "radio_received" }] })
    await db.prepare("INSERT INTO radio_application_events (application_id, kind, subject, body) VALUES (?1, 'email', ?2, ?3)").bind(app.id, mail.subject, sent.ok ? "Automatic acknowledgement sent." : `Acknowledgement failed: ${sent.error}`).run()
    if ((await getSetting(db, "notify_applications", "on")) === "on") {
      const genres = JSON.parse(app.genres).map((g) => RADIO_GENRES[g] || g).join(", ")
      const admin = setting(env, "ADMIN_EMAILS").split(",")[0].trim()
      if (admin) {
        const n = renderEmail(
          { subject: `New ROUGE Radio application: ${app.artist_name}`, heading: app.artist_name, body: `${app.location} · ${genres}\n\n${app.session_concept}\n\nOpen it in ROUGE HQ to listen and review.`, cta_label: "Review in HQ" },
          {},
          { ctaUrl: `${baseUrl(env)}/admin/hq/radio/applications/${app.id}`, label: "ROUGE HQ · RADIO", footer: ["Admin notification. Turn these off in ROUGE HQ → Settings."] },
        )
        await sendWithResend(env, { to: admin, ...n, from: setting(env, "RADIO_FROM"), tags: [{ name: "kind", value: "admin_notification" }] })
      }
    }
  }
  if (input.marketing_opt_in) {
    const firstName = (app.full_name || app.artist_name).split(/\s+/)[0]
    await joinMember(env, request, { firstName, email: app.email, instagram: null, location: app.location, interests: [], topics: ["radio"], consent: true, source: "radio application" }, { ip })
  }
  return { ok: true, ref }
}

// ---------- admin digest (optional; rides along with new sign-ups) ----------

export async function maybeSendDigest(env) {
  const db = env.DB
  const mode = await getSetting(db, "member_digest", "weekly")
  if (mode !== "daily" && mode !== "weekly") return
  const last = await getSetting(db, "member_digest_last", null)
  const period = mode === "daily" ? 86400000 : 7 * 86400000
  if (!last) return setSetting(db, "member_digest_last", new Date().toISOString())
  if (Date.now() - Date.parse(last) < period) return
  const since = new Date(Date.parse(last)).toISOString().replace("T", " ").slice(0, 19)
  const r = await db.prepare("SELECT COUNT(*) AS n, SUM(marketing_consent) AS c FROM signups WHERE created_at > ?1").bind(since).first()
  const verified = await db.prepare("SELECT COUNT(*) AS n FROM member_profiles WHERE verified_at > ?1").bind(since).first()
  await setSetting(db, "member_digest_last", new Date().toISOString())
  const admin = setting(env, "ADMIN_EMAILS").split(",")[0].trim()
  if (!admin || !canEmail(env)) return
  const mail = renderEmail(
    { subject: `ROUGE members: ${r.n || 0} new since ${since.slice(0, 10)}`, heading: `${r.n || 0} new`, body: `Since ${since.slice(0, 10)}: ${r.n || 0} new sign-ups, ${verified.n || 0} confirmed their email.\n\nOpen ROUGE HQ to see who joined and what they're into.`, cta_label: "Open Members" },
    {},
    { ctaUrl: `${baseUrl(env)}/admin/hq/audience/members`, label: "ROUGE HQ · MEMBERS", footer: [`${mode === "daily" ? "Daily" : "Weekly"} digest. Change or turn it off in ROUGE HQ → Settings.`] },
  )
  await sendWithResend(env, { to: admin, ...mail, tags: [{ name: "kind", value: "admin_digest" }] })
}

// ---------- retention ----------

export async function runRetention(db) {
  const out = {}
  const stale = (await db.prepare("SELECT s.id FROM signups s JOIN member_profiles p ON p.signup_id = s.id WHERE p.verified_at IS NULL AND s.marketing_consent = 0 AND s.source LIKE 'members:%' AND s.created_at < datetime('now', '-30 days')").all()).results || []
  for (const r of stale) await eraseMember(db, r.id)
  out.unconfirmed_members_removed = stale.length
  const apps = await db.prepare("DELETE FROM radio_applications WHERE status IN ('declined', 'withdrawn', 'archived') AND COALESCE(decided_at, updated_at) < datetime('now', '-12 months')").run()
  out.old_applications_removed = (apps.meta && apps.meta.changes) || 0
  await db.prepare("DELETE FROM rate_limits WHERE window_start < ?1").bind(Math.floor(Date.now() / 1000) - 2 * 86400).run()
  await db.prepare("UPDATE member_profiles SET pending = NULL, confirm_nonce = NULL WHERE pending IS NOT NULL AND updated_at < datetime('now', '-30 days')").run()
  await setSetting(db, "retention_last_run", new Date().toISOString())
  return out
}

export { ensureCommunity, json }
