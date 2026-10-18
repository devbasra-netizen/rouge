// Admin API for the invitations dashboard. Protected by functions/admin/_middleware.js.
//   GET  /admin/api/state?campaign=rouge-001
//   GET  /admin/api/preview?campaign=rouge-001&name=Dev&format=html|text
//   POST /admin/api/test     { campaign }
//   POST /admin/api/approve  { campaign, confirm: true }
//   POST /admin/api/send     { campaign, mode: "live" | "retry" | "continue", expected }

import {
  ELIGIBLE_SQL,
  isTrustedAdminPost,
  json,
  listFromEnv,
  listUnsubscribeHeaders,
  missingConfig,
  sendWithResend,
  sleep,
  testUnsubscribeUrl,
  unsubscribeUrl,
} from "../../_lib/rouge.js"
import { hasTemplate, renderCampaign } from "../../_lib/email.js"

const SEND_CONFIG = ["RESEND_API_KEY", "MAIL_FROM", "REPLY_TO", "UNSUBSCRIBE_SECRET", "PUBLIC_BASE_URL"]
const BATCH_SIZE = 8 // emails per request; the dashboard keeps calling until none are left
const PAUSE_MS = 300 // stays well under Resend's rate limit
const STUCK_MINUTES = 10 // a "sending" row older than this was interrupted
// Bump when the email content changes, so a retry is not rejected as a changed request.
const TEMPLATE_VERSION = 1

export async function onRequest(context) {
  const { request, env, params, data } = context
  const action = String(params.action || "")
  try {
    if (!env.DB) return json({ error: "The D1 binding DB is missing." }, 500)

    if (request.method === "GET") {
      if (action === "state") return await getState(env, request, data.admin)
      if (action === "preview") return await getPreview(env, request)
      return json({ error: "Not found" }, 404)
    }

    if (request.method === "POST") {
      if (!isTrustedAdminPost(request)) return json({ error: "Request blocked." }, 403)
      let body
      try {
        body = await request.json()
      } catch {
        return json({ error: "Invalid JSON" }, 400)
      }
      if (action === "test") return await sendTest(env, body, data.admin)
      if (action === "approve") return await approveTest(env, body)
      if (action === "send") return await sendCampaign(env, body)
      return json({ error: "Not found" }, 404)
    }

    return json({ error: "Method not allowed" }, 405)
  } catch (err) {
    console.error(`admin/${action} failed:`, err && err.message)
    return json({ error: "Something went wrong on the server. Check the function logs." }, 500)
  }
}

async function getCampaign(env, slug) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,64}$/.test(slug)) return null
  return env.DB.prepare("SELECT * FROM campaigns WHERE slug = ?1").bind(slug).first()
}

// ---------- state ----------

async function getState(env, request, admin) {
  const url = new URL(request.url)
  const { results: campaigns } = await env.DB.prepare(
    "SELECT slug, name, status FROM campaigns ORDER BY id DESC",
  ).all()
  const slug = url.searchParams.get("campaign") || (campaigns[0] && campaigns[0].slug)
  const campaign = await getCampaign(env, slug)
  if (!campaign) return json({ error: "Campaign not found", campaigns }, 404)

  const { results: rows } = await env.DB.prepare(
    `SELECT s.id, s.first_name, s.email, s.marketing_consent,
            CASE WHEN u.email IS NOT NULL THEN 1 ELSE 0 END AS unsubscribed,
            d.status, d.attempts, d.last_error, d.accepted_at, d.delivered_at,
            CASE WHEN d.status = 'sending'
                  AND d.claimed_at < datetime('now', '-${STUCK_MINUTES} minutes') THEN 1 ELSE 0 END AS stuck
       FROM signups s
       LEFT JOIN unsubscribes u ON u.email = lower(s.email)
       LEFT JOIN deliveries d ON d.signup_id = s.id AND d.campaign_id = ?1
      ORDER BY s.id`,
  )
    .bind(campaign.id)
    .all()

  const unsubTotal = await env.DB.prepare("SELECT COUNT(*) AS n FROM unsubscribes").first()

  const m = { eligible: 0, sent: 0, delivered: 0, pending: 0, failed: 0, bounced: 0, toSend: 0, retryable: 0 }
  const subscribers = rows.map((r) => {
    const eligible = r.marketing_consent === 1 && r.unsubscribed === 0
    if (eligible) m.eligible++
    if (r.status === "accepted" || r.status === "delivered") m.sent++
    if (r.status === "delivered") m.delivered++
    if (r.status === "failed") m.failed++
    if (r.status === "bounced" || r.status === "complained") m.bounced++
    if (eligible && (!r.status || r.status === "pending" || (r.status === "sending" && !r.stuck))) m.pending++
    if (eligible && !r.status) m.toSend++
    if (eligible && (r.status === "failed" || r.stuck)) m.retryable++
    return {
      id: r.id,
      firstName: r.first_name || "",
      email: r.email,
      eligible,
      reason: r.unsubscribed ? "unsubscribed" : r.marketing_consent === 1 ? "" : "no consent",
      status: r.stuck ? "stuck" : r.status || null,
      attempts: r.attempts || 0,
      error: r.last_error || "",
      acceptedAt: r.accepted_at || null,
      deliveredAt: r.delivered_at || null,
    }
  })
  const queued = rows.filter((r) => r.status === "pending").length

  return json({
    admin: admin.email,
    testRecipients: testRecipients(env),
    campaigns,
    campaign: {
      slug: campaign.slug,
      name: campaign.name,
      subject: campaign.subject,
      status: campaign.status,
      testSentAt: campaign.test_sent_at,
      testApprovedAt: campaign.test_approved_at,
      launchedAt: campaign.launched_at,
      hasTemplate: hasTemplate(campaign.slug),
    },
    metrics: { ...m, queued, unsubscribed: unsubTotal ? unsubTotal.n : 0 },
    subscribers,
    missingConfig: missingConfig(env, [...SEND_CONFIG, "RESEND_WEBHOOK_SECRET"]),
  })
}

function testRecipients(env) {
  const list = listFromEnv(env.TEST_RECIPIENTS)
  return list.length ? list : listFromEnv(env.ADMIN_EMAILS)
}

// ---------- preview ----------

async function getPreview(env, request) {
  const url = new URL(request.url)
  const campaign = await getCampaign(env, url.searchParams.get("campaign"))
  if (!campaign || !hasTemplate(campaign.slug)) return new Response("Campaign not found", { status: 404 })
  const name = (url.searchParams.get("name") || "").slice(0, 60)
  const email = renderCampaign(campaign.slug, {
    firstName: name,
    unsubscribeUrl: testUnsubscribeUrl(env),
  })
  if (url.searchParams.get("format") === "text") {
    return new Response(email.text, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
  return new Response(email.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; sandbox",
    },
  })
}

// ---------- test ----------

async function sendTest(env, body, admin) {
  const campaign = await getCampaign(env, body.campaign)
  if (!campaign || !hasTemplate(campaign.slug)) return json({ error: "Campaign not found" }, 404)
  const missing = missingConfig(env, SEND_CONFIG)
  if (missing.length) return json({ error: `Missing settings: ${missing.join(", ")}` }, 500)

  const allowed = testRecipients(env)
  const to = String(body.to || admin.email).toLowerCase()
  if (!allowed.includes(to)) return json({ error: "That address is not an allowed test recipient." }, 400)

  const name = String(body.sampleName || "Dev").slice(0, 60)
  const unsub = testUnsubscribeUrl(env)
  const email = renderCampaign(campaign.slug, { firstName: name, unsubscribeUrl: unsub, isTest: true })
  const result = await sendWithResend(env, {
    to,
    subject: `[TEST] ${campaign.subject}`,
    html: email.html,
    text: email.text,
    headers: listUnsubscribeHeaders(unsub),
    tags: [{ name: "campaign", value: campaign.slug }, { name: "kind", value: "test" }],
  })
  if (!result.ok) return json({ error: result.error }, 502)

  await env.DB.prepare("UPDATE campaigns SET test_sent_at = datetime('now') WHERE id = ?1")
    .bind(campaign.id)
    .run()
  return json({ ok: true, to, providerId: result.id })
}

// ---------- approve ----------

async function approveTest(env, body) {
  const campaign = await getCampaign(env, body.campaign)
  if (!campaign) return json({ error: "Campaign not found" }, 404)
  if (body.confirm !== true) return json({ error: "Confirmation required." }, 400)
  if (!campaign.test_sent_at) return json({ error: "Send yourself a test email first." }, 409)
  await env.DB.prepare(
    "UPDATE campaigns SET status = 'test_approved', test_approved_at = datetime('now') WHERE id = ?1 AND status = 'draft'",
  )
    .bind(campaign.id)
    .run()
  return json({ ok: true })
}

// ---------- send ----------

async function sendCampaign(env, body) {
  const db = env.DB
  const campaign = await getCampaign(env, body.campaign)
  if (!campaign || !hasTemplate(campaign.slug)) return json({ error: "Campaign not found" }, 404)
  const mode = body.mode
  if (!["live", "retry", "continue"].includes(mode)) return json({ error: "Unknown send mode." }, 400)
  const missing = missingConfig(env, SEND_CONFIG)
  if (missing.length) return json({ error: `Missing settings: ${missing.join(", ")}` }, 500)
  if (campaign.status === "draft" || !campaign.test_approved_at) {
    return json({ error: "Send and approve a test email before sending invitations." }, 409)
  }

  // Anyone who unsubscribed since being queued is removed from the queue.
  await db
    .prepare(
      `DELETE FROM deliveries WHERE campaign_id = ?1 AND status IN ('pending', 'failed')
         AND signup_id NOT IN (SELECT s.id FROM signups s WHERE ${ELIGIBLE_SQL})`,
    )
    .bind(campaign.id)
    .run()

  if (mode === "live") {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM signups s WHERE ${ELIGIBLE_SQL}
           AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.campaign_id = ?1 AND d.signup_id = s.id)`,
      )
      .bind(campaign.id)
      .first()
    if (body.expected !== row.n) {
      return json({ error: `The number of recipients has changed to ${row.n}. Refresh and confirm again.` }, 409)
    }
    // UNIQUE(campaign_id, signup_id) means nobody can be queued twice, even if Send is pressed twice.
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO deliveries (campaign_id, signup_id)
             SELECT ?1, s.id FROM signups s WHERE ${ELIGIBLE_SQL}`,
        )
        .bind(campaign.id),
      db
        .prepare(
          "UPDATE campaigns SET status = 'sending', launched_at = COALESCE(launched_at, datetime('now')) WHERE id = ?1",
        )
        .bind(campaign.id),
    ])
  }

  if (mode === "retry") {
    const where = `campaign_id = ?1 AND (status = 'failed'
      OR (status = 'sending' AND claimed_at < datetime('now', '-${STUCK_MINUTES} minutes')))`
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM deliveries WHERE ${where}`).bind(campaign.id).first()
    if (body.expected !== row.n) {
      return json({ error: `The number of failed emails has changed to ${row.n}. Refresh and confirm again.` }, 409)
    }
    await db.batch([
      db.prepare(`UPDATE deliveries SET status = 'pending', updated_at = datetime('now') WHERE ${where}`).bind(campaign.id),
      db.prepare("UPDATE campaigns SET status = 'sending' WHERE id = ?1").bind(campaign.id),
    ])
  }

  let accepted = 0
  let failed = 0
  let rateLimited = false

  for (let i = 0; i < BATCH_SIZE; i++) {
    // Claim exactly one queued row. The status check makes this safe if two requests run at once.
    const claim = await db
      .prepare(
        `UPDATE deliveries
            SET status = 'sending', attempts = attempts + 1,
                claimed_at = datetime('now'), updated_at = datetime('now')
          WHERE id = (SELECT id FROM deliveries WHERE campaign_id = ?1 AND status = 'pending' ORDER BY id LIMIT 1)
            AND status = 'pending'
          RETURNING id, signup_id`,
      )
      .bind(campaign.id)
      .first()
    if (!claim) break

    const person = await db
      .prepare(`SELECT s.id, s.email, s.first_name FROM signups s WHERE s.id = ?1 AND ${ELIGIBLE_SQL}`)
      .bind(claim.signup_id)
      .first()
    if (!person) {
      await db.prepare("DELETE FROM deliveries WHERE id = ?1").bind(claim.id).run()
      continue
    }

    const unsub = await unsubscribeUrl(env, person.id)
    const email = renderCampaign(campaign.slug, { firstName: person.first_name, unsubscribeUrl: unsub })
    const result = await sendWithResend(env, {
      to: person.email,
      subject: campaign.subject,
      html: email.html,
      text: email.text,
      headers: listUnsubscribeHeaders(unsub),
      // Same key for every attempt at this delivery: if an earlier attempt actually reached Resend,
      // Resend returns that result instead of sending a second copy (within 24 hours).
      idempotencyKey: `${campaign.slug}-d${claim.id}-v${TEMPLATE_VERSION}`,
      tags: [{ name: "campaign", value: campaign.slug }],
    })

    if (result.ok) {
      accepted++
      await db
        .prepare(
          `UPDATE deliveries SET status = 'accepted', provider_message_id = ?2, last_error = NULL,
                  accepted_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ?1`,
        )
        .bind(claim.id, result.id)
        .run()
    } else {
      failed++
      await db
        .prepare("UPDATE deliveries SET status = 'failed', last_error = ?2, updated_at = datetime('now') WHERE id = ?1")
        .bind(claim.id, result.error)
        .run()
      if (result.rateLimited) {
        rateLimited = true
        break
      }
    }
    await sleep(PAUSE_MS)
  }

  const left = await db
    .prepare(
      `SELECT SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'sending' THEN 1 ELSE 0 END) AS sending
         FROM deliveries WHERE campaign_id = ?1`,
    )
    .bind(campaign.id)
    .first()
  const remaining = left.pending || 0
  if (remaining === 0 && !left.sending) {
    await db.prepare("UPDATE campaigns SET status = 'complete' WHERE id = ?1 AND status = 'sending'").bind(campaign.id).run()
  }
  return json({ ok: true, accepted, failed, remaining, rateLimited })
}
