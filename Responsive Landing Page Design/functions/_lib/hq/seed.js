// First-run contents for ROUGE HQ. Runs once, in one transaction, on an empty HQ.
// Rules: nothing here is invented. ROUGE 001 figures are the ones Dev reported (marked "to confirm" until
// receipts are checked). Venue details come from public listings found in Oct–Nov 2026 and are all
// marked "to confirm" with their source; no quotes, prices or kit lists were made up. Budget lines for
// ROUGE 002 are the business plan's planning envelopes and are marked as estimates.
// Exports no request handlers, so Pages does not turn this into a route.

import { NIGHT_TEMPLATE, PHASES } from "./templates.js"

const C = (c, s) => ({ c, s })
const LISTING_NOV26 = "Public listing, checked Nov 2026"

const VENUES = [
  {
    id: 1,
    name: "Arch 535",
    area: "Brixton",
    address: "535 Orhan's Yard, off Barrington Road, London SW9 8QB",
    website: "https://arch535brixton.co.uk",
    contact_phone: "07481 975951",
    capacity: 150,
    spaces: "Railway arch used for club nights and gallery events.",
    indoor_outdoor: "indoor",
    rooftop: 0,
    cdjs: "CDJs (models not confirmed)",
    turntables: "Technics (model not confirmed)",
    hire_fee_note: "Not published. Ask for promoter terms and one all-in quote.",
    bar_min_note: "Not published.",
    status: "researching",
    shortlist_event_id: 2,
    priority: 3,
    negotiation_notes: "First negotiation target in the business plan. Lead with the ROUGE 001 bar result (£2,200 at BRICKS against a £750 minimum; that was venue revenue) and the packed-room photos.",
    facts: {
      address: C("confirm", "Skiddle venue listing"),
      capacity: C("confirm", "Venue site said 150 (ROUGE research, Oct 2026); Skiddle lists 200. Get the legal standing capacity in writing."),
      cdjs: C("confirm", "ROUGE research, Oct 2026"),
      turntables: C("confirm", "ROUGE research, Oct 2026"),
      contact_phone: C("confirm", "Skiddle venue listing"),
    },
    sources: "https://arch535brixton.co.uk\nhttps://www.skiddle.com/whats-on/London/Arch-535/",
  },
  {
    id: 2,
    name: "TOLA",
    area: "Peckham",
    address: "56 Peckham High Street, London SE15 5DP",
    website: "https://tolapeckham.com",
    capacity: 250,
    spaces: "Main Room (cocktail bar / club room): 250 standing. Garden Room (private event space): 150 standing. Terrace: 250 standing, south-facing, rain cover and heaters. Club room refurbished Feb 2026 with acoustic treatment and a retuned system.",
    indoor_outdoor: "both",
    rooftop: 1,
    sound_system: "Funktion-One",
    cdjs: "2 × Pioneer CDJ-2000NXS2",
    mixer: "Pioneer DJM-900NXS2",
    turntables: "2 × Technics 1210 MK7",
    hire_fee_pence: 50000,
    hire_fee_note: "Listing: Main Room from £500/day; Garden Room and Terrace from £400. A listing price, not a promoter quote.",
    bar_min_note: "No minimum spend listed. Ask.",
    licence: "Alcohol licence to 04:00 (listing). Open to 4am weekends, 3am weekdays.",
    restrictions: "Venue supplies all alcohol; no BYO drinks. Terrace hours conflict on the listing (23:00 vs midnight).",
    status: "researching",
    shortlist_event_id: 2,
    priority: 2,
    negotiation_notes: "Best rooftop + sound enquiry. Ask which room suits 110–150, terrace hours on a club night, and whether the Feb 2026 refit changed the booth.",
    facts: {
      address: C("verified", "Matches on Tagvenue and Brixton Buzz (Feb 2026)"),
      capacity: C("confirm", "Tagvenue listing (Main Room 250 standing)"),
      spaces: C("confirm", "Tagvenue listing; Brixton Buzz, Feb 2026"),
      rooftop: C("confirm", "Listed as a terrace; check whether it is a roof terrace and usable late"),
      sound_system: C("confirm", "Tagvenue listing"),
      cdjs: C("confirm", "Tagvenue listing (Main Room)"),
      mixer: C("confirm", "Tagvenue listing (Main Room)"),
      turntables: C("confirm", "Tagvenue listing (Main Room)"),
      hire_fee_pence: C("confirm", "Tagvenue listing"),
      licence: C("confirm", "Tagvenue listing"),
      restrictions: C("confirm", "Tagvenue listing"),
    },
    sources: "https://tagvenue.com/venues/london/20906/tola\nhttps://www.brixtonbuzz.com/2026/02/peckham-club-tola-relaunches-with-new-bar-club-room-soundsystem-and-refreshed-interior/",
  },
  {
    id: 3,
    name: "Bermondsey Social Club",
    area: "Bermondsey",
    address: "Arch 19, Almond Road, London SE16 3LR",
    website: "https://bermondseysocialclub.co.uk",
    capacity: 120,
    spaces: "Railway arch with bar, stage, dance floor and DJ booth, plus a covered, secluded outdoor area with heaters.",
    indoor_outdoor: "both",
    rooftop: 0,
    sound_system: "In-house PA and light rig (models not listed)",
    cdjs: "DJ equipment included (models not listed)",
    security: "Not listed as included. Ask whether security is bundled.",
    hire_fee_pence: 60000,
    hire_fee_note: "Listing: Fri–Sat from £600 hire + minimum spend (inc. VAT). Hire covers staff, utilities, sound, DJ kit and lights.",
    bar_min_note: "Listings show both '£600 + £3,000' (Fri–Sat) and 'from £2,760 minimum spend per evening'. Ambiguous: get written terms.",
    licence: "4am licence 7 days (listing). Finish 04:00 Fri–Sat, 03:00 Sun–Thu.",
    restrictions: "Listing says: no guests under 25 after 21:00; no 18ths; venue supplies alcohol. Promoted and ticketed events allowed. Cancellation: full refund 60+ days, 50% at 30–60 days, none within 30 days.",
    status: "researching",
    shortlist_event_id: 2,
    priority: 1,
    negotiation_notes: "Best operations package. Critical question: does the 'no under-25s after 9pm' rule apply to promoted club nights? It would exclude part of ROUGE's audience.",
    facts: {
      address: C("confirm", "Tagvenue listing"),
      capacity: C("confirm", "Tagvenue listing; also 120 in ROUGE research, Oct 2026"),
      spaces: C("confirm", "Tagvenue listing"),
      sound_system: C("confirm", "Tagvenue listing"),
      cdjs: C("confirm", "Tagvenue listing"),
      security: C("confirm", "Tagvenue listing does not mention it"),
      hire_fee_pence: C("confirm", "Tagvenue listing"),
      licence: C("confirm", "Tagvenue listing"),
      restrictions: C("confirm", "Tagvenue listing"),
    },
    sources: "https://tagvenue.com/rooms/london/116/bermondsey-social-club/whole-venue\nhttps://bermondseysocialclub.co.uk",
  },
  {
    id: 4,
    name: "BRICKS",
    area: "Brixton",
    hire_fee_pence: 12000,
    hire_fee_note: "What ROUGE 001 paid.",
    bar_min_pence: 75000,
    bar_min_note: "ROUGE 001 minimum. Bar takings reported at £2,200 (2.93×).",
    status: "past",
    relationship: 1,
    negotiation_notes: "Home of ROUGE 001 on 24 Oct 2026. Strong first result to reference with every other venue.",
    facts: {
      hire_fee_pence: C("verified", "Your ROUGE 001 records"),
      bar_min_pence: C("verified", "Your ROUGE 001 records"),
    },
    sources: "",
  },
]

const IDEAS = [
  ["The Red Hour", "9–10pm on vinyl at conversation volume before the floor opens; arrive early, hear the deep cuts.", "experience"],
  ["The travelling light", "One portable red analogue lighting set that comes to every venue, so every room looks like ROUGE.", "experience"],
  ["The Frame Wall", "Instant photos pinned through the night, then scanned (with consent) into The Archive.", "content"],
  ["ROUGE in Residence", "A quarterly home at one music venue without committing to expensive exclusive dates.", "partnership"],
  ["Soft Sundays", "4–9pm listening sessions: soul, jazz and slow house, food partner, home by ten.", "event"],
  ["The ROUGE Circle", "Free inner list: first access, a vote on the next edition's sound, early Archive.", "campaign"],
  ["Open selector call", "Send three tracks; one new warm-up DJ per night, paid and credited.", "radio"],
  ["Numbered wristbands", "Fabric wristbands numbered by event: collectable proof that you were there.", "merch"],
]

const BUDGET_002 = [
  ["Venue hire / promoter fee", 35000, "Published Saturday hire ranged £150–£350 for comparable rooms; TOLA listed from ~£500/day"],
  ["Security (if not bundled)", 15000, "2 SIA staff × 6 h; London door pay £15–22/h before agency margin"],
  ["Photo / video", 22000, "London nightlife coverage advertised from £220"],
  ["Guest selector / warm-up", 10000, "Pay every non-founder DJ something"],
  ["Paid promotion", 10000, "Instagram CPM ≈ £5–6: £100 ≈ 17–20k impressions"],
  ["Print / branded details", 6000, "Posters, wristbands, liner cards"],
  ["Event insurance", 7000, "One-day public liability from ~£62; £0 only if venue cover extends to promoter"],
  ["Transport / consumables", 6000, "Kit runs, gaffer, batteries, water"],
  ["Contingency", 15000, "Fixed buffer, not a target to spend"],
]

const BRAND_NOTE = `ROUGE is an intimate music gathering in London: independent gatherings and selected sounds, founded by DJ Dev.

## The feeling
Small rooms that feel full. Warm, red-lit, analogue. Quality R&B, soul, house and UK garage — culturally fluid, never bottle-service. Personal: people come back because it felt like theirs.

## Who it's for
London music lovers in their 20s and 30s who want taste over spectacle, plus launch-night guests and subscribers who return.

## Look and voice
- Oxblood, wine and near-black with warm ivory. Bodoni Moda for display, DM Sans for everything functional.
- Original event photography, credited and consent-checked. No stock imagery.
- Voice: short, confident, warm. "Selected with intention." Never hype for its own sake.

## Rules we keep
- Email only people who opted in; make unsubscribing easy. Never sell attendee data.
- Ticket receipts are ROUGE revenue; venue bar takings are the venue's unless a written share exists.
- No contract before the worst-case cash loss is written down and acceptable.

## Links
- Site: rouge-london.com · Instagram: @rouge.london · DJ: @djdevbasra · hello@rouge-london.com`

const RECON_NOTE = `Launch night at BRICKS, Brixton, 24 October 2026. The room was packed.

| Item | £ | Status |
|---|---|---|
| DICE receipts (reported) | 552 | Verify the net bank payout, fees and refunds |
| Door receipts (reported) | 190 | Verify card-reader fees and cash/card settlement |
| **Promoter receipts** | **742** | Not including bar |
| Venue hire | (120) | Tracked |
| Other estimated costs | (149) | Posters, ads, props, website — reconcile |
| **Provisional residual** | **473** | Before overlooked costs or tax |
| Venue bar takings | 2,200 | Venue revenue, against a £750 minimum (2.93×) |

## Still to verify
- Exact DICE net payout and fee treatment
- Door settlement and fees
- Complete supplier receipts
- Actual count of guests scanned (attendance was not counted, so spend per head is unknown)`

const BLUEPRINT_NOTE = `**Brief:** "A new room. The same feeling."

| Parameter | Target |
|---|---|
| Capacity | 110–150 legal standing, with room for staff and circulation |
| Frequency | Quarterly at first |
| Hours | About 9pm to 2–3am, if licensed |
| Tickets | Early £10 · general £12.50 · final £15 (test willingness to pay) |
| Production | Good in-house PA, 2+ club CDJs, DJM mixer, monitors, laptop backup |
| Commercial | Ticket receipts kept by ROUGE; clear settlement; no surprise bar liability |
| Bar guarantee | Ideally ≤ £1,500 for a comparable room |
| Stop-loss | No contract before the worst-case loss is documented and acceptable |

## Success tests
- ≥ 70% paid sell-through before event week
- ≥ 85% of paid bookings actually attend
- Payout reconciled within 7 days
- 20+ responses to a short feedback form
- ≥ 25% contribution margin where feasible

## Venue scoring
Economics 30% · Sound & booth 25% · Atmosphere 20% · Safety & execution 15% · Location / weather 10%.

## Negotiation package
- Pitch the ROUGE 001 bar result (£2,200) and packed-room photos; be clear the bar revenue was BRICKS'.
- Ask for promoter terms and one all-in quote showing VAT, security, kit and extras.
- Trade bar confidence for lower fixed hire, but cap personal liability and define what counts towards the minimum.
- Get floor plan, permitted capacity, settlement, refund and cancellation terms in writing.`

const LEADS_NOTE = `These venues came up in the business-plan research but have **not** been re-verified, so they are not in the venue database yet. Use Deep Research (or a call) to check each one, then add it as a venue.

- **The Waiting Room, N16** — reported 120 capacity, Martin Audio, Pioneer/Technics. Hire by quote.
- **Love Shack Bunker, Bethnal Green** — reported 150, hidden arch, ticketed events allowed. Previously published Sat £350 + £1,500 bar minimum; CDJs £150 extra.
- **The Old Blue Last, Shoreditch** — reported 150 live room. Third-party listing suggested ~£1,500 minimum spend.
- **Paper Dress Vintage, Hackney** — smaller private room (~100). Previously published Sat £150 + £1,000 minimum; DJ kit extra.
- **The Broadcaster rooftop, W12** — reported up to 170, heated/covered terrace. Third-party listing from ~£3,000 minimum spend.`

function ins(db, table, row) {
  const cols = Object.keys(row)
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `?${i + 1}`).join(", ")})`
  return db.prepare(sql).bind(...cols.map((c) => (row[c] !== null && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c] ?? null)))
}

export function seedStatements(db) {
  const out = [db.prepare("INSERT INTO hq_meta (key, value) VALUES ('seeded', datetime('now'))")]

  out.push(
    ins(db, "hq_events", {
      id: 1, number: "001", name: "ROUGE 001", status: "completed", date: "2026-10-24", venue_id: 4, venue_name: "BRICKS, Brixton",
      bar_minimum_pence: 75000, bar_takings_pence: 220000, cover: "/assets/001/06-sm.jpg",
      tagline: "Launch night.",
      summary: "The first ROUGE. A packed room at BRICKS, Brixton. Bar takings were reported at £2,200 against a £750 minimum — venue revenue, but strong evidence for the next negotiation.",
      notes: "Attendance was not counted. Add the scan count once you have it.",
    }),
    ins(db, "hq_events", {
      id: 2, number: "002", name: "ROUGE 002", status: "planning", ticket_target: 120,
      ticket_price: "£10 early · £12.50 general · £15 final (to test)", cover: "/assets/001/10-sm.jpg",
      tagline: "A new room. The same feeling.",
      summary: "110–150 capacity, a high-performing DJ setup, red-toned analogue visuals, superb sound, a documentary photo story and a controlled, welcoming door. Rooftop access is a bonus, not the brief.",
      notes: "Date and venue not confirmed yet. Set the date, then use 'Schedule from date' to turn the checklist offsets into deadlines.",
    }),
    ins(db, "hq_events", {
      id: 3, number: "003", name: "ROUGE 003", status: "idea", cover: "/assets/001/03-sm.jpg",
      summary: "Ideas stage. Collect direction here once 002 is booked.",
    }),
  )

  for (const v of VENUES) out.push(ins(db, "hq_venues", v))

  out.push(ins(db, "hq_templates", { id: 1, name: NIGHT_TEMPLATE.name, kind: "checklist", items: NIGHT_TEMPLATE.items, notes: NIGHT_TEMPLATE.notes }))

  // ROUGE 002: the standard checklist and timeline, without dates.
  let taskId = 1
  NIGHT_TEMPLATE.items.forEach((item, i) => {
    const parent = taskId++
    out.push(ins(db, "hq_tasks", { id: parent, event_id: 2, title: item.title, section: item.section, phase: item.phase, priority: item.priority, offset_days: item.offset, sort: i }))
    item.subtasks.forEach((title, j) => {
      out.push(ins(db, "hq_tasks", { id: taskId++, event_id: 2, parent_id: parent, title, section: item.section, phase: item.phase, priority: "normal", sort: j }))
    })
  })
  PHASES.forEach((p, i) => {
    out.push(ins(db, "hq_milestones", { event_id: 2, phase: p.key, title: p.title, start_offset: p.start, due_offset: p.due, status: p.key === "venue_research" ? "doing" : "todo", sort: i }))
  })

  // ROUGE 001: what is still open from the launch reconciliation.
  ;[
    ["Verify DICE net payout and fee treatment", "high"],
    ["Confirm door settlement and card fees", "high"],
    ["Collect every ROUGE 001 supplier receipt", "normal"],
    ["Record the actual guest scan count", "normal"],
  ].forEach(([title, priority], i) => {
    out.push(ins(db, "hq_tasks", { id: taskId++, event_id: 1, title, section: "After the night", phase: "reconcile", priority, sort: i }))
  })

  // ROUGE 001 money, exactly as reported, all marked for confirmation.
  out.push(
    ins(db, "hq_ledger", { event_id: 1, kind: "income", category: "Tickets", description: "DICE ticket receipts (reported)", amount_pence: 55200, status: "actual", confidence: "confirm", date: "2026-10-24", party: "DICE", notes: "Verify the net bank payout, platform fees and refunds." }),
    ins(db, "hq_ledger", { event_id: 1, kind: "income", category: "Door", description: "Door sales (reported)", amount_pence: 19000, status: "actual", confidence: "confirm", date: "2026-10-24", notes: "Verify card-reader fees and cash/card settlement." }),
    ins(db, "hq_ledger", { event_id: 1, kind: "expense", category: "Venue", description: "Venue hire — BRICKS", amount_pence: 12000, status: "actual", confidence: "verified", date: "2026-10-24", party: "BRICKS" }),
    ins(db, "hq_ledger", { event_id: 1, kind: "expense", category: "Marketing & production", description: "Posters, ads, props, website etc.", amount_pence: 14900, status: "actual", confidence: "estimate", date: "2026-10-24", notes: "Estimated total. Reconcile against receipts." }),
  )

  BUDGET_002.forEach(([category, amount_pence, notes], i) => {
    out.push(ins(db, "hq_budget", { event_id: 2, category, amount_pence, confidence: "estimate", notes: `Plan envelope. ${notes}`, sort: i }))
  })

  out.push(
    ins(db, "hq_notes", { title: "ROUGE — brand essentials", kind: "brand", body: BRAND_NOTE, pinned: 1, ai_context: 1, tags: "brand, voice" }),
    ins(db, "hq_notes", { title: "ROUGE 001 — launch reconciliation", kind: "debrief", body: RECON_NOTE, event_id: 1, ai_context: 1, tags: "finance, 001" }),
    ins(db, "hq_notes", { title: "ROUGE 002 — blueprint", kind: "brief", body: BLUEPRINT_NOTE, event_id: 2, pinned: 1, ai_context: 1, tags: "002, venues" }),
    ins(db, "hq_notes", { title: "Venue leads to verify", kind: "research", body: LEADS_NOTE, event_id: 2, tags: "venues, to verify" }),
  )

  IDEAS.forEach(([title, body, kind], i) => {
    out.push(ins(db, "hq_ideas", { title, body, kind, status: "spark", pinned: i === 0 ? 1 : 0, source: "Business plan 2026–28" }))
  })

  out.push(
    ins(db, "hq_radio", { number: "001", title: "ROUGE Radio 001", status: "idea", platform: "Mixcloud", notes: "Monthly edited mix series. The 90-day plan puts recording episode 001 in the first two weeks." }),
    ins(db, "hq_people", { name: "Dev", role: "Founder / creative director", email: "hello@rouge-london.com", instagram: "@djdevbasra", areas: "everything" }),
    ins(db, "hq_activity", { kind: "system", entity: "hq", summary: "ROUGE HQ set up with ROUGE 001, 002 and 003" }),
  )
  return out
}
