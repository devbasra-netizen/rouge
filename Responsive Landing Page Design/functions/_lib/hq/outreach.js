// ROUGE 002 venue outreach: verified contact details, new venues and personalised enquiry drafts.
// Applied once to the live HQ (guarded by an hq_meta key). Only fills empty fields and never overwrites
// anything Dev has edited. Every address below was read from the venue's own website or a named listing
// on 6 Nov 2026; nothing is guessed. Drafts are saved as drafts — nothing is sent until Dev approves them.
// Exports no request handlers, so Pages does not turn this into a route.

export const OUTREACH_KEY = "outreach_2026_11_06"

const SRC_DATE = "checked 6 Nov 2026"

// Contact details for venues already in HQ.
export const CONTACTS = [
  {
    name: "Arch 535",
    contact_email: "info@arch535brixton.com",
    fact: { c: "confirm", s: `Venue's own hire page (arch535brixton.squarespace.com/archhire), ${SRC_DATE}. Note the .com address, not .co.uk.` },
    source: "https://arch535brixton.squarespace.com/archhire",
  },
  {
    name: "TOLA",
    contact_email: "events@tolapeckham.com",
    fact: { c: "verified", s: `tolapeckham.com: “For reservations and private hire contact events@tolapeckham.com”, ${SRC_DATE}` },
    source: "https://www.tolapeckham.com/",
  },
  {
    name: "Bermondsey Social Club",
    contact_email: "info@bermondseysocialclub.co.uk",
    contact_phone: "020 3086 8604",
    fact: { c: "confirm", s: `ConnectsMusic venue listing, ${SRC_DATE}. The venue's own site wouldn't load to double-check.` },
    phoneFact: { c: "confirm", s: `ConnectsMusic and eventplanner.co.uk listings agree, ${SRC_DATE}` },
    source: "https://connectsmusic.com/listing/bermondsey-social-club/",
  },
]

// Other suitable rooms found while verifying the business-plan leads.
export const NEW_VENUES = [
  {
    name: "The Broadcaster",
    area: "White City",
    website: "https://the-broadcaster.squarespace.com/private-events",
    contact_email: "events@thebroadcaster.co.uk",
    contact_phone: "020 3908 7007",
    capacity: 170,
    spaces: "Rooftop: semi-exclusive 70 standing, fully exclusive 170 standing, all-year-round. The Playroom: dedicated events floor with its own private bar and terrace, 120 standing. The Hut (rear of the rooftop): 120 standing. First Floor: 100 standing with bar and terrace.",
    indoor_outdoor: "both",
    rooftop: 1,
    licence: "Not stated on the private events page. Ask.",
    restrictions: "Bookings of 13+ by enquiry. Music and DJs aren't mentioned on the events page — confirm a DJ-led night is possible.",
    status: "researching",
    shortlist: true,
    priority: 2,
    negotiation_notes: "The strongest rooftop option found. Ask whether the rooftop (fully exclusive) or The Playroom suits a DJ-led night, and how late music can run.",
    facts: {
      contact_email: { c: "verified", s: `Venue's own private events page, ${SRC_DATE}` },
      contact_phone: { c: "verified", s: `Venue's own private events page, ${SRC_DATE}` },
      capacity: { c: "confirm", s: "Venue site: rooftop fully exclusive 170 standing" },
      spaces: { c: "confirm", s: "Venue's private events page" },
      rooftop: { c: "verified", s: "Venue's private events page" },
    },
    sources: "https://the-broadcaster.squarespace.com/private-events\nhttps://www.tagvenue.com/rooms/london/88065/the-broadcaster-white-city/the-rooftop-bar",
  },
  {
    name: "Paper Dress Vintage",
    area: "Hackney",
    website: "https://paperdressvintage.co.uk/private-hire",
    contact_email: "hello@paperdressvintage.co.uk",
    contact_phone: "0208 510 0520",
    capacity: 100,
    spaces: "Private party space next door to the main venue, 40–100 guests, available on Saturdays (the main venue isn't hired out at weekends). Backyard open till late.",
    indoor_outdoor: "both",
    rooftop: 0,
    sound_system: "PA: 2 × QSC KW2 + 2 subs; Turbosound Milan M10 DJ monitor",
    mixer: "Yamaha MG16 (16-channel mixing desk, not a DJ mixer)",
    cdjs: "No DJ equipment provided; laptops and devices can plug into the PA",
    security: "Included in the hire fee (with cleaning)",
    hire_fee_pence: 15000,
    hire_fee_note: "£150 covers security and cleaning (venue's private hire page).",
    bar_min_pence: 100000,
    bar_min_note: "£1,000 minimum bar spend (venue's private hire page).",
    licence: "Saturdays 7.30pm–2am for private hire.",
    status: "researching",
    shortlist: false,
    priority: 0,
    negotiation_notes: "Lower fit: tops out at 100 and has no DJ kit (we'd bring CDJs and a DJM). Cheap and security is included. Kept as a fallback.",
    facts: {
      contact_email: { c: "verified", s: `Venue's own site (encoded mailto link), ${SRC_DATE}` },
      contact_phone: { c: "verified", s: "Venue's own site" },
      capacity: { c: "verified", s: "Venue's private hire page: “suitable for 40-100 guests”" },
      sound_system: { c: "verified", s: "Venue's private hire page" },
      mixer: { c: "verified", s: "Venue's private hire page" },
      cdjs: { c: "verified", s: "Venue's private hire page: “DJ equipment not provided”" },
      security: { c: "verified", s: "Venue's private hire page" },
      hire_fee_pence: { c: "verified", s: `Published on the venue's private hire page, ${SRC_DATE} — not a quote` },
      bar_min_pence: { c: "verified", s: `Published on the venue's private hire page, ${SRC_DATE} — not a quote` },
      licence: { c: "verified", s: "Venue's private hire page" },
    },
    sources: "https://paperdressvintage.co.uk/private-hire",
  },
  {
    name: "The Old Blue Last",
    area: "Shoreditch",
    website: "https://theoldbluelast.com/christmas-party-hire-shoreditch",
    capacity: 150,
    spaces: "Live Room (2nd floor): 150 capacity with DJ booth, sound desk and in-house backline. Red Room (ground floor): up to 25. Whole venue: 300+.",
    indoor_outdoor: "indoor",
    rooftop: 0,
    cdjs: "DJ booth in the Live Room (models not listed)",
    status: "researching",
    shortlist: true,
    priority: 1,
    negotiation_notes: "No email address is published — use the enquiry form on their site. A third-party listing suggested ~£1,500 minimum spend (unverified).",
    facts: {
      capacity: { c: "confirm", s: "Venue's own hire page: “our 150-capacity live room”" },
      spaces: { c: "confirm", s: "Venue's own hire page" },
      cdjs: { c: "confirm", s: "Venue's own hire page" },
    },
    sources: "https://theoldbluelast.com/christmas-party-hire-shoreditch\nhttps://www.tagvenue.com/rooms/london/105176/the-old-blue-last/live-room",
  },
  {
    name: "The Waiting Room",
    area: "Stoke Newington",
    address: "Stoke Newington, London N16 0PE",
    capacity: 120,
    indoor_outdoor: "indoor",
    rooftop: 0,
    sound_system: "Martin Audio",
    cdjs: "CDJs and turntables available (models not listed)",
    hire_fee_pence: 90000,
    hire_fee_note: "Hire Space shows “£900 / venue fee” as indicative pricing — not a quote.",
    status: "researching",
    shortlist: true,
    priority: 1,
    negotiation_notes: "No email found on an official page. Contact through Hire Space or the venue's own channels. Check whether £900 applies to a late club night.",
    facts: {
      capacity: { c: "confirm", s: "Hire Space listing: 120 standing" },
      sound_system: { c: "confirm", s: "Hire Space listing: “Pro Martin Audio sound”" },
      cdjs: { c: "confirm", s: "Hire Space listing" },
      hire_fee_pence: { c: "estimate", s: "Hire Space indicative pricing" },
    },
    sources: "https://hirespace.com/Venues/London/110350/The-Waiting-Room",
  },
  {
    name: "Love Shack — The Bunker",
    area: "Bethnal Green",
    address: "East London E2 9HA",
    capacity: 130,
    indoor_outdoor: "indoor",
    rooftop: 0,
    sound_system: "PA system",
    cdjs: "Bring your own DJ kit (listing)",
    bar_min_note: "Canvas listing: minimum spend from £2,000 on Fridays and Saturdays.",
    licence: "Hire window to 03:00 (listing).",
    status: "researching",
    shortlist: true,
    priority: 0,
    negotiation_notes: "No email found on an official page. The Friday/Saturday minimum looks high for 130 guests.",
    facts: {
      capacity: { c: "confirm", s: "Canvas Events listing: 130 standing" },
      sound_system: { c: "confirm", s: "Canvas Events listing" },
      cdjs: { c: "confirm", s: "Canvas Events listing: “BYO DJ”" },
      licence: { c: "confirm", s: "Canvas Events listing" },
    },
    sources: "https://www.canvas-events.co.uk/venues/2080/love-shack/rooms/1568/the-bunker",
  },
]

// ---------- the enquiry itself ----------

const PERSONAL = {
  "Arch 535":
    "Arch 535 is high on our list. A Brixton arch with in-house decks feels exactly right for ROUGE, and it keeps us close to where ROUGE 001 began. I've seen the capacity listed differently in a couple of places, so your licensed standing capacity would be really helpful.",
  TOLA:
    "TOLA is one of our first choices. The Funktion-One system, the refurbished club room and the terrace are exactly the setting we're after. I'd love to know which room you'd recommend for 100–150 guests (the Main Room or the Garden Room) and whether the terrace can be used during an evening event.",
  "Bermondsey Social Club":
    "The arch, the covered courtyard and your late licence make Bermondsey Social Club a strong fit. One question up front: a listing mentioned that guests under 25 aren't admitted after 9pm — does that apply to promoted, ticketed nights? Our crowd is mostly in their twenties and thirties, so it's important for us to check.",
  "The Broadcaster":
    "Your rooftop stood out straight away. I'd love to know whether the rooftop on an exclusive basis, or The Playroom with its own bar and terrace, could host a music-led evening with DJs, and how late music can run.",
  "Paper Dress Vintage":
    "Your party space next door looks like a lovely size for us. I saw that DJ equipment isn't provided — we're happy to bring our own decks and mixer to plug into your PA, if that works for you.",
}

export function enquirySubject(venue) {
  return `Venue enquiry: ROUGE 002, 100–150 guests at ${venue.name}`
}

export function enquiryBody(venue) {
  const personal = PERSONAL[venue.name] || `We think ${venue.name} could be a great fit and would love to learn more.`
  return `Hi ${venue.name} team,

I'm Dev Basra, founder of ROUGE, an independent, music-led event brand in London. Our debut night, ROUGE 001, was at BRICKS in Brixton on 24 October: the room was packed, and the bar took £2,200 on the night. You can see photos at rouge-london.com/archive.

We're now planning ROUGE 002 and looking for a venue for 100–150 guests. ${personal}

What matters most to us is excellent sound, professional DJ equipment, ideally rooftop or terrace access, proper security, and hire terms that work commercially for both of us.

Could you let me know:

1. Availability: which Friday and Saturday nights you have free over the next few months
2. Hire fee, and what it includes
3. Minimum bar spend, and how it's calculated
4. Capacity: the licensed standing capacity for the space you'd recommend
5. Security: whether it's included, or the cost
6. DJ equipment: CDJ and mixer models, booth monitors, and whether we can bring our own
7. Licensing hours: finish time and last entry
8. Ticketing: whether we can run our own ticketing (we use DICE), and any door arrangements you have

I'd be glad to come and see the space or have a quick call.

Best wishes,

Dev Basra
Founder, ROUGE
dev.basra@icloud.com · 07852 805355
rouge-london.com · Instagram @rouge.london`
}

export function followUpBody(venue, sentOn) {
  const when = sentOn ? new Date(sentOn.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }) : "last week"
  return `Hi ${venue.name} team,

Just following up on my email from ${when} about hosting ROUGE 002, a music-led night for 100–150 guests.

If you're able to share your availability, hire fee and minimum bar spend, that would be brilliant. I'm also happy to talk it through on the phone: 07852 805355.

Best wishes,

Dev Basra
Founder, ROUGE
dev.basra@icloud.com · rouge-london.com`
}

function ins(db, table, row) {
  const cols = Object.keys(row)
  return db
    .prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `?${i + 1}`).join(", ")})`)
    .bind(...cols.map((c) => (row[c] !== null && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c] ?? null)))
}

// Runs once: fills verified contacts, adds the extra venues, and drafts one enquiry per emailable venue.
export async function applyOutreach(db) {
  const done = await db.prepare("SELECT value FROM hq_meta WHERE key = ?1").bind(OUTREACH_KEY).first()
  if (done) return
  const claim = await db.prepare("INSERT OR IGNORE INTO hq_meta (key, value) VALUES (?1, datetime('now'))").bind(OUTREACH_KEY).run()
  if (claim && claim.meta && claim.meta.changes === 0) return

  const e002 = await db.prepare("SELECT id FROM hq_events WHERE number = '002' ORDER BY id LIMIT 1").first()
  const shortlistId = e002 ? e002.id : null
  const byName = async (name) => db.prepare("SELECT * FROM hq_venues WHERE lower(name) = lower(?1) LIMIT 1").bind(name).first()

  for (const c of CONTACTS) {
    const v = await byName(c.name)
    if (!v) continue
    let facts = {}
    try {
      facts = JSON.parse(v.facts || "{}") || {}
    } catch {}
    if (!v.contact_email) facts.contact_email = c.fact
    if (c.contact_phone && !v.contact_phone && c.phoneFact) facts.contact_phone = c.phoneFact
    const sources = v.sources && v.sources.includes(c.source) ? v.sources : [v.sources, c.source].filter(Boolean).join("\n")
    await db
      .prepare("UPDATE hq_venues SET contact_email = COALESCE(contact_email, ?1), contact_phone = COALESCE(contact_phone, ?2), facts = ?3, sources = ?4, updated_at = datetime('now') WHERE id = ?5")
      .bind(c.contact_email, c.contact_phone || null, JSON.stringify(facts), sources, v.id)
      .run()
  }

  for (const nv of NEW_VENUES) {
    if (await byName(nv.name)) continue
    const { shortlist, ...row } = nv
    if (shortlist && shortlistId) row.shortlist_event_id = shortlistId
    await ins(db, "hq_venues", row).run()
  }

  const emailable = (await db.prepare("SELECT * FROM hq_venues WHERE contact_email IS NOT NULL AND status NOT IN ('rejected', 'past')").all()).results || []
  for (const v of emailable) {
    const has = await db.prepare("SELECT id FROM hq_enquiries WHERE venue_id = ?1 LIMIT 1").bind(v.id).first()
    if (has) continue
    await ins(db, "hq_enquiries", {
      venue_id: v.id,
      event_id: shortlistId,
      kind: "enquiry",
      status: "draft",
      include: v.name === "Paper Dress Vintage" ? 0 : 1,
      to_email: v.contact_email,
      subject: enquirySubject(v),
      body: enquiryBody(v),
    }).run()
  }
  await db
    .prepare("INSERT INTO hq_activity (kind, entity, summary) VALUES ('system', 'enquiries', ?1)")
    .bind(`Drafted ${emailable.length} venue enquiries for ROUGE 002 and added ${NEW_VENUES.length} verified venues`)
    .run()
}
