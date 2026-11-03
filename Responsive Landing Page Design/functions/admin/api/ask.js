// POST /admin/api/ask: lets the study guide (/admin/study) ask Claude a question.
// Protected by functions/admin/_middleware.js, so only a signed-in admin can use it.
// Needs the ANTHROPIC_API_KEY secret in Cloudflare (optional ANTHROPIC_MODEL variable).
// The key stays on the server; the browser only ever sees the answer text, streamed as plain text.
// This more specific route takes precedence over api/[action].js.

import { isTrustedAdminPost, json } from "../../_lib/rouge.js"

const DEFAULT_MODEL = "claude-sonnet-5-5"
const MAX_TURNS = 20
const MAX_TURN_CHARS = 8000
const MAX_SYSTEM_CHARS = 12000

export async function onRequestPost({ request, env }) {
  if (!isTrustedAdminPost(request)) return json({ error: "Request blocked." }, 403)
  const key = String(env.ANTHROPIC_API_KEY || "").trim()
  if (!key) return json({ error: "Add the ANTHROPIC_API_KEY secret in Cloudflare.", code: "not_configured" }, 503)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: "Invalid JSON" }, 400)
  }

  const system = typeof body.system === "string" ? body.system.slice(0, MAX_SYSTEM_CHARS) : ""
  const messages = cleanMessages(body.messages)
  if (!messages) return json({ error: "Send a list of user/assistant messages ending on a user message." }, 400)

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: String(env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim(),
      max_tokens: 1200,
      system,
      messages,
      stream: true,
    }),
  })

  if (!upstream.ok || !upstream.body) {
    console.error("Anthropic request failed:", upstream.status)
    const code = upstream.status === 429 || upstream.status === 529 ? "rate_limited" : "upstream_error"
    return json({ error: "Claude couldn't answer just now.", code }, 502)
  }

  // Turn Anthropic's event stream into plain answer text as it arrives.
  const enc = new TextEncoder()
  const dec = new TextDecoder()
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  ;(async () => {
    const reader = upstream.body.getReader()
    let buf = ""
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let cut
        while ((cut = buf.indexOf("\n\n")) >= 0) {
          const event = buf.slice(0, cut)
          buf = buf.slice(cut + 2)
          for (const line of event.split("\n")) {
            if (!line.startsWith("data:")) continue
            let data
            try {
              data = JSON.parse(line.slice(5))
            } catch {
              continue
            }
            if (data.type === "content_block_delta" && data.delta && data.delta.type === "text_delta") {
              await writer.write(enc.encode(data.delta.text))
            }
          }
        }
      }
    } catch (err) {
      console.error("Stream from Anthropic broke:", err && err.message)
    } finally {
      try {
        await writer.close()
      } catch {}
    }
  })()

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}

// Keeps only well-formed user/assistant turns, merges repeats, and makes sure it starts and ends with the user.
function cleanMessages(raw) {
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
