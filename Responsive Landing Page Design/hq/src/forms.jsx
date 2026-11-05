// One form system for every record type in HQ. Field lists live here; the server validates again.
import { useEffect, useState } from "react"
import { Sheet, Field, Input, TextArea, Select, MoneyInput, Toggle, Segmented, Btn, Conf, Loading, ErrorBox } from "./ui.jsx"
import {
  save, remove, get, useApp, useApi, toast, parseJson,
  EVENT_STATUS, VENUE_STATUS, TASK_STATUS, PRIORITY, CONF, IDEA_KIND, IDEA_STATUS, NOTE_KIND, CAMPAIGN_STATUS, CONTENT_STATUS,
  CHANNELS, FORMATS, RADIO_STATUS, LOG_KIND, DOC_KIND, MS_STATUS, VENUE_SCORE,
} from "./lib.js"

const LEDGER_CATS = ["Tickets", "Door", "Sponsorship", "Merch", "Radio", "Venue", "Security", "Sound & DJ", "Photo / video", "Marketing & production", "Print", "Insurance", "Transport", "Staff", "Software", "Other"]

// [key, label, kind, extra]
export const FORMS = {
  tasks: [
    ["Task", [["title", "What needs doing", "text", { required: true, wide: true }], ["event_id", "Event", "event"], ["priority", "Priority", "seg", PRIORITY], ["due", "Deadline", "date"], ["owner", "Owner", "person"], ["status", "Status", "seg", TASK_STATUS], ["section", "Section", "combo", ["Venue", "Safety", "Sound", "Tickets", "Door", "Brand", "Marketing", "Content", "Team", "Event day", "After the night"]], ["phase", "Timeline phase", "phase"], ["notes", "Notes", "long", { wide: true }]]],
  ],
  events: [
    ["The night", [["name", "Name", "text", { required: true }], ["number", "Number", "text", { placeholder: "002" }], ["status", "Status", "select", EVENT_STATUS], ["tagline", "Tagline", "text", { wide: true }], ["date", "Date", "date"], ["start_time", "Doors", "time"], ["end_time", "Finish", "time"], ["venue_id", "Venue", "venue"], ["venue_name", "Venue (as shown)", "text", { placeholder: "e.g. BRICKS, Brixton" }], ["cover", "Cover image path", "text", { placeholder: "/assets/001/06-sm.jpg" }]]],
    ["Tickets & capacity", [["capacity", "Capacity", "int"], ["ticket_target", "Ticket target", "int"], ["tickets_sold", "Tickets sold", "int"], ["attendance", "Attendance (scanned)", "int"], ["ticket_price", "Prices", "text", { wide: true }], ["ticket_url", "Ticket link", "text", { wide: true, type: "url" }]]],
    ["Bar", [["bar_minimum_pence", "Bar minimum", "money"], ["bar_takings_pence", "Venue bar takings", "money", { hint: "Venue revenue, not ROUGE's, unless a share is agreed." }]]],
    ["Notes", [["summary", "Summary", "long", { wide: true }], ["notes", "Private notes", "long", { wide: true }]]],
  ],
  venues: [
    ["Basics", [["name", "Venue", "text", { required: true }], ["area", "Area", "text"], ["address", "Address", "text", { wide: true, fact: true }], ["website", "Website", "text", { type: "url" }], ["instagram", "Instagram", "text"], ["contact_name", "Contact", "text", { fact: true }], ["contact_email", "Contact email", "text", { type: "email", fact: true }], ["contact_phone", "Phone", "text", { fact: true }]]],
    ["Space", [["capacity", "Capacity", "int", { fact: true }], ["indoor_outdoor", "Indoor / outdoor", "seg", { indoor: "Indoor", outdoor: "Outdoor", both: "Both" }, { fact: true }], ["rooftop", "Rooftop or terrace", "yesno", null, { fact: true }], ["spaces", "Spaces", "long", { wide: true, fact: true }]]],
    ["Sound & booth", [["sound_system", "Sound system", "text", { fact: true }], ["cdjs", "CDJs", "text", { fact: true }], ["mixer", "Mixer", "text", { fact: true }], ["turntables", "Turntables", "text", { fact: true }], ["serato", "Laptop / Serato", "text", { fact: true }]]],
    ["Commercial", [["hire_fee_pence", "Hire fee", "money", { fact: true }], ["hire_fee_note", "Hire terms", "text"], ["bar_min_pence", "Minimum bar spend", "money", { fact: true }], ["bar_min_note", "Bar terms", "text"], ["deposit_pence", "Deposit", "money", { fact: true }], ["deposit_note", "Deposit terms", "text"], ["security", "Security", "text", { wide: true, fact: true }]]],
    ["Licence", [["licence", "Licence & finish time", "text", { wide: true, fact: true }], ["restrictions", "Restrictions", "long", { wide: true, fact: true }]]],
    ["Pipeline", [["status", "Status", "select", VENUE_STATUS], ["shortlist_event_id", "Shortlisted for", "event"], ["relationship", "Existing relationship", "bool"], ["priority", "Priority (0–3)", "int"], ["last_contact", "Last contact", "date"], ["next_follow_up", "Next follow-up", "date"], ["negotiation_notes", "Negotiation notes", "long", { wide: true }]]],
    ["Suitability", VENUE_SCORE.map(([k, label, w]) => [k, `${label} · ${w}%`, "score"])],
    ["Sources & notes", [["sources", "Sources (one per line)", "long", { wide: true }], ["notes", "Notes", "long", { wide: true }]]],
  ],
  venue_log: [["Log", [["kind", "Type", "seg", LOG_KIND], ["date", "Date", "date"], ["title", "Summary", "text", { required: true, wide: true }], ["body", "Details (paste the email or notes)", "long", { wide: true }]]]],
  ideas: [["Idea", [["title", "Idea", "text", { required: true, wide: true }], ["body", "Describe it", "long", { wide: true }], ["kind", "Kind", "select", IDEA_KIND], ["status", "Status", "seg", { spark: "Spark", developing: "Developing", parked: "Parked" }], ["event_id", "For event", "event"], ["pinned", "Pin it", "bool"]]]],
  notes: [["Note", [["title", "Title", "text", { required: true, wide: true }], ["kind", "Kind", "select", NOTE_KIND], ["tags", "Tags", "text"], ["event_id", "Event", "event"], ["venue_id", "Venue", "venue"], ["pinned", "Pinned", "bool"], ["ai_context", "ROUGE AI reads this", "bool"], ["body", "Body (Markdown)", "md", { wide: true }]]]],
  ledger: [
    ["Money", [["kind", "Type", "seg", { expense: "Cost", income: "Income" }], ["amount_pence", "Amount", "money", { required: true }], ["description", "What for", "text", { required: true, wide: true }], ["category", "Category", "combo", LEDGER_CATS], ["event_id", "Event", "event", { placeholder: "Brand / no event" }], ["status", "Status", "seg", { actual: "Paid / received", planned: "Planned" }], ["confidence", "Confidence", "seg", CONF], ["date", "Date", "date"], ["party", "Paid to / from", "text"], ["qty", "Quantity (e.g. tickets)", "int"], ["notes", "Notes", "long", { wide: true }]]],
  ],
  budget: [["Budget line", [["category", "Line", "text", { required: true, wide: true }], ["amount_pence", "Amount", "money", { required: true }], ["confidence", "Basis", "seg", CONF], ["notes", "Notes", "long", { wide: true }]]]],
  campaigns: [["Campaign", [["title", "Campaign", "text", { required: true, wide: true }], ["event_id", "Event", "event"], ["goal", "Goal", "text", { wide: true }], ["channel", "Main channel", "combo", Object.values(CHANNELS)], ["status", "Status", "seg", CAMPAIGN_STATUS], ["start_date", "Starts", "date"], ["end_date", "Ends", "date"], ["budget_pence", "Budget", "money"], ["brief", "Brief", "long", { wide: true }], ["notes", "Notes", "long", { wide: true }]]]],
  content: [["Content", [["title", "Piece", "text", { required: true, wide: true }], ["channel", "Channel", "select", CHANNELS], ["format", "Format", "select", FORMATS], ["status", "Status", "seg", CONTENT_STATUS], ["publish_date", "Publish on", "date"], ["event_id", "Event", "event"], ["campaign_id", "Campaign", "campaign"], ["caption", "Caption / copy", "long", { wide: true }], ["link", "Link", "text", { wide: true, type: "url" }], ["notes", "Notes", "long", { wide: true }]]]],
  radio: [["Episode", [["number", "Number", "text", { placeholder: "001" }], ["title", "Title", "text", { required: true }], ["guest", "Guest selector", "text"], ["status", "Status", "select", RADIO_STATUS], ["record_date", "Record on", "date"], ["release_date", "Release on", "date"], ["platform", "Platform", "combo", ["Mixcloud", "SoundCloud", "YouTube", "NTS", "Website"]], ["link", "Link", "text", { type: "url" }], ["event_id", "Linked event", "event"], ["tracklist", "Tracklist (one per line)", "long", { wide: true }], ["notes", "Notes", "long", { wide: true }]]]],
  people: [["Person", [["name", "Name", "text", { required: true }], ["role", "Role", "text"], ["email", "Email", "text", { type: "email" }], ["phone", "Phone", "text", { type: "tel" }], ["instagram", "Instagram", "text"], ["areas", "Areas they help with", "text", { wide: true }], ["notes", "Notes", "long", { wide: true }]]]],
  assignments: [["Role", [["role", "Role", "role", { required: true }], ["person_id", "Person", "personId"], ["person_name", "…or name", "text"], ["shift_start", "From", "time"], ["shift_end", "Until", "time"], ["confirmed", "Confirmed", "bool"], ["notes", "Notes", "long", { wide: true }]]]],
  run: [["Running order", [["time", "Time", "time"], ["activity", "Activity", "text", { required: true }], ["person", "Responsible", "person"], ["location", "Where", "text"], ["notes", "Notes", "long", { wide: true }]]]],
  milestones: [["Milestone", [["title", "Milestone", "text", { required: true, wide: true }], ["start_date", "Starts", "date"], ["due_date", "Due", "date"], ["status", "Status", "seg", MS_STATUS], ["notes", "Notes", "long", { wide: true }]]]],
  docs: [["Document link", [["title", "Title", "text", { required: true, wide: true }], ["kind", "Kind", "select", DOC_KIND], ["link", "Link (Drive, Dropbox, email…)", "text", { wide: true, type: "url" }], ["event_id", "Event", "event"], ["venue_id", "Venue", "venue"], ["notes", "Notes", "long", { wide: true }]]]],
}

const LABEL = { tasks: "task", events: "event", venues: "venue", venue_log: "log entry", ideas: "idea", notes: "note", ledger: "money entry", budget: "budget line", campaigns: "campaign", content: "content piece", radio: "episode", people: "person", assignments: "role", run: "running-order item", milestones: "milestone", docs: "document" }

function useLookups(fields) {
  const app = useApp()
  const kinds = new Set(fields.map((f) => f[2]))
  const venues = useApi(kinds.has("venue") ? "t/venues?limit=300" : null)
  const campaigns = useApi(kinds.has("campaign") ? "t/campaigns?limit=300" : null)
  return {
    events: app.boot.events.map((e) => [String(e.id), e.name]),
    people: app.boot.people,
    venues: ((venues.data && venues.data.items) || []).map((v) => [String(v.id), v.name]),
    campaigns: ((campaigns.data && campaigns.data.items) || []).map((c) => [String(c.id), c.title]),
    phases: app.boot.phases.map((p) => [p.key, p.title]),
    roles: app.boot.roles,
  }
}

function FieldInput({ f, value, set, lookups }) {
  const [, , kind, a] = f
  const opts = OPTION_KINDS.has(kind) ? a : null
  const extra = extrasOf(f)
  const num = (v) => (v === "" || v === null ? null : Number(v))
  switch (kind) {
    case "text":
      return (id) => <Input id={id} value={value} onChange={set} type={extra.type || "text"} placeholder={extra.placeholder} autoComplete="off" />
    case "long":
      return (id) => <TextArea id={id} value={value} onChange={set} rows={3} />
    case "md":
      return (id) => <TextArea id={id} value={value} onChange={set} rows={10} className="input textarea textarea--mono" />
    case "int":
      return (id) => <Input id={id} value={value ?? ""} onChange={(v) => set(num(v))} type="number" inputMode="numeric" />
    case "money":
      return (id) => <MoneyInput id={id} value={value} onChange={set} />
    case "date":
      return (id) => <Input id={id} value={value} onChange={(v) => set(v || null)} type="date" />
    case "time":
      return (id) => <Input id={id} value={value} onChange={(v) => set(v || null)} type="time" />
    case "select":
      return (id) => <Select id={id} value={value} onChange={set} options={opts} />
    case "seg":
      return () => <Segmented options={opts} value={value} onChange={set} small={Object.keys(opts).length > 3} />
    case "bool":
      return () => <Toggle checked={value} onChange={set} label={value ? "Yes" : "No"} />
    case "yesno":
      return () => <Segmented options={{ 1: "Yes", 0: "No", "": "Unknown" }} value={value === null || value === undefined ? "" : String(value)} onChange={(v) => set(v === "" ? null : Number(v))} small />
    case "event":
      return (id) => <Select id={id} value={value == null ? "" : String(value)} onChange={(v) => set(v ? Number(v) : null)} options={lookups.events} placeholder={extra.placeholder || "None"} />
    case "venue":
      return (id) => <Select id={id} value={value == null ? "" : String(value)} onChange={(v) => set(v ? Number(v) : null)} options={lookups.venues} placeholder="None" />
    case "campaign":
      return (id) => <Select id={id} value={value == null ? "" : String(value)} onChange={(v) => set(v ? Number(v) : null)} options={lookups.campaigns} placeholder="None" />
    case "personId":
      return (id) => <Select id={id} value={value == null ? "" : String(value)} onChange={(v) => set(v ? Number(v) : null)} options={lookups.people.map((p) => [String(p.id), p.name])} placeholder="Not in the directory" />
    case "phase":
      return (id) => <Select id={id} value={value} onChange={set} options={lookups.phases} placeholder="None" />
    case "combo":
    case "person":
    case "role": {
      const list = kind === "person" ? lookups.people.map((p) => p.name) : kind === "role" ? lookups.roles : a
      return (id) => (
        <>
          <Input id={id} value={value} onChange={set} list={`${id}-list`} autoComplete="off" />
          <datalist id={`${id}-list`}>
            {list.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </>
      )
    }
    case "score":
      return () => (
        <div className="score-pick" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={value === n} className={value >= n ? "is-on" : ""} onClick={() => set(value === n ? null : n)}>
              {n}
            </button>
          ))}
        </div>
      )
    default:
      return () => null
  }
}

// Field tuples: [key, label, kind, options-or-extras, extras]. Option kinds take options in slot 4.
const OPTION_KINDS = new Set(["select", "seg", "combo"])
function extrasOf(f) {
  const [, , kind, a, b] = f
  if (OPTION_KINDS.has(kind) || a === null) return b || {}
  return a || {}
}

// The editor used everywhere: pass type + item (or id) + defaults.
export function RecordSheet({ type, id, item: given, defaults, onClose, onSaved, title, onDeleted }) {
  const groups = FORMS[type]
  const [item, setItem] = useState(given || null)
  const [loadErr, setLoadErr] = useState(null)
  const [values, setValues] = useState(() => ({ ...(defaults || {}), ...(given || {}) }))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const editing = !!(item && item.id) || !!id
  const allFields = groups.flatMap((g) => g[1])
  const lookups = useLookups(allFields)

  useEffect(() => {
    if (id && !given) {
      get(`t/${type}/${id}`)
        .then((r) => {
          setItem(r.item)
          setValues(r.item)
        })
        .catch(setLoadErr)
    }
  }, [id, type])

  const facts = type === "venues" ? parseJson(values.facts, {}) || {} : null
  const setFact = (key, c) => setValues((v) => ({ ...v, facts: JSON.stringify({ ...(parseJson(v.facts, {}) || {}), [key]: { ...((parseJson(v.facts, {}) || {})[key] || {}), c } }) }))

  async function submit(e) {
    e && e.preventDefault()
    setErr(null)
    for (const f of allFields) {
      const ex = extrasOf(f)
      if (ex.required && (values[f[0]] === null || values[f[0]] === undefined || values[f[0]] === "")) {
        setErr(`${f[1]} is required.`)
        return
      }
    }
    const body = {}
    for (const f of allFields) if (f[0] in values) body[f[0]] = values[f[0]]
    if (type === "venues" && values.facts !== undefined) body.facts = values.facts
    for (const k of Object.keys(defaults || {})) if (!(k in body)) body[k] = values[k]
    setBusy(true)
    try {
      const saved = await save(type, body, item && item.id)
      toast(editing ? "Saved" : `Added ${LABEL[type] || "item"}`)
      onSaved && onSaved(saved)
      onClose && onClose()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete this ${LABEL[type] || "item"}? This can't be undone.`)) return
    setBusy(true)
    try {
      await remove(type, item.id)
      toast("Deleted")
      onDeleted && onDeleted()
      onClose && onClose()
    } catch (e2) {
      setErr(e2.message)
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={editing ? "Edit" : "New"}
      title={title || (editing ? (item && (item.name || item.title || item.activity || item.role || item.category || item.description)) || "Edit" : `New ${LABEL[type] || "item"}`)}
      wide={type === "venues" || type === "events" || type === "notes"}
      footer={
        <>
          {editing ? <Btn kind="quiet" icon="trash" className="danger-text" onClick={onDelete} busy={busy}>Delete</Btn> : <span />}
          <div className="row-gap">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn kind="primary" onClick={submit} busy={busy}>{editing ? "Save" : "Add"}</Btn>
          </div>
        </>
      }
    >
      {loadErr ? <ErrorBox error={loadErr} /> : id && !item ? <Loading /> : (
        <form onSubmit={submit} className="form">
          {err ? <ErrorBox error={{ message: err }} /> : null}
          {groups.map(([groupTitle, fields]) => (
            <fieldset key={groupTitle} className="form__group">
              {groups.length > 1 ? <legend>{groupTitle}</legend> : null}
              <div className="form__grid">
                {fields.map((f) => {
                  const ex = extrasOf(f)
                  const set = (v) => setValues((s) => ({ ...s, [f[0]]: v }))
                  const render = FieldInput({ f, value: values[f[0]], set, lookups })
                  const fact = facts && ex.fact
                  return (
                    <Field key={f[0]} label={f[1] + (ex.required ? " *" : "")} hint={ex.hint || (fact && facts[f[0]] && facts[f[0]].s) || null} wide={ex.wide || f[2] === "md" || f[2] === "seg"} conf={fact ? <Conf value={(facts[f[0]] && facts[f[0]].c) || "confirm"} onChange={(c) => setFact(f[0], c)} /> : null}>
                      {render}
                    </Field>
                  )
                })}
              </div>
            </fieldset>
          ))}
          <button type="submit" hidden />
        </form>
      )}
    </Sheet>
  )
}
