// /crew/<token>: a read-only crew sheet for one event, created from ROUGE HQ (Event → Team → Crew links).
// The link carries a random 192-bit token; only its SHA-256 hash is stored, and links expire or can be revoked.
// It shows only the areas chosen when the link was made, and never money, contracts or subscriber data.

import { escapeHtml as E } from "../_lib/rouge.js"
import { sha256Hex } from "../_lib/hq/api.js"

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
}

function page(title, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><title>${E(title)}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;1,6..96,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap">
<style>
:root{--ink:#0c0809;--card:#160d0f;--line:rgba(242,233,220,.13);--ivory:#f2e9dc;--dim:#b4a699;--faint:#7f7168;--wine:#7a1626;--brass:#b39a6d}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--ivory);font:15px/1.5 "DM Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:720px;margin:0 auto;padding:max(24px,env(safe-area-inset-top)) 18px 48px}
.eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--brass)}
h1{font-family:"Bodoni Moda",serif;font-weight:400;font-size:40px;line-height:1.05;margin:10px 0 6px}
.meta{color:var(--dim);margin:0 0 28px}
h2{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);font-weight:600;margin:32px 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.row{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:12px 14px;border-top:1px solid var(--line)}
.row:first-child{border-top:0}.t{font-variant-numeric:tabular-nums;color:var(--brass);font-weight:600}
.sub{color:var(--dim);font-size:13px}.done{opacity:.45;text-decoration:line-through}
.empty{padding:16px;color:var(--faint)}footer{margin-top:40px;color:var(--faint);font-size:12px}
</style></head><body><main>${body}</main></body></html>`
}

function gone(message) {
  return new Response(page("ROUGE crew sheet", `<p class="eyebrow">ROUGE</p><h1>Link unavailable</h1><p class="meta">${E(message)}</p>`), { status: 404, headers: HEADERS })
}

export async function onRequestGet({ params, env }) {
  const token = String(params.token || "")
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token) || !env.DB) return gone("This crew link isn't valid.")
  let share
  try {
    share = await env.DB.prepare("SELECT * FROM hq_shares WHERE token_hash = ?1").bind(await sha256Hex(token)).first()
  } catch {
    return gone("This crew link isn't valid.")
  }
  if (!share || share.revoked) return gone("This crew link has been turned off. Ask Dev for a new one.")
  if (share.expires_at && Date.parse(share.expires_at) < Date.now()) return gone("This crew link has expired. Ask Dev for a new one.")

  const db = env.DB
  const areas = new Set(String(share.areas || "").split(","))
  const event = await db.prepare("SELECT * FROM hq_events WHERE id = ?1").bind(share.event_id).first()
  if (!event) return gone("This event no longer exists.")
  await db.prepare("UPDATE hq_shares SET last_seen = datetime('now') WHERE id = ?1").bind(share.id).run()

  const when = event.date
    ? new Date(event.date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "Date to be confirmed"
  const times = [event.start_time, event.end_time].filter(Boolean).join("–")
  const parts = [
    `<p class="eyebrow">ROUGE · ${E(share.label || "Crew")}</p>`,
    `<h1>${E(event.name)}</h1>`,
    `<p class="meta">${E(when)}${times ? ` · ${E(times)}` : ""}${event.venue_name ? ` · ${E(event.venue_name)}` : ""}</p>`,
  ]

  if (areas.has("run")) {
    const run = (await db.prepare("SELECT * FROM hq_run WHERE event_id = ?1 ORDER BY sort, time, id").bind(event.id).all()).results || []
    parts.push(
      `<h2>Running order</h2><div class="card">${
        run.length
          ? run
              .map(
                (r) =>
                  `<div class="row${r.done ? " done" : ""}"><span class="t">${E(r.time || "—")}</span><div><div>${E(r.activity)}</div>${[r.person, r.location].filter(Boolean).length ? `<div class="sub">${E([r.person, r.location].filter(Boolean).join(" · "))}</div>` : ""}${r.notes ? `<div class="sub">${E(r.notes)}</div>` : ""}</div></div>`,
              )
              .join("")
          : `<div class="empty">The running order hasn't been written yet.</div>`
      }</div>`,
    )
  }
  if (areas.has("team")) {
    const team = (await db.prepare("SELECT a.role, a.shift_start, a.shift_end, a.notes, COALESCE(p.name, a.person_name) AS who FROM hq_assignments a LEFT JOIN hq_people p ON p.id = a.person_id WHERE a.event_id = ?1 ORDER BY COALESCE(a.shift_start, '99:99'), a.role").bind(event.id).all()).results || []
    parts.push(
      `<h2>Team</h2><div class="card">${
        team.length
          ? team
              .map(
                (a) =>
                  `<div class="row"><span class="t">${E(a.shift_start || "—")}</span><div><div>${E(a.role)}${a.who ? ` — ${E(a.who)}` : ""}</div>${a.shift_end ? `<div class="sub">Until ${E(a.shift_end)}</div>` : ""}${a.notes ? `<div class="sub">${E(a.notes)}</div>` : ""}</div></div>`,
              )
              .join("")
          : `<div class="empty">No roles assigned yet.</div>`
      }</div>`,
    )
  }
  if (areas.has("tasks")) {
    const tasks = (await db.prepare("SELECT title, owner, due, status FROM hq_tasks WHERE event_id = ?1 AND parent_id IS NULL AND status != 'done' AND phase IN ('final_prep', 'execution', 'equipment', 'staffing') ORDER BY COALESCE(due, '9999'), sort").bind(event.id).all()).results || []
    parts.push(
      `<h2>Production tasks</h2><div class="card">${
        tasks.length
          ? tasks.map((t) => `<div class="row"><span class="t">${E(t.due ? t.due.slice(5).split("-").reverse().join("/") : "—")}</span><div><div>${E(t.title)}</div>${t.owner ? `<div class="sub">${E(t.owner)}</div>` : ""}</div></div>`).join("")
          : `<div class="empty">Nothing open for the crew right now.</div>`
      }</div>`,
    )
  }
  if (areas.has("venue") && event.venue_id) {
    const v = await db.prepare("SELECT name, address, area, licence, capacity FROM hq_venues WHERE id = ?1").bind(event.venue_id).first()
    if (v) {
      parts.push(
        `<h2>Venue</h2><div class="card"><div class="row"><span class="t">📍</span><div><div>${E(v.name)}</div>${v.address ? `<div class="sub">${E(v.address)}</div>` : ""}${v.licence ? `<div class="sub">Licence: ${E(v.licence)}</div>` : ""}</div></div></div>`,
      )
    }
  }
  parts.push(`<footer>Shared from ROUGE HQ. This page updates when the plan changes — refresh before you leave.</footer>`)
  return new Response(page(`${event.name} · crew sheet`, parts.join("")), { headers: HEADERS })
}
