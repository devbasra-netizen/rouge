// ROUGE HQ record types: one place that says which tables and columns the API may touch.
// Every query the generic API builds uses only names from here, and every value is bound, never spliced.
// Exports no request handlers, so Pages does not turn this into a route.

const CONF = "enum:verified|estimate|confirm"

// Field specs: text (≤ 400 chars), long (≤ 60k), int, money (whole pence), date (YYYY-MM-DD),
// time (HH:MM), bool (0/1), json, enum:a|b, ref:<type>. A trailing "!" means required on create.
export const TYPES = {
  events: {
    table: "hq_events",
    label: "event",
    title: "name",
    order: "CASE status WHEN 'completed' THEN 2 WHEN 'cancelled' THEN 3 ELSE 1 END, COALESCE(date, '9999'), number",
    filters: ["status"],
    search: ["name", "number", "venue_name", "tagline", "summary"],
    fields: {
      number: "text",
      name: "text!",
      status: "enum:idea|planning|confirmed|on_sale|completed|cancelled",
      date: "date",
      start_time: "time",
      end_time: "time",
      venue_id: "ref:venues",
      venue_name: "text",
      capacity: "int",
      ticket_target: "int",
      tickets_sold: "int",
      attendance: "int",
      ticket_price: "text",
      ticket_url: "text",
      bar_minimum_pence: "money",
      bar_takings_pence: "money",
      tagline: "text",
      summary: "long",
      notes: "long",
      cover: "text",
    },
  },
  tasks: {
    table: "hq_tasks",
    label: "task",
    title: "title",
    order: "CASE status WHEN 'done' THEN 1 ELSE 0 END, sort, CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, COALESCE(due, '9999'), id",
    filters: ["event_id", "parent_id", "status", "priority", "section", "phase", "person_id"],
    search: ["title", "notes", "owner", "section"],
    fields: {
      event_id: "ref:events",
      parent_id: "ref:tasks",
      title: "text!",
      section: "text",
      phase: "text",
      status: "enum:todo|doing|done",
      priority: "enum:low|normal|high|urgent",
      owner: "text",
      person_id: "ref:people",
      due: "date",
      offset_days: "int",
      notes: "long",
      sort: "int",
    },
  },
  milestones: {
    table: "hq_milestones",
    label: "milestone",
    title: "title",
    order: "sort, COALESCE(due_date, '9999'), id",
    filters: ["event_id", "status", "phase"],
    search: ["title", "notes"],
    fields: {
      event_id: "ref:events",
      phase: "text",
      title: "text!",
      start_date: "date",
      due_date: "date",
      start_offset: "int",
      due_offset: "int",
      status: "enum:todo|doing|done",
      notes: "long",
      sort: "int",
    },
  },
  run: {
    table: "hq_run",
    label: "running-order item",
    title: "activity",
    order: "sort, time, id",
    filters: ["event_id"],
    search: ["activity", "person", "location", "notes"],
    fields: {
      event_id: "ref:events",
      time: "time",
      activity: "text!",
      person: "text",
      location: "text",
      notes: "long",
      done: "bool",
      sort: "int",
    },
  },
  people: {
    table: "hq_people",
    label: "person",
    title: "name",
    order: "name COLLATE NOCASE",
    filters: [],
    search: ["name", "role", "email", "instagram", "notes"],
    fields: {
      name: "text!",
      role: "text",
      email: "text",
      phone: "text",
      instagram: "text",
      areas: "text",
      notes: "long",
    },
  },
  assignments: {
    table: "hq_assignments",
    label: "assignment",
    title: "role",
    order: "COALESCE(shift_start, '99:99'), role, id",
    filters: ["event_id", "person_id"],
    search: ["role", "person_name", "notes"],
    fields: {
      event_id: "ref:events",
      person_id: "ref:people",
      person_name: "text",
      role: "text!",
      shift_start: "time",
      shift_end: "time",
      confirmed: "bool",
      notes: "long",
    },
  },
  venues: {
    table: "hq_venues",
    label: "venue",
    title: "name",
    order: "CASE status WHEN 'rejected' THEN 2 WHEN 'past' THEN 1 ELSE 0 END, priority DESC, (COALESCE(score_econ, 0) * 6 + COALESCE(score_sound, 0) * 5 + COALESCE(score_atmos, 0) * 4 + COALESCE(score_safety, 0) * 3 + COALESCE(score_location, 0) * 2) DESC, name COLLATE NOCASE",
    filters: ["status", "rooftop", "relationship", "shortlist_event_id"],
    search: ["name", "area", "address", "contact_name", "sound_system", "notes", "negotiation_notes", "restrictions"],
    fields: {
      name: "text!",
      address: "text",
      area: "text",
      contact_name: "text",
      contact_email: "text",
      contact_phone: "text",
      website: "text",
      instagram: "text",
      capacity: "int",
      spaces: "long",
      indoor_outdoor: "enum:indoor|outdoor|both",
      rooftop: "bool",
      sound_system: "text",
      cdjs: "text",
      mixer: "text",
      turntables: "text",
      serato: "text",
      security: "text",
      hire_fee_pence: "money",
      hire_fee_note: "text",
      bar_min_pence: "money",
      bar_min_note: "text",
      deposit_pence: "money",
      deposit_note: "text",
      licence: "text",
      restrictions: "long",
      status: "enum:prospect|researching|enquired|awaiting|negotiating|visited|booked|rejected|past",
      shortlist_event_id: "ref:events",
      relationship: "bool",
      priority: "int",
      negotiation_notes: "long",
      last_contact: "date",
      next_follow_up: "date",
      score_econ: "int",
      score_sound: "int",
      score_atmos: "int",
      score_safety: "int",
      score_location: "int",
      facts: "json",
      sources: "long",
      notes: "long",
    },
  },
  venue_log: {
    table: "hq_venue_log",
    label: "venue log entry",
    title: "title",
    order: "COALESCE(date, created_at) DESC, id DESC",
    filters: ["venue_id", "kind"],
    search: ["title", "body"],
    fields: {
      venue_id: "ref:venues",
      kind: "enum:email|call|meeting|visit|quote|contract|note",
      date: "date",
      title: "text!",
      body: "long",
    },
  },
  ideas: {
    table: "hq_ideas",
    label: "idea",
    title: "title",
    order: "pinned DESC, CASE status WHEN 'parked' THEN 2 WHEN 'converted' THEN 3 ELSE 0 END, updated_at DESC",
    filters: ["status", "kind", "event_id"],
    search: ["title", "body"],
    fields: {
      title: "text!",
      body: "long",
      kind: "enum:event|experience|campaign|radio|content|merch|partnership|other",
      status: "enum:spark|developing|converted|parked",
      pinned: "bool",
      event_id: "ref:events",
      converted_type: "text",
      converted_id: "int",
      source: "text",
    },
  },
  notes: {
    table: "hq_notes",
    label: "note",
    title: "title",
    order: "pinned DESC, updated_at DESC",
    filters: ["kind", "event_id", "venue_id", "pinned", "ai_context"],
    search: ["title", "body", "tags"],
    fields: {
      title: "text!",
      body: "long",
      kind: "enum:note|brand|brief|sop|meeting|research|email|debrief",
      tags: "text",
      event_id: "ref:events",
      venue_id: "ref:venues",
      pinned: "bool",
      ai_context: "bool",
      sources: "json",
    },
  },
  ledger: {
    table: "hq_ledger",
    label: "finance entry",
    title: "description",
    order: "COALESCE(date, created_at) DESC, id DESC",
    filters: ["event_id", "kind", "status", "category", "confidence"],
    search: ["description", "category", "party", "notes"],
    fields: {
      event_id: "ref:events",
      kind: "enum:income|expense",
      category: "text",
      description: "text!",
      amount_pence: "money",
      qty: "int",
      status: "enum:actual|planned",
      confidence: CONF,
      date: "date",
      party: "text",
      doc_id: "ref:docs",
      notes: "long",
    },
  },
  budget: {
    table: "hq_budget",
    label: "budget line",
    title: "category",
    order: "sort, id",
    filters: ["event_id"],
    search: ["category", "notes"],
    fields: {
      event_id: "ref:events",
      category: "text!",
      amount_pence: "money",
      confidence: CONF,
      notes: "long",
      sort: "int",
    },
  },
  campaigns: {
    table: "hq_campaigns",
    label: "campaign",
    title: "title",
    order: "CASE status WHEN 'done' THEN 1 ELSE 0 END, COALESCE(start_date, '9999'), id DESC",
    filters: ["event_id", "status", "channel"],
    search: ["title", "goal", "brief", "notes"],
    fields: {
      event_id: "ref:events",
      title: "text!",
      goal: "text",
      channel: "text",
      status: "enum:idea|planning|live|done",
      start_date: "date",
      end_date: "date",
      budget_pence: "money",
      brief: "long",
      notes: "long",
    },
  },
  content: {
    table: "hq_content",
    label: "content piece",
    title: "title",
    order: "COALESCE(publish_date, '9999'), id",
    filters: ["campaign_id", "event_id", "status", "channel"],
    search: ["title", "caption", "notes"],
    fields: {
      campaign_id: "ref:campaigns",
      event_id: "ref:events",
      title: "text!",
      channel: "enum:instagram|tiktok|email|website|radio|print|other",
      format: "enum:post|reel|story|carousel|email|poster|mix|other",
      status: "enum:idea|drafting|ready|scheduled|published",
      publish_date: "date",
      caption: "long",
      link: "text",
      notes: "long",
    },
  },
  radio: {
    table: "hq_radio",
    label: "Radio episode",
    title: "title",
    order: "COALESCE(number, '999') DESC, id DESC",
    filters: ["status", "event_id"],
    search: ["title", "guest", "tracklist", "notes"],
    fields: {
      number: "text",
      title: "text!",
      guest: "text",
      status: "enum:idea|booked|recorded|editing|scheduled|published",
      record_date: "date",
      release_date: "date",
      platform: "text",
      link: "text",
      tracklist: "long",
      notes: "long",
      event_id: "ref:events",
    },
  },
  docs: {
    table: "hq_docs",
    label: "document",
    title: "title",
    order: "created_at DESC, id DESC",
    filters: ["event_id", "venue_id", "ledger_id", "kind"],
    search: ["title", "notes"],
    readonly: ["r2_key", "mime", "size"],
    fields: {
      title: "text!",
      kind: "enum:contract|invoice|receipt|quote|photo|rider|artwork|email|other",
      event_id: "ref:events",
      venue_id: "ref:venues",
      ledger_id: "ref:ledger",
      link: "text",
      notes: "long",
      r2_key: "text",
      mime: "text",
      size: "int",
    },
  },
  templates: {
    table: "hq_templates",
    label: "template",
    title: "name",
    order: "id",
    filters: ["kind"],
    search: ["name", "notes"],
    fields: {
      name: "text!",
      kind: "enum:checklist",
      items: "json",
      notes: "long",
    },
  },
  research: {
    table: "hq_research",
    label: "research",
    title: "question",
    order: "id DESC",
    filters: ["status", "event_id", "venue_id"],
    search: ["question", "report"],
    readonly: ["status", "report", "sources", "queries", "searches", "note_id", "error", "finished_at", "depth"],
    fields: {
      question: "long!",
      depth: "text",
      status: "text",
      report: "long",
      sources: "json",
      queries: "json",
      searches: "int",
      note_id: "int",
      event_id: "ref:events",
      venue_id: "ref:venues",
      error: "text",
      finished_at: "text",
    },
  },
  enquiries: {
    table: "hq_enquiries",
    label: "enquiry",
    title: "subject",
    order: "CASE status WHEN 'draft' THEN 0 WHEN 'failed' THEN 1 WHEN 'sent' THEN 2 WHEN 'replied' THEN 3 ELSE 4 END, COALESCE(sent_at, created_at) DESC, id",
    filters: ["venue_id", "event_id", "status", "kind"],
    search: ["subject", "body", "to_email", "reply_body"],
    readonly: ["status", "provider_id", "error", "sent_at", "replied_at", "parent_id"],
    fields: {
      venue_id: "ref:venues",
      event_id: "ref:events",
      parent_id: "int",
      kind: "enum:enquiry|followup",
      status: "enum:draft|sent|failed|replied|closed",
      include: "bool",
      to_email: "text",
      subject: "text",
      body: "long",
      provider_id: "text",
      error: "text",
      sent_at: "text",
      follow_up_on: "date",
      replied_at: "text",
      reply_body: "long",
    },
  },
  quotes: {
    table: "hq_quotes",
    label: "quote",
    title: "room",
    order: "COALESCE(received_on, created_at) DESC, id DESC",
    filters: ["venue_id", "enquiry_id"],
    search: ["room", "notes", "available_dates"],
    fields: {
      venue_id: "ref:venues",
      enquiry_id: "int",
      received_on: "date",
      room: "text",
      available_dates: "text",
      capacity: "int",
      hire_fee_pence: "money",
      hire_note: "text",
      bar_min_pence: "money",
      bar_min_note: "text",
      deposit_pence: "money",
      security_pence: "money",
      security_note: "text",
      dj_equipment: "text",
      licence: "text",
      ticketing: "text",
      other_costs: "text",
      notes: "long",
      evidence: "json",
    },
  },
  chats: {
    table: "hq_chats",
    label: "conversation",
    title: "title",
    order: "updated_at DESC",
    filters: [],
    search: ["title"],
    fields: {
      title: "text!",
      messages: "json",
    },
  },
}

// Shown in lists without loading long bodies.
export const LIST_OMIT = { research: ["report"], chats: ["messages"] }

const MAX_TEXT = 400
const MAX_LONG = 60000

export class InputError extends Error {}

function cleanValue(name, spec, raw) {
  const type = spec.replace(/!$/, "")
  if (raw === null || raw === undefined || raw === "") {
    if (type === "bool") return raw === "" || raw == null ? null : 0
    return null
  }
  if (type === "text" || type === "long") {
    const s = String(raw).replace(/\u0000/g, "").trim()
    const max = type === "text" ? MAX_TEXT : MAX_LONG
    if (s.length > max) throw new InputError(`${name} is too long (max ${max} characters).`)
    return s || null
  }
  if (type === "int" || type.startsWith("ref:")) {
    const n = Number(raw)
    if (!Number.isFinite(n) || !Number.isInteger(n) || Math.abs(n) > 1e12) throw new InputError(`${name} must be a whole number.`)
    return n
  }
  if (type === "money") {
    const n = Number(raw)
    if (!Number.isFinite(n) || !Number.isInteger(n) || Math.abs(n) > 1e11) throw new InputError(`${name} must be whole pence.`)
    return n
  }
  if (type === "bool") return raw === true || raw === 1 || raw === "1" || raw === "true" ? 1 : 0
  if (type === "date") {
    const s = String(raw).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s + "T00:00:00Z"))) throw new InputError(`${name} must be a date.`)
    return s
  }
  if (type === "time") {
    const s = String(raw).trim()
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new InputError(`${name} must be a time like 21:30.`)
    return s
  }
  if (type === "json") {
    const s = typeof raw === "string" ? raw : JSON.stringify(raw)
    if (s.length > MAX_LONG * 4) throw new InputError(`${name} is too large.`)
    try {
      JSON.parse(s)
    } catch {
      throw new InputError(`${name} must be valid JSON.`)
    }
    return s
  }
  if (type.startsWith("enum:")) {
    const options = type.slice(5).split("|")
    const s = String(raw)
    if (!options.includes(s)) throw new InputError(`${name} must be one of: ${options.join(", ")}.`)
    return s
  }
  throw new InputError(`Unknown field type for ${name}.`)
}

// Returns { columns, values } for the allowed, cleaned fields in body.
export function cleanRecord(typeName, body, { creating, internal = false } = {}) {
  const def = TYPES[typeName]
  if (!def) throw new InputError("Unknown record type.")
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new InputError("Send a JSON object.")
  const columns = []
  const values = []
  for (const [name, spec] of Object.entries(def.fields)) {
    if (!(name in body)) continue
    if (!internal && def.readonly && def.readonly.includes(name)) continue
    columns.push(name)
    values.push(cleanValue(name, spec, body[name]))
  }
  if (creating) {
    for (const [name, spec] of Object.entries(def.fields)) {
      if (!spec.endsWith("!")) continue
      const i = columns.indexOf(name)
      if (i < 0 || values[i] === null) throw new InputError(`${name.replace(/_/g, " ")} is required.`)
    }
  } else {
    for (let i = 0; i < columns.length; i++) {
      if (def.fields[columns[i]].endsWith("!") && values[i] === null) throw new InputError(`${columns[i].replace(/_/g, " ")} can't be empty.`)
    }
  }
  return { columns, values }
}

export function refTargets(typeName) {
  const out = {}
  for (const [name, spec] of Object.entries(TYPES[typeName].fields)) {
    if (spec.startsWith("ref:")) out[name] = spec.slice(4)
  }
  return out
}
