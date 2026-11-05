// Shared client helpers for ROUGE HQ: API calls, routing, formatting, streaming and Markdown.
import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react"
import { Marked } from "marked"

export const BASE = "/admin/hq"
export const API = "/admin/api/hq/"

// ---------- events between components ----------
export const bus = new EventTarget()
export const emitChanged = (type) => bus.dispatchEvent(new CustomEvent("changed", { detail: { type } }))
export const toast = (message, tone = "ok") => bus.dispatchEvent(new CustomEvent("toast", { detail: { message, tone } }))

// ---------- API ----------
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api(method, path, body, opts = {}) {
  const headers = { "X-Rouge-Admin": "1" }
  let payload
  if (body !== undefined && !(body instanceof Blob)) {
    headers["Content-Type"] = "application/json"
    payload = JSON.stringify(body)
  } else if (body instanceof Blob) {
    headers["Content-Type"] = body.type || "application/octet-stream"
    payload = body
  }
  const res = await fetch(API + path, { method, headers: method === "GET" ? {} : headers, body: payload, credentials: "same-origin", signal: opts.signal })
  if (res.status === 401) {
    window.location.href = "/admin/login"
    throw new ApiError("Signed out", 401)
  }
  if (opts.raw) {
    if (!res.ok) {
      let data = {}
      try {
        data = await res.json()
      } catch {}
      throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code)
    }
    return res
  }
  let data = {}
  try {
    data = await res.json()
  } catch {}
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code)
  return data
}

export const get = (p, o) => api("GET", p, undefined, o)
export const post = (p, b) => api("POST", p, b ?? {})
export const patch = (p, b) => api("PATCH", p, b)
export const del = (p) => api("DELETE", p)

// Saves a record and tells every open view to refresh.
export async function save(type, values, id) {
  const r = id ? await patch(`t/${type}/${id}`, values) : await post(`t/${type}`, values)
  emitChanged(type)
  return r.item
}
export async function remove(type, id) {
  await del(`t/${type}/${id}`)
  emitChanged(type)
}

// Loads a path and reloads quietly whenever something changes.
export function useApi(path, { live = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path })
  const seq = useRef(0)
  const load = useCallback(
    async (quiet) => {
      if (!path) return
      const n = ++seq.current
      if (!quiet) setState((s) => ({ ...s, loading: true }))
      try {
        const data = await get(path)
        if (n === seq.current) setState({ data, error: null, loading: false })
      } catch (error) {
        if (n === seq.current) setState((s) => ({ ...s, error, loading: false }))
      }
    },
    [path],
  )
  useEffect(() => {
    load(false)
  }, [load])
  useEffect(() => {
    if (!live) return
    let t
    const on = () => {
      clearTimeout(t)
      t = setTimeout(() => load(true), 120)
    }
    bus.addEventListener("changed", on)
    return () => {
      clearTimeout(t)
      bus.removeEventListener("changed", on)
    }
  }, [load, live])
  const setData = (fn) => setState((s) => ({ ...s, data: typeof fn === "function" ? fn(s.data) : fn }))
  return { ...state, reload: () => load(true), setData }
}

// ---------- app context ----------
export const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

// ---------- routing ----------
export function navigate(to, { replace = false } = {}) {
  const url = to.startsWith("/") ? to : `${BASE}/${to}`
  if (url === window.location.pathname + window.location.search) return
  if (replace) history.replaceState(null, "", url)
  else history.pushState(null, "", url)
  window.dispatchEvent(new Event("hq:navigate"))
  window.scrollTo({ top: 0 })
}

export function useRoute() {
  const read = () => {
    const path = window.location.pathname.replace(/\/+$/, "")
    const rest = path.startsWith(BASE) ? path.slice(BASE.length) : ""
    const parts = rest.split("/").filter(Boolean).map(decodeURIComponent)
    return { parts, query: new URLSearchParams(window.location.search) }
  }
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener("popstate", on)
    window.addEventListener("hq:navigate", on)
    return () => {
      window.removeEventListener("popstate", on)
      window.removeEventListener("hq:navigate", on)
    }
  }, [])
  return route
}

export function linkProps(to) {
  const href = to.startsWith("/") ? to : `${BASE}/${to}`
  return {
    href,
    onClick: (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      navigate(href)
    },
  }
}

// ---------- formatting ----------
export function money(pence, { sign = false, dash = "—" } = {}) {
  if (pence === null || pence === undefined || pence === "") return dash
  const n = Number(pence) / 100
  const abs = Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })
  return `${n < 0 ? "−" : sign && n > 0 ? "+" : ""}£${abs}`
}

export function parseMoney(text) {
  if (text === null || text === undefined) return null
  const s = String(text).replace(/[£,\s]/g, "")
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return NaN
  return Math.round(n * 100)
}

const D = (iso) => new Date(String(iso).slice(0, 10) + "T12:00:00Z")
export const fmtDate = (iso, opts = { day: "numeric", month: "short" }) => (iso ? D(iso).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" }) : "")
export const fmtDay = (iso) => fmtDate(iso, { weekday: "short", day: "numeric", month: "short" })
export const fmtLong = (iso) => fmtDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
export const fmtFull = (iso) => fmtDate(iso, { day: "numeric", month: "short", year: "numeric" })
export const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 86400000)
export function addDays(iso, n) {
  const d = D(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function relDay(iso, today) {
  if (!iso) return ""
  const n = daysBetween(today, iso)
  if (n === 0) return "Today"
  if (n === 1) return "Tomorrow"
  if (n === -1) return "Yesterday"
  if (n < 0) return `${-n} days overdue`
  if (n < 7) return fmtDate(iso, { weekday: "long" })
  return fmtDate(iso)
}

export function timeAgo(sqlDate) {
  if (!sqlDate) return ""
  const t = Date.parse(String(sqlDate).replace(" ", "T") + (String(sqlDate).includes("Z") || String(sqlDate).includes("+") ? "" : "Z"))
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export const initials = (name) =>
  String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("")

export function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(now))
  if (h < 5) return "Late night"
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0)
export const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`

export function parseJson(text, fallback) {
  if (!text) return fallback
  try {
    return JSON.parse(text) ?? fallback
  } catch {
    return fallback
  }
}

// ---------- local preferences (per device; optional) ----------
export function pref(key, fallback) {
  try {
    const v = localStorage.getItem("hq:" + key)
    return v === null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}
export function setPref(key, value) {
  try {
    localStorage.setItem("hq:" + key, JSON.stringify(value))
  } catch {}
}

// ---------- Markdown (raw HTML is escaped; only http(s)/mailto/relative links) ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
const safeHref = (href) => {
  const h = String(href || "").trim()
  if (/^(https?:|mailto:)/i.test(h) || h.startsWith("/") || h.startsWith("#")) return h
  return null
}
const marked = new Marked({ gfm: true, breaks: true })
marked.use({
  renderer: {
    html({ text }) {
      return esc(text)
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens)
      const h = safeHref(href)
      if (!h) return text
      const cite = /^\^(\d+)$/.exec(text)
      const ext = /^https?:/i.test(h) ? ' target="_blank" rel="noopener noreferrer"' : ""
      if (cite) return `<sup class="cite"><a href="${esc(h)}"${ext}${title ? ` title="${esc(title)}"` : ""}>${cite[1]}</a></sup>`
      return `<a href="${esc(h)}"${ext}${title ? ` title="${esc(title)}"` : ""}>${text}</a>`
    },
    image({ href, text }) {
      const h = safeHref(href)
      return h ? `<a href="${esc(h)}" target="_blank" rel="noopener noreferrer">${esc(text || "image")}</a>` : esc(text)
    },
  },
})
export const md = (text) =>
  marked
    .parse(String(text || ""))
    .replace(/<table>/g, '<div class="md-table"><table>')
    .replace(/<\/table>/g, "</table></div>")

// ---------- Anthropic event streams ----------
// Reads a text/event-stream response and calls onEvent for each JSON event.
export async function readSSE(res, onEvent, signal) {
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  for (;;) {
    if (signal && signal.aborted) {
      try {
        await reader.cancel()
      } catch {}
      break
    }
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let cut
    while ((cut = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, cut)
      buf = buf.slice(cut + 2)
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue
        try {
          onEvent(JSON.parse(line.slice(5)))
        } catch {}
      }
    }
  }
}

// Builds Anthropic content blocks from a stream, keeping them in the exact shape the API accepts back.
export function blockCollector() {
  const blocks = []
  const partial = {}
  let stop = null
  let error = null
  return {
    blocks,
    get stop() {
      return stop
    },
    get error() {
      return error
    },
    handle(ev, cb = {}) {
      if (ev.type === "content_block_start") {
        const b = JSON.parse(JSON.stringify(ev.content_block))
        if (b.type === "text") b.text = b.text || ""
        if (b.type === "server_tool_use" || b.type === "tool_use") partial[ev.index] = ""
        blocks[ev.index] = b
        cb.onStart && cb.onStart(b, ev.index)
      } else if (ev.type === "content_block_delta") {
        const b = blocks[ev.index]
        if (!b) return
        const d = ev.delta
        if (d.type === "text_delta") {
          b.text += d.text
          cb.onText && cb.onText(d.text, b, ev.index)
        } else if (d.type === "input_json_delta") partial[ev.index] += d.partial_json
        else if (d.type === "citations_delta") (b.citations ||= []).push(d.citation)
      } else if (ev.type === "content_block_stop") {
        const b = blocks[ev.index]
        if (b && (b.type === "server_tool_use" || b.type === "tool_use") && partial[ev.index] !== undefined) {
          try {
            b.input = partial[ev.index] ? JSON.parse(partial[ev.index]) : b.input || {}
          } catch {
            b.input = b.input || {}
          }
          delete partial[ev.index]
        }
        cb.onStop && cb.onStop(b, ev.index)
      } else if (ev.type === "message_delta") {
        if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason
      } else if (ev.type === "error") {
        error = (ev.error && ev.error.message) || "The stream stopped."
      }
    },
  }
}

// Turns text blocks into Markdown with numbered citation markers, plus a source list.
export function citedMarkdown(blocks, sourceMap = new Map()) {
  let out = ""
  for (const b of blocks) {
    if (!b || b.type !== "text") continue
    out += b.text
    const marks = []
    for (const c of b.citations || []) {
      const url = c.url || (c.source && c.source.url) || null
      if (!url) continue
      let s = sourceMap.get(url)
      if (!s) {
        s = { url, title: c.title || c.document_title || url, cited: true }
        sourceMap.set(url, s)
      }
      s.cited = true
      if (!s.n) s.n = [...sourceMap.values()].filter((x) => x.n).length + 1
      if (!marks.includes(s.n)) marks.push(s.n)
    }
    if (marks.length) {
      const trail = out.match(/\s*$/)[0]
      out = out.slice(0, out.length - trail.length) + marks.map((n) => ` [^${n}](${[...sourceMap.values()].find((x) => x.n === n).url})`).join("") + trail
    }
  }
  return out
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

// ---------- quick actions (Home and the + button) ----------
export const QUICK = [
  ["event", "Create event", "events"],
  ["idea", "Capture idea", "bulb"],
  ["expense", "Add expense", "money"],
  ["task", "Add task", "check"],
  ["email", "Draft email", "mail"],
  ["upload", "Upload document", "upload"],
  ["campaign", "Plan campaign", "campaign"],
  ["venue", "Add venue", "venue"],
  ["ai", "Ask ROUGE AI", "ai"],
]

// ---------- labels ----------
export const EVENT_STATUS = { idea: "Idea", planning: "Planning", confirmed: "Confirmed", on_sale: "On sale", completed: "Completed", cancelled: "Cancelled" }
export const VENUE_STATUS = { prospect: "Prospect", researching: "Researching", enquired: "Enquired", awaiting: "Awaiting reply", negotiating: "Negotiating", visited: "Visited", booked: "Booked", rejected: "Rejected", past: "Worked with" }
export const TASK_STATUS = { todo: "To do", doing: "In progress", done: "Done" }
export const PRIORITY = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" }
export const CONF = { verified: "Verified", estimate: "Estimate", confirm: "To confirm" }
export const IDEA_KIND = { event: "Event", experience: "Experience", campaign: "Campaign", radio: "Radio", content: "Content", merch: "Merch", partnership: "Partnership", other: "Other" }
export const IDEA_STATUS = { spark: "Spark", developing: "Developing", converted: "Converted", parked: "Parked" }
export const NOTE_KIND = { note: "Note", brand: "Brand", brief: "Brief", sop: "How-to", meeting: "Meeting", research: "Research", email: "Email draft", debrief: "Debrief" }
export const CAMPAIGN_STATUS = { idea: "Idea", planning: "Planning", live: "Live", done: "Done" }
export const CONTENT_STATUS = { idea: "Idea", drafting: "Drafting", ready: "Ready", scheduled: "Scheduled", published: "Published" }
export const CHANNELS = { instagram: "Instagram", tiktok: "TikTok", email: "Email", website: "Website", radio: "Radio", print: "Print", other: "Other" }
export const FORMATS = { post: "Post", reel: "Reel", story: "Story", carousel: "Carousel", email: "Email", poster: "Poster", mix: "Mix", other: "Other" }
export const RADIO_STATUS = { idea: "Idea", booked: "Guest booked", recorded: "Recorded", editing: "Editing", scheduled: "Scheduled", published: "Published" }
export const LOG_KIND = { email: "Email", call: "Call", meeting: "Meeting", visit: "Visit", quote: "Quote", contract: "Contract", note: "Note" }
export const DOC_KIND = { contract: "Contract", invoice: "Invoice", receipt: "Receipt", quote: "Quote", photo: "Photo", rider: "Rider", artwork: "Artwork", email: "Email", other: "Other" }
export const MS_STATUS = { todo: "Not started", doing: "In progress", done: "Done" }

export const VENUE_SCORE = [
  ["score_econ", "Economics", 30],
  ["score_sound", "Sound & booth", 25],
  ["score_atmos", "Atmosphere", 20],
  ["score_safety", "Safety & execution", 15],
  ["score_location", "Location / weather", 10],
]
export function venueScore(v) {
  const filled = VENUE_SCORE.filter(([k]) => v[k])
  if (!filled.length) return null
  const weight = filled.reduce((s, [, , w]) => s + w, 0)
  return Math.round((filled.reduce((s, [k, , w]) => s + (Math.min(5, Math.max(0, v[k])) / 5) * w, 0) / weight) * 100)
}
