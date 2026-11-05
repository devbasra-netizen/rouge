// ROUGE HQ planning templates. Exports no request handlers, so Pages does not turn this into a route.
// Offsets are days relative to the event date (negative = before the night). They only become real
// deadlines when an event has a date and you press "Schedule from date"; nothing here is a fact.

// The production timeline every event shares.
export const PHASES = [
  { key: "venue_research", title: "Venue research", start: -100, due: -70 },
  { key: "venue_booking", title: "Venue booking", start: -70, due: -56 },
  { key: "contract", title: "Contract signing", start: -56, due: -49 },
  { key: "artwork", title: "Artwork approval", start: -56, due: -42 },
  { key: "ticket_launch", title: "Ticket launch", start: -42, due: -35 },
  { key: "promo", title: "Promotional campaigns", start: -35, due: -1 },
  { key: "staffing", title: "Staffing", start: -28, due: -7 },
  { key: "equipment", title: "Equipment checks", start: -21, due: -3 },
  { key: "final_prep", title: "Final event preparation", start: -7, due: -1 },
  { key: "execution", title: "Event execution", start: 0, due: 0 },
  { key: "reconcile", title: "Post-event reconciliation", start: 1, due: 10 },
]

export const PHASE_KEYS = PHASES.map((p) => p.key)

// [title, section, phase, offsetDays, priority, subtasks]
const NIGHT = [
  ["Negotiate venue hire", "Venue", "venue_booking", -63, "high", ["Send enquiry pack with the ROUGE 001 result and photos", "Ask for one all-in quote: VAT, security, kit and extras", "Agree hire fee and deposit in writing"]],
  ["Confirm bar minimum and what counts towards it", "Venue", "venue_booking", -56, "high", ["Minimum in writing", "Cap personal liability if it is missed", "Agree settlement timing"]],
  ["Check licence, capacity and finish time", "Venue", "venue_booking", -56, "high", ["Legal standing capacity", "Licensed finish time", "Who holds PPL/PRS music licensing"]],
  ["Sign venue contract", "Venue", "contract", -49, "urgent", ["Floor plan and permitted capacity", "Cancellation and refund terms", "Deposit paid"]],
  ["Event insurance / public liability", "Venue", "contract", -28, "normal", ["Check whether venue cover extends to the promoter"]],
  ["Arrange security", "Safety", "staffing", -28, "high", ["Bundled by venue or agency?", "SIA headcount and hours", "Search, entry and ejection policy"]],
  ["DJ setup and technical rider", "Sound", "equipment", -42, "high", ["Send rider: 2+ club CDJs, DJM mixer, monitors", "Laptop / Serato backup plan", "Photo of the booth layout"]],
  ["Book soundcheck", "Sound", "equipment", -14, "normal", []],
  ["Soundcheck", "Sound", "execution", 0, "high", ["Levels and monitors", "Backup USBs tested"]],
  ["Set up ticketing", "Tickets", "ticket_launch", -42, "high", ["Ticket ladder: early / general / final", "Decide who pays booking fees", "Refund policy written"]],
  ["Ticket launch: list first, then public", "Tickets", "ticket_launch", -35, "high", ["Presale email to subscribers", "Public on-sale post"]],
  ["Guest list", "Door", "final_prep", -3, "normal", ["DJs and crew", "Comps capped", "Shared with the door team"]],
  ["Artwork approval", "Brand", "artwork", -42, "high", ["Poster", "Story and reel cut-downs", "Ticket image"]],
  ["Branding and signage", "Brand", "final_prep", -10, "normal", ["Posters printed", "Wristbands", "Red light kit"]],
  ["Promotional campaign plan", "Marketing", "promo", -35, "high", ["Content calendar", "Paid promo budget", "Teaser mini-mix"]],
  ["Social media schedule", "Marketing", "promo", -28, "normal", ["Announcement", "Line-up / venue reveal", "Final-week countdown"]],
  ["Book photographer", "Content", "staffing", -28, "high", ["Brief and shot list", "Usage rights agreed"]],
  ["Camera equipment", "Content", "equipment", -7, "normal", ["Batteries charged", "Memory cards cleared", "Kit list packed"]],
  ["Door operations plan", "Door", "final_prep", -7, "high", ["Scanner app tested", "Card reader and float", "Wristband process"]],
  ["Staff briefing", "Team", "final_prep", -1, "high", ["Running order shared", "Roles and shifts confirmed", "Emergency contacts"]],
  ["Final event preparation", "Event day", "final_prep", -2, "high", ["Kit check", "Transport booked", "Cash and card float"]],
  ["Run the night", "Event day", "execution", 0, "urgent", []],
  ["Equipment collection", "Event day", "execution", 1, "normal", ["Everything returned or collected"]],
  ["Finance reconciliation", "After the night", "reconcile", 7, "high", ["DICE payout received", "Door settlement", "Receipts filed", "Bar result from the venue"]],
  ["Post-event thank-you messages", "After the night", "reconcile", 2, "normal", ["Crew", "Venue", "Guests (email)"]],
  ["Post-event content release", "After the night", "reconcile", 5, "normal", ["Photo selects", "Recap reel", "Archive page updated"]],
  ["Debrief and lessons", "After the night", "reconcile", 10, "normal", []],
]

export const NIGHT_TEMPLATE = {
  name: "ROUGE night (from 001)",
  kind: "checklist",
  notes: "The standard production checklist, built from what ROUGE 001 needed. Apply it to any new event.",
  items: NIGHT.map(([title, section, phase, offset, priority, subtasks]) => ({ title, section, phase, offset, priority, subtasks })),
}

// A starting shape for the night. Times are suggestions for a 9pm–3am licence; edit them per venue.
export const RUN_TEMPLATE = [
  ["18:00", "Load-in and kit check", "Booth"],
  ["19:00", "Soundcheck", "Booth"],
  ["20:30", "Team briefing", "Front of house"],
  ["21:00", "Doors open", "Entrance"],
  ["21:00", "Warm-up set", "Booth"],
  ["23:00", "Main set", "Booth"],
  ["01:30", "Last entry", "Entrance"],
  ["02:45", "Last record", "Booth"],
  ["03:00", "Lights up, pack-down", "Room"],
  ["03:30", "Settlement with the venue", "Office"],
]

export const ROLES = ["Door management", "Photography", "Videography", "Guest experience", "Venue liaison", "Social media", "Technical support", "DJ", "Security"]
