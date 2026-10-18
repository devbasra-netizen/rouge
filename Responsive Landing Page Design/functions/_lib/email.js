// ROUGE invitation emails. One render function per campaign slug.
// To add a future campaign: write a new render function, add it to TEMPLATES,
// and insert a row into the campaigns table with the same slug.

import { escapeHtml, greetingName } from "./rouge.js"

const C = {
  bg: "#100909",
  panel: "#180C0E",
  oxblood: "#5A101C",
  accent: "#9A2538",
  cream: "#F2E9DF",
  muted: "#BFAEA6",
  faint: "#948480",
  line: "#2E1418",
}
const SERIF = "'Bodoni 72', Didot, 'Bodoni MT', Georgia, 'Times New Roman', serif"
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const MONO = "Menlo, Consolas, 'Courier New', monospace"
const SITE_URL = "https://www.rouge-london.com"

const TEMPLATES = { "rouge-001": rouge001 }

export function hasTemplate(slug) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, slug)
}

// Returns { html, text } for one recipient.
export function renderCampaign(slug, { firstName, unsubscribeUrl, isTest = false }) {
  if (!hasTemplate(slug)) throw new Error(`No email template for campaign "${slug}"`)
  return TEMPLATES[slug]({ name: greetingName(firstName), unsubscribeUrl, isTest })
}

// ---------- ROUGE #001 ----------

function rouge001({ name, unsubscribeUrl, isTest }) {
  const TICKET_URL = "https://link.dice.fm/Bd42c746fbaa"
  const CODE = "ROUGELAUNCHFAMILY26"
  const greeting = name ? `Hey ${name},` : "Hey there,"
  const preheader = "A little something for the first people on the ROUGE list."

  const p = (content, extra = "") =>
    `<p style="margin:0 0 20px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.cream};${extra}">${content}</p>`

  const detail = (content) =>
    `<p style="margin:0 0 6px;font-family:${SANS};font-size:13px;line-height:20px;letter-spacing:3px;color:${C.cream};">${content}</p>`

  const testBanner = isTest
    ? `<tr><td style="padding:12px 24px;background-color:${C.accent};font-family:${SANS};font-size:12px;letter-spacing:2px;color:${C.cream};text-align:center;">TEST EMAIL &mdash; NOT SENT TO SUBSCRIBERS</td></tr>`
    : ""

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>ROUGE #001</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  :root { color-scheme: dark; supported-color-schemes: dark; }
  body { margin:0; padding:0; background-color:${C.bg}; }
  a { color:${C.cream}; }
  @media only screen and (max-width:620px) {
    .px { padding-left:24px !important; padding-right:24px !important; }
    .card { padding:28px 22px !important; }
    .title { font-size:40px !important; line-height:44px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};" bgcolor="${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};opacity:0;">${escapeHtml(preheader)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background-color:${C.bg};">
<tr><td align="center" style="padding:0;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">
${testBanner}
<tr><td class="px" style="padding:48px 40px 8px;">
  <p style="margin:0;font-family:${SERIF};font-size:30px;line-height:34px;letter-spacing:10px;color:${C.cream};">ROUGE</p>
  <p style="margin:8px 0 0;font-family:${SANS};font-size:10px;line-height:14px;letter-spacing:4px;color:${C.muted};">BRIXTON &middot; LONDON</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td width="40" height="1" bgcolor="${C.accent}" style="font-size:0;line-height:0;background-color:${C.accent};">&nbsp;</td></tr></table>
</td></tr>

<tr><td class="px" style="padding:32px 40px 8px;">
  ${p(escapeHtml(greeting))}
  ${p("You’re on the ROUGE list, so I wanted to personally invite you to our very first night.", "margin-bottom:32px;")}
</td></tr>

<tr><td class="px" style="padding:0 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.panel}" style="background-color:${C.panel};border:1px solid ${C.oxblood};">
  <tr><td class="card" style="padding:36px 32px;">
    <p class="title" style="margin:0 0 24px;font-family:${SERIF};font-size:46px;line-height:50px;font-weight:normal;color:${C.cream};">ROUGE #001</p>
    ${detail("BRICKS, BRIXTON")}
    ${detail("SATURDAY 24 OCTOBER")}
    ${detail("9PM TIL LATE")}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 20px;"><tr><td width="40" height="1" bgcolor="${C.accent}" style="font-size:0;line-height:0;background-color:${C.accent};">&nbsp;</td></tr></table>
    <p style="margin:0;font-family:${SERIF};font-size:21px;line-height:28px;font-style:italic;color:${C.cream};">R&amp;B and House through the eras.</p>
  </td></tr>
  </table>
</td></tr>

<tr><td class="px" style="padding:32px 40px 8px;">
  ${p("From Sade and Erykah Badu to soulful house, timeless classics and the deep cuts you forgot you loved.")}
  ${p("A small room. Good people. Music selected with intention.")}
  ${p("Just 90 spaces for the first one.")}
  ${p("And because you’re one of the first people to discover ROUGE, I’ve got something for you.", "margin-bottom:28px;")}
</td></tr>

<tr><td class="px" style="padding:0 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:28px 16px;border:1px dashed ${C.accent};">
    <p style="margin:0 0 14px;font-family:${SANS};font-size:11px;line-height:16px;letter-spacing:4px;color:${C.muted};">YOUR EXCLUSIVE CODE</p>
    <p style="margin:0 0 14px;font-family:${MONO};font-size:19px;line-height:26px;letter-spacing:2px;color:${C.cream};font-weight:bold;word-break:break-all;">${CODE}</p>
    <p style="margin:0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted};">Use this code when securing your ticket.</p>
  </td></tr>
  </table>
</td></tr>

<tr><td class="px" align="center" style="padding:36px 40px 12px;">
  <!--[if mso]>
  <v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${TICKET_URL}" style="height:50px;v-text-anchor:middle;width:280px;" stroked="false" fillcolor="${C.accent}">
  <w:anchorlock/><center style="color:${C.cream};font-family:Arial,sans-serif;font-size:13px;letter-spacing:3px;">SECURE YOUR PLACE</center>
  </v:rect>
  <![endif]-->
  <!--[if !mso]><!-- -->
  <a href="${TICKET_URL}" target="_blank" style="display:inline-block;background-color:${C.accent};color:${C.cream};font-family:${SANS};font-size:13px;line-height:18px;letter-spacing:3px;text-decoration:none;padding:16px 34px;">SECURE YOUR PLACE</a>
  <!--<![endif]-->
  <p style="margin:16px 0 0;font-family:${SANS};font-size:12px;line-height:18px;color:${C.faint};">Or open <a href="${TICKET_URL}" target="_blank" style="color:${C.faint};text-decoration:underline;">link.dice.fm/Bd42c746fbaa</a></p>
</td></tr>

<tr><td class="px" style="padding:28px 40px 40px;">
  ${p("Really hope to see you there.", "margin-bottom:28px;")}
  <p style="margin:0;font-family:${SERIF};font-size:24px;line-height:30px;color:${C.cream};">Dev</p>
  <p style="margin:4px 0 0;font-family:${SANS};font-size:13px;line-height:20px;letter-spacing:1px;color:${C.muted};">Founder, ROUGE</p>
  <p style="margin:16px 0 0;font-family:${SANS};font-size:13px;line-height:20px;"><a href="${SITE_URL}" target="_blank" style="color:${C.cream};text-decoration:none;border-bottom:1px solid ${C.accent};">rouge-london.com</a></p>
</td></tr>

<tr><td class="px" style="padding:24px 40px 48px;border-top:1px solid ${C.line};">
  <p style="margin:0 0 10px;font-family:${SANS};font-size:12px;line-height:19px;color:${C.faint};">You’re receiving this because you signed up and agreed to hear from ROUGE on rouge-london.com.</p>
  <p style="margin:0 0 10px;font-family:${SANS};font-size:12px;line-height:19px;color:${C.faint};">Sent by ROUGE, London. Reply to this email to reach Dev directly.</p>
  <p style="margin:0;font-family:${SANS};font-size:12px;line-height:19px;color:${C.faint};"><a href="${escapeHtml(unsubscribeUrl)}" target="_blank" style="color:${C.faint};text-decoration:underline;">Unsubscribe</a></p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`

  const text = [
    ...(isTest ? ["[TEST EMAIL - NOT SENT TO SUBSCRIBERS]", ""] : []),
    greeting,
    "",
    "You’re on the ROUGE list, so I wanted to personally invite you to our very first night.",
    "",
    "ROUGE #001",
    "",
    "BRICKS, BRIXTON",
    "SATURDAY 24 OCTOBER",
    "9PM TIL LATE",
    "",
    "R&B and House through the eras.",
    "",
    "From Sade and Erykah Badu to soulful house, timeless classics and the deep cuts you forgot you loved.",
    "",
    "A small room. Good people. Music selected with intention.",
    "",
    "Just 90 spaces for the first one.",
    "",
    "And because you’re one of the first people to discover ROUGE, I’ve got something for you.",
    "",
    "YOUR EXCLUSIVE CODE",
    CODE,
    "Use this code when securing your ticket.",
    "",
    "SECURE YOUR PLACE",
    TICKET_URL,
    "",
    "Really hope to see you there.",
    "",
    "Dev",
    "Founder, ROUGE",
    "",
    "rouge-london.com",
    "",
    "---",
    "You’re receiving this because you signed up and agreed to hear from ROUGE on rouge-london.com.",
    "Sent by ROUGE, London. Reply to this email to reach Dev directly.",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n")

  return { html, text }
}
