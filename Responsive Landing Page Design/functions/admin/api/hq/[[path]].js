// ROUGE HQ API: everything under /admin/api/hq/. Protected by functions/admin/_middleware.js, so only a
// signed-in admin reaches this file. Writes also need the dashboard's own header and same-origin requests.
//
//   GET    boot | dashboard | finance | audience | search?q= | calendar?from=&to= | export
//   GET    event/:id                        full workspace for one event
//   POST   event/:id/template|schedule|run-template|save-template|milestones
//   POST   reorder                          { type, ids }
//   POST   convert/idea/:id                 { to, event_id }
//   GET    t/:type  POST t/:type  GET|PATCH|DELETE t/:type/:id      (types in _lib/hq/registry.js)
//   POST   ai/chat                          streams Anthropic events
//   POST   research   POST research/:id/run (streams)   POST research/:id/finish
//   POST   files?name=&event_id=…  (raw body, needs the HQ_FILES R2 binding)   GET files/:id
//   POST   shares   POST shares/:id/revoke

import { json } from "../../../_lib/rouge.js"
import { ensureHq } from "../../../_lib/hq/schema.js"
import { InputError, TYPES } from "../../../_lib/hq/registry.js"
import * as api from "../../../_lib/hq/api.js"
import * as ai from "../../../_lib/hq/ai.js"

function trustedWrite(request, allowBinary) {
  if (request.headers.get("X-Rouge-Admin") !== "1") return false
  const type = request.headers.get("Content-Type") || ""
  if (!allowBinary && !type.startsWith("application/json")) return false
  // The custom header already stops cross-site requests (browsers can't add it without CORS).
  const origin = request.headers.get("Origin")
  if (origin && origin !== "null" && origin !== new URL(request.url).origin) return false
  return true
}

async function readJson(request) {
  const text = await request.text()
  if (!text) return {}
  if (text.length > 8_000_000) throw new InputError("That request is too large.")
  try {
    return JSON.parse(text)
  } catch {
    throw new InputError("Invalid JSON")
  }
}

export async function onRequest(context) {
  const { request, env, params, data } = context
  const parts = (Array.isArray(params.path) ? params.path : params.path ? [params.path] : []).map(String)
  const method = request.method
  const url = new URL(request.url)
  if (!env.DB) return json({ error: "The D1 binding DB is missing." }, 500)

  const isUpload = method === "POST" && parts[0] === "files" && parts.length === 1
  if (method !== "GET" && method !== "HEAD" && !trustedWrite(request, isUpload)) return json({ error: "Request blocked." }, 403)

  try {
    await ensureHq(env)
    const db = env.DB
    const [a, b, c, d] = parts

    if (method === "GET") {
      if (a === "boot" && !b) return await api.boot(db, env, data && data.admin)
      if (a === "dashboard" && !b) return await api.dashboard(db)
      if (a === "finance" && !b) return await api.finance(db)
      if (a === "audience" && !b) return await api.audience(db)
      if (a === "search" && !b) return await api.search(db, url)
      if (a === "calendar" && !b) return await api.calendar(db, url)
      if (a === "export" && !b) return await api.exportAll(db)
      if (a === "event" && b && !c) return await api.eventWorkspace(db, b)
      if (a === "files" && b && !c) return await api.downloadFile(db, env, b, url)
      if (a === "t" && TYPES[b] && !c) return await api.listRecords(db, b, url)
      if (a === "t" && TYPES[b] && c && !d) return await api.getRecord(db, b, c)
      return json({ error: "Not found" }, 404)
    }

    if (method === "POST") {
      if (isUpload) return await api.uploadFile(db, env, request, url)
      const body = await readJson(request)
      if (a === "t" && TYPES[b] && !c) return await api.createRecord(db, b, body)
      if (a === "event" && b && c && !d) {
        if (c === "template") return await api.applyTemplate(db, b, body)
        if (c === "schedule") return await api.scheduleFromDate(db, b, body)
        if (c === "run-template") return await api.runTemplate(db, b)
        if (c === "save-template") return await api.saveAsTemplate(db, b, body)
        if (c === "milestones") return await api.addMilestones(db, b)
      }
      if (a === "reorder" && !b) return await api.reorder(db, body)
      if (a === "convert" && b === "idea" && c && !d) return await api.convertIdea(db, c, body)
      if (a === "ai" && b === "chat" && !c) return await ai.chat(db, env, body)
      if (a === "research" && !b) return await ai.startResearch(db, body)
      if (a === "research" && b && c === "run" && !d) return await ai.runResearch(db, env, b, body)
      if (a === "research" && b && c === "finish" && !d) return await ai.finishResearch(db, b, body)
      if (a === "shares" && !b) return await api.createShare(db, env, body)
      if (a === "shares" && b && c === "revoke" && !d) return await api.revokeShare(db, b)
      return json({ error: "Not found" }, 404)
    }

    if (method === "PATCH" && a === "t" && TYPES[b] && c && !d) return await api.updateRecord(db, b, c, await readJson(request))
    if (method === "DELETE" && a === "t" && TYPES[b] && c && !d) return await api.deleteRecord(db, env, b, c)
    return json({ error: "Method not allowed" }, 405)
  } catch (err) {
    if (err instanceof InputError) return json({ error: err.message }, 400)
    console.error(`hq/${parts.join("/")} failed:`, err && err.stack ? err.stack : err)
    return json({ error: "Something went wrong on the server. Check the function logs." }, 500)
  }
}
