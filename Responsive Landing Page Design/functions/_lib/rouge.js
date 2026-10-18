// Shared helpers for the ROUGE invitation system.
// This file exports no request handlers, so Cloudflare Pages does not turn it into a route.

const enc = new TextEncoder()
const dec = new TextDecoder()

// A subscriber is eligible only if they consented and are not on the unsubscribe list.
// Used inside queries where the signups table is aliased as "s".
export const ELIGIBLE_SQL =
  "s.marketing_consent = 1 AND NOT EXISTS (SELECT 1 FROM unsubscribes u WHERE u.email = lower(s.email))"

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  )
}

// "Roshni Basra" -> "Roshni", "taran" -> "Taran", "" -> "" (template then says "Hey there,").
export function greetingName(raw) {
  const first = String(raw ?? "").trim().split(/\s+/)[0] || ""
  const cleaned = first.replace(/[^\p{L}\p{M}'’-]/gu, "").slice(0, 40)
  if (!cleaned) return ""
  if (cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
  }
  return cleaned
}

// Non-secret settings have sensible defaults here, so only secrets need adding in Cloudflare.
// Any of these can still be overridden with a Cloudflare variable of the same name.
const DEFAULTS = {
  MAIL_FROM: "Dev at ROUGE <invites@rouge-london.com>",
  REPLY_TO: "dev.basra@icloud.com",
  PUBLIC_BASE_URL: "https://www.rouge-london.com",
  ADMIN_EMAILS: "dev.basra@icloud.com",
  TEST_RECIPIENTS: "dev.basra@icloud.com,devbasra@hotmail.co.uk",
}

export function setting(env, name) {
  const value = env[name] != null ? String(env[name]).trim() : ""
  return value || DEFAULTS[name] || ""
}

// One secret signs unsubscribe links and admin sessions (each with its own prefix).
export function appSecret(env) {
  return String(env.APP_SECRET || env.UNSUBSCRIBE_SECRET || "").trim()
}

export function missingConfig(env, names) {
  return names.filter((name) => {
    if (name === "APP_SECRET") return appSecret(env).length < 16
    if (name === "ADMIN_PASSWORD") return String(env.ADMIN_PASSWORD || "").length < 16
    return !setting(env, name)
  })
}

export function baseUrl(env) {
  return setting(env, "PUBLIC_BASE_URL").replace(/\/+$/, "")
}

export function listFromEnv(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------- encoding ----------

function bytesToBase64(bytes) {
  let bin = ""
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b)
  return btoa(bin)
}

function base64ToBytes(s) {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function base64UrlToBytes(s) {
  let b = s.replace(/-/g, "+").replace(/_/g, "/")
  while (b.length % 4) b += "="
  return base64ToBytes(b)
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function safeEqual(a, b) {
  a = String(a)
  b = String(b)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function hmacSha256(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)))
}

// ---------- unsubscribe links ----------

async function unsubscribeToken(env, signupId) {
  const secret = appSecret(env)
  if (secret.length < 16) throw new Error("APP_SECRET is not set")
  const mac = await hmacSha256(enc.encode(secret), `rouge-unsubscribe:v1:${signupId}`)
  return bytesToBase64Url(mac)
}

export async function unsubscribeUrl(env, signupId) {
  const token = await unsubscribeToken(env, signupId)
  return `${baseUrl(env)}/unsubscribe?u=${encodeURIComponent(signupId)}&t=${token}`
}

export function testUnsubscribeUrl(env) {
  return `${baseUrl(env)}/unsubscribe?test=1`
}

export async function verifyUnsubscribe(env, u, t) {
  if (!/^\d{1,12}$/.test(String(u || "")) || typeof t !== "string" || t.length > 100) return false
  return safeEqual(await unsubscribeToken(env, u), t)
}

// ---------- Cloudflare Access ----------

let certCache = { team: "", at: 0, keys: null }

async function accessKeys(team, force = false) {
  const fresh = Date.now() - certCache.at < 60 * 60 * 1000
  if (!force && certCache.keys && certCache.team === team && fresh) return certCache.keys
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`)
  if (!res.ok) throw new Error(`Could not load Access certificates (${res.status})`)
  const body = await res.json()
  certCache = { team, at: Date.now(), keys: Array.isArray(body.keys) ? body.keys : [] }
  return certCache.keys
}

// Returns { email } for a signed-in admin, or null. Every admin route calls this on the server.
export async function verifyAccess(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion")
  const team = String(env.ACCESS_TEAM_DOMAIN || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
  const audience = String(env.ACCESS_AUD || "").trim()
  if (!token || !team || !audience) return null

  const parts = token.split(".")
  if (parts.length !== 3) return null
  let header
  let payload
  try {
    header = JSON.parse(dec.decode(base64UrlToBytes(parts[0])))
    payload = JSON.parse(dec.decode(base64UrlToBytes(parts[1])))
  } catch {
    return null
  }
  if (header.alg !== "RS256" || !header.kid) return null

  let jwk = (await accessKeys(team)).find((k) => k.kid === header.kid)
  if (!jwk) jwk = (await accessKeys(team, true)).find((k) => k.kid === header.kid)
  if (!jwk) return null

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256" },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  )
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(parts[2]),
    enc.encode(`${parts[0]}.${parts[1]}`),
  )
  if (!valid) return null

  const now = Math.floor(Date.now() / 1000)
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!audiences.includes(audience)) return null
  if (payload.iss !== `https://${team}`) return null
  if (typeof payload.exp !== "number" || payload.exp < now - 30) return null
  if (typeof payload.nbf === "number" && payload.nbf > now + 30) return null

  const email = String(payload.email || "").toLowerCase()
  if (!email || !listFromEnv(setting(env, "ADMIN_EMAILS")).includes(email)) return null
  return { email }
}

// ---------- password login (works on www.rouge-london.com, no Cloudflare Access needed) ----------

const SESSION_COOKIE = "rouge_admin"
const SESSION_SECONDS = 12 * 60 * 60

export function passwordLoginEnabled(env) {
  return String(env.ADMIN_PASSWORD || "").length >= 16 && appSecret(env).length >= 16
}

async function sha256b64(text) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(text)))))
}

export async function checkPassword(env, given) {
  if (!passwordLoginEnabled(env) || typeof given !== "string" || given.length > 512) return false
  return safeEqual(await sha256b64(given), await sha256b64(env.ADMIN_PASSWORD))
}

// The signature includes a fingerprint of the password, so changing ADMIN_PASSWORD signs everyone out.
async function sessionSignature(env, exp) {
  const fingerprint = await sha256b64(env.ADMIN_PASSWORD)
  return bytesToBase64Url(await hmacSha256(enc.encode(appSecret(env)), `rouge-admin-session:v1:${exp}:${fingerprint}`))
}

export async function sessionCookie(env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  const value = `${exp}.${await sessionSignature(env, exp)}`
  return `${SESSION_COOKIE}=${value}; Path=/admin; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
}

async function verifySession(request, env) {
  if (!passwordLoginEnabled(env)) return null
  const cookies = request.headers.get("Cookie") || ""
  const match = cookies.match(/(?:^|;\s*)rouge_admin=(\d{1,12})\.([A-Za-z0-9_-]{20,100})/)
  if (!match) return null
  const exp = Number(match[1])
  if (exp < Math.floor(Date.now() / 1000)) return null
  if (!safeEqual(match[2], await sessionSignature(env, exp))) return null
  return { email: listFromEnv(setting(env, "ADMIN_EMAILS"))[0] || "admin", method: "password" }
}

// Accepts either a Cloudflare Access login (if configured) or a password-login session cookie.
export async function verifyAdmin(request, env) {
  let admin = null
  try {
    admin = await verifyAccess(request, env)
  } catch (err) {
    console.error("Access check failed:", err && err.message)
  }
  return admin || (await verifySession(request, env))
}

// Admin POSTs must come from the dashboard itself (blocks cross-site form posts).
export function isTrustedAdminPost(request) {
  if (request.headers.get("X-Rouge-Admin") !== "1") return false
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return false
  const origin = request.headers.get("Origin")
  if (origin && origin !== new URL(request.url).origin) return false
  return true
}

// ---------- Resend ----------

export async function sendWithResend(env, { to, subject, html, text, headers, idempotencyKey, tags }) {
  const requestHeaders = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  }
  if (idempotencyKey) requestHeaders["Idempotency-Key"] = idempotencyKey

  const body = { from: setting(env, "MAIL_FROM"), to: [to], subject, html, text }
  const replyTo = setting(env, "REPLY_TO")
  if (replyTo) body.reply_to = replyTo
  if (headers) body.headers = headers
  if (tags) body.tags = tags

  let res
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, status: 0, rateLimited: false, error: "Could not reach Resend (network error)" }
  }
  let data = {}
  try {
    data = await res.json()
  } catch {}
  if (res.ok && data.id) return { ok: true, id: data.id }
  const reason = String(data.message || data.name || "unknown error").slice(0, 300)
  return {
    ok: false,
    status: res.status,
    rateLimited: res.status === 429,
    error: `Resend ${res.status}: ${reason}`,
  }
}

export function listUnsubscribeHeaders(url) {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}

// ---------- Resend webhooks (signed with Svix) ----------

export async function verifyWebhook(env, request, rawBody) {
  const secret = String(env.RESEND_WEBHOOK_SECRET || "")
  const id = request.headers.get("svix-id")
  const timestamp = request.headers.get("svix-timestamp")
  const signatures = request.headers.get("svix-signature")
  if (!secret || !id || !timestamp || !signatures) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 5 * 60) return false

  let keyBytes
  try {
    keyBytes = base64ToBytes(secret.startsWith("whsec_") ? secret.slice(6) : secret)
  } catch {
    return false
  }
  const expected = bytesToBase64(await hmacSha256(keyBytes, `${id}.${timestamp}.${rawBody}`))
  return signatures
    .split(" ")
    .map((entry) => entry.split(",")[1] || "")
    .some((sig) => safeEqual(sig, expected))
}
