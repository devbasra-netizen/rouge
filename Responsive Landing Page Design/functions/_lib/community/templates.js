// ROUGE email templates for Members and ROUGE Radio. The copy below is the default; Dev can edit
// subject, heading, body and button text in ROUGE HQ (Settings → Email templates). Variables in
// {{double_braces}} are filled in and HTML-escaped at send time. Square-bracket text marks a gap
// Dev must fill before sending (manual templates only).
// Exports no request handlers, so Pages does not turn this into a route.

import { escapeHtml } from "../rouge.js"

const SIGN_RADIO = "Dev\nROUGE Radio"

export const DEFAULT_TEMPLATES = [
  {
    key: "member_confirm",
    name: "Members — confirm your email",
    kind: "transactional",
    subject: "Confirm your email for ROUGE",
    heading: "One last step.",
    body: "Hi {{first_name}},\n\nThanks for joining ROUGE. Tap below to confirm this is your email address and complete your membership.\n\nIf you didn't ask to join, ignore this email and nothing will happen.",
    cta_label: "Confirm my email",
    notes: "Sent automatically when someone joins. The button link is added for you.",
  },
  {
    key: "member_welcome",
    name: "Members — welcome to ROUGE",
    kind: "membership",
    subject: "Welcome to ROUGE.",
    heading: "Welcome to ROUGE.",
    body: "Hi {{first_name}},\n\nYou're part of the world now.\n\nROUGE began with a packed room at BRICKS in Brixton on 24 October: R&B, soul, house, garage and everything in between, played for people who came for the music.\n\nROUGE 002 is in the making, and ROUGE Radio is coming. Members hear first.\n\nWe'll only be in touch when there's something worth sharing.\n\nDev\nFounder, ROUGE",
    cta_label: "See the Archive",
    notes: "Sent automatically once a member confirms their email and has agreed to hear from ROUGE.",
  },
  {
    key: "radio_received",
    name: "Radio — application received",
    kind: "transactional",
    subject: "Sound received — ROUGE Radio",
    heading: "Sound received.",
    body: "Hi {{artist_name}},\n\nThank you for sharing your sound with ROUGE.\n\nWe'll listen through applications and reach out if there's a fit for an upcoming session. ROUGE Radio hasn't announced a broadcast schedule yet, so we can't give you a timeline, but every application is listened to by a person.\n\nUntil then, keep selecting.\n\nROUGE Radio\n\nYour reference: {{ref}}",
    notes: "Sent automatically when an application arrives.",
  },
  {
    key: "radio_more_info",
    name: "Radio — request for more information",
    kind: "manual",
    subject: "Your ROUGE Radio application — a quick question",
    heading: "A quick question.",
    body: "Hi {{artist_name}},\n\nThanks again for applying to play on ROUGE Radio. Before we go further, could you tell us a little more about:\n\n[Your question]\n\nJust reply to this email.\n\n" + SIGN_RADIO,
    notes: "Sent only when you choose to, from the application.",
  },
  {
    key: "radio_shortlisted",
    name: "Radio — shortlisted",
    kind: "manual",
    subject: "ROUGE Radio — you're on our shortlist",
    heading: "You're on the shortlist.",
    body: "Hi {{artist_name}},\n\nWe've been listening, and we'd love to keep talking about a ROUGE Radio session with you.\n\nThis isn't a confirmed booking yet. We'll be in touch about the idea, timings and how the session would be recorded.\n\nThank you for sharing your sound.\n\n" + SIGN_RADIO,
    notes: "Sent only when you choose to, from the application.",
  },
  {
    key: "radio_accepted",
    name: "Radio — acceptance",
    kind: "manual",
    subject: "ROUGE Radio — we'd love to have you",
    heading: "We'd love to have you.",
    body: "Hi {{artist_name}},\n\nWe'd love you to record a guest session for ROUGE Radio.\n\nNext, we'll agree the details together: the concept, length and recording, and how the session can be shared and promoted. Nothing will be published or announced until we've both agreed, and music licensing is checked before any release.\n\nReply to this email and we'll take it from there.\n\n" + SIGN_RADIO,
    notes: "Sent only when you choose to, from the application.",
  },
  {
    key: "radio_declined",
    name: "Radio — respectful decline",
    kind: "manual",
    subject: "Your ROUGE Radio application",
    heading: "Thank you for your sound.",
    body: "Hi {{artist_name}},\n\nThank you for applying to play on ROUGE Radio, and for the time you put into it.\n\nWe won't be taking your application forward for now. We receive more strong submissions than we have sessions, and this isn't a judgement on your talent.\n\nKeep selecting. We hope our paths cross again.\n\n" + SIGN_RADIO,
    notes: "Sent only when you choose to, from the application.",
  },
  {
    key: "announce_002",
    name: "ROUGE 002 — announcement (draft)",
    kind: "marketing",
    subject: "ROUGE 002",
    heading: "ROUGE 002.",
    body: "Hi {{first_name}},\n\nThe next room is ready.\n\n[Day, date] · [Venue], London\n[Doors – finish]\n\nA new room. The same feeling. R&B, soul, house, garage and everything in between, selected with intention.\n\nMembers hear first. [Ticket details]\n\nDev\nFounder, ROUGE",
    cta_label: "[Button, e.g. Get tickets]",
    notes: "Marketing draft for consenting members only. Fill the gaps once ROUGE 002 is confirmed. It is never sent automatically; bulk sends go through the invitations test-then-approve flow.",
  },
]

export const TEMPLATE_KEYS = DEFAULT_TEMPLATES.map((t) => t.key)

const C = { bg: "#100909", panel: "#180C0E", oxblood: "#5A101C", accent: "#9A2538", cream: "#F2E9DF", muted: "#BFAEA6", faint: "#948480", line: "#2E1418" }
const SERIF = "'Bodoni 72', Didot, 'Bodoni MT', Georgia, 'Times New Roman', serif"
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"

export function fill(text, vars) {
  return String(text || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ""))
}

// Branded, email-client-safe HTML plus a plain-text twin.
export function renderEmail({ subject, heading, body, cta_label }, vars = {}, { ctaUrl, footer = [], label = "LONDON" } = {}) {
  const subj = fill(subject, vars).trim()
  const head = fill(heading, vars).trim()
  const text = fill(body, vars).trim()
  const cta = ctaUrl && cta_label ? fill(cta_label, vars).trim() : ""
  const paras = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.cream};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("")
  const button = cta
    ? `<tr><td class="px" style="padding:12px 40px 8px;"><a href="${escapeHtml(ctaUrl)}" target="_blank" style="display:inline-block;background-color:${C.accent};color:${C.cream};font-family:${SANS};font-size:12px;line-height:18px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;padding:16px 30px;">${escapeHtml(cta)}</a>
       <p style="margin:14px 0 0;font-family:${SANS};font-size:12px;line-height:18px;color:${C.faint};word-break:break-all;">Or open ${escapeHtml(ctaUrl)}</p></td></tr>`
    : ""
  const foot = footer.map((f) => `<p style="margin:0 0 8px;font-family:${SANS};font-size:12px;line-height:18px;color:${C.faint};">${f}</p>`).join("")
  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subj)}</title>
<style>:root{color-scheme:dark}body{margin:0;padding:0;background-color:${C.bg}}a{color:${C.cream}}
@media only screen and (max-width:620px){.px{padding-left:24px!important;padding-right:24px!important}.title{font-size:36px!important;line-height:40px!important}}</style></head>
<body style="margin:0;padding:0;background-color:${C.bg};" bgcolor="${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${C.bg};opacity:0;">${escapeHtml(text.split("\n").filter(Boolean)[1] || head)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background-color:${C.bg};"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">
<tr><td class="px" style="padding:48px 40px 8px;">
  <p style="margin:0;font-family:${SERIF};font-size:28px;line-height:32px;letter-spacing:10px;color:${C.cream};">ROUGE</p>
  <p style="margin:8px 0 0;font-family:${SANS};font-size:10px;line-height:14px;letter-spacing:4px;color:${C.muted};">${escapeHtml(label)}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td width="40" height="1" bgcolor="${C.accent}" style="font-size:0;line-height:0;background-color:${C.accent};">&nbsp;</td></tr></table>
</td></tr>
${head ? `<tr><td class="px" style="padding:32px 40px 8px;"><p class="title" style="margin:0 0 20px;font-family:${SERIF};font-size:44px;line-height:48px;color:${C.cream};">${escapeHtml(head)}</p></td></tr>` : ""}
<tr><td class="px" style="padding:8px 40px 8px;">${paras}</td></tr>
${button}
<tr><td class="px" style="padding:36px 40px 48px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="${C.line}" style="font-size:0;line-height:0;background-color:${C.line};">&nbsp;</td></tr></table>
  <div style="padding-top:20px;">${foot}<p style="margin:0;font-family:${SANS};font-size:12px;line-height:18px;color:${C.faint};">ROUGE London · rouge-london.com · Instagram @rouge.london</p></div>
</td></tr>
</table></td></tr></table></body></html>`
  const plain = `${head ? head + "\n\n" : ""}${text}${cta ? `\n\n${cta}: ${ctaUrl}` : ""}\n\n--\n${footer.map((f) => f.replace(/<[^>]+>/g, "")).join("\n")}\nROUGE London · rouge-london.com`
  return { subject: subj, html, text: plain }
}

export async function loadTemplate(db, key) {
  const row = await db.prepare("SELECT * FROM email_templates WHERE key = ?1").bind(key).first()
  return row || DEFAULT_TEMPLATES.find((t) => t.key === key)
}
