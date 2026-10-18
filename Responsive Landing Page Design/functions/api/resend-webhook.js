// Receives delivery events from Resend so the dashboard can tell "accepted" apart from
// "delivered", "bounced" or "marked as spam". Every request must carry a valid Resend signature.

import { json, verifyWebhook } from "../_lib/rouge.js"

export async function onRequestPost({ request, env }) {
  const raw = await request.text()
  if (raw.length > 100_000) return json({ error: "Too large" }, 413)
  if (!(await verifyWebhook(env, request, raw))) return json({ error: "Invalid signature" }, 401)

  let event
  try {
    event = JSON.parse(raw)
  } catch {
    return json({ error: "Invalid JSON" }, 400)
  }
  const type = String(event.type || "")
  const id = event.data && event.data.email_id
  if (!id) return json({ ok: true, ignored: true })

  const db = env.DB
  const now = "datetime('now')"

  if (type === "email.delivered") {
    await db
      .prepare(
        `UPDATE deliveries SET status = 'delivered', delivered_at = ${now}, updated_at = ${now}
          WHERE provider_message_id = ?1 AND status IN ('accepted', 'sending', 'failed')`,
      )
      .bind(id)
      .run()
  } else if (type === "email.bounced") {
    await db
      .prepare(
        `UPDATE deliveries SET status = 'bounced', last_error = ?2, updated_at = ${now}
          WHERE provider_message_id = ?1 AND status <> 'complained'`,
      )
      .bind(id, bounceReason(event))
      .run()
  } else if (type === "email.complained") {
    // A spam complaint is treated as an unsubscribe.
    const row = await db
      .prepare(
        `SELECT s.id, s.email FROM deliveries d JOIN signups s ON s.id = d.signup_id
          WHERE d.provider_message_id = ?1`,
      )
      .bind(id)
      .first()
    const statements = [
      db
        .prepare(
          `UPDATE deliveries SET status = 'complained', last_error = 'Marked as spam', updated_at = ${now}
            WHERE provider_message_id = ?1`,
        )
        .bind(id),
    ]
    if (row) {
      statements.push(
        db.prepare("INSERT OR IGNORE INTO unsubscribes (email, method) VALUES (?1, 'spam_complaint')").bind(row.email.toLowerCase()),
        db.prepare("UPDATE signups SET marketing_consent = 0 WHERE id = ?1").bind(row.id),
      )
    }
    await db.batch(statements)
  } else if (type === "email.failed" || type === "email.suppressed") {
    await db
      .prepare(
        `UPDATE deliveries SET status = 'failed', last_error = ?2, updated_at = ${now}
          WHERE provider_message_id = ?1 AND status IN ('accepted', 'sending')`,
      )
      .bind(id, type === "email.suppressed" ? "Resend suppressed this address (earlier bounce or complaint)" : "Resend could not send this email")
      .run()
  }
  // Other events (sent, opened, clicked, delivery_delayed) are not needed and are ignored.
  return json({ ok: true })
}

function bounceReason(event) {
  const b = (event.data && event.data.bounce) || {}
  const parts = [b.type, b.subType, b.message].filter(Boolean).map(String)
  return parts.length ? `Bounced: ${parts.join(" / ").slice(0, 250)}` : "Bounced"
}
