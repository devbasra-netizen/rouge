// VENUES — research, relationships and side-by-side comparison.
import { useMemo, useState } from "react"
import { useApi, useApp, save, navigate, money, fmtDay, relDay, parseJson, toast, plural, VENUE_STATUS, LOG_KIND, CONF, VENUE_SCORE, venueScore, API, hostOf } from "../lib.js"
import { Card, Icon, Btn, A, Chip, Status, Empty, Loading, ErrorBox, PageHead, Conf, Notice, Input, Select } from "../ui.jsx"
import { DocLink } from "./events.jsx"

const FACT_ROWS = [
  ["Space", [["capacity", "Capacity"], ["indoor_outdoor", "Indoor / outdoor"], ["rooftop", "Rooftop / terrace"], ["spaces", "Spaces"]]],
  ["Sound & booth", [["sound_system", "Sound system"], ["cdjs", "CDJs"], ["mixer", "Mixer"], ["turntables", "Turntables"], ["serato", "Laptop / Serato"]]],
  ["Commercial", [["hire_fee_pence", "Hire fee", "hire_fee_note"], ["bar_min_pence", "Minimum bar spend", "bar_min_note"], ["deposit_pence", "Deposit", "deposit_note"], ["security", "Security"]]],
  ["Licence", [["licence", "Licence & finish"], ["restrictions", "Restrictions"]]],
  ["Contact", [["address", "Address"], ["contact_name", "Contact"], ["contact_email", "Email"], ["contact_phone", "Phone"]]],
]

export function factValue(v, key) {
  const val = v[key]
  if (val === null || val === undefined || val === "") return null
  if (key.endsWith("_pence")) return money(val)
  if (key === "rooftop") return val ? "Yes" : "No"
  if (key === "indoor_outdoor") return { indoor: "Indoor", outdoor: "Outdoor", both: "Indoor + outdoor" }[val] || val
  return String(val)
}

function confCounts(v) {
  const facts = parseJson(v.facts, {}) || {}
  const out = { verified: 0, estimate: 0, confirm: 0 }
  for (const [, rows] of FACT_ROWS)
    for (const [k] of rows) {
      if (factValue(v, k) === null) continue
      out[(facts[k] && facts[k].c) || "confirm"]++
    }
  return out
}

const VIEWS = [
  ["all", "All"],
  ["shortlist", "Shortlist"],
  ["rooftop", "Rooftop"],
  ["under150", "Under 150"],
  ["lowcost", "Low cost"],
  ["awaiting", "Awaiting reply"],
  ["rejected", "Rejected"],
  ["relationships", "Relationships"],
]
const FILTER = {
  all: (v) => v.status !== "rejected",
  shortlist: (v) => v.shortlist_event_id && v.status !== "rejected",
  rooftop: (v) => v.rooftop === 1,
  under150: (v) => v.capacity && v.capacity <= 150,
  lowcost: (v) => v.hire_fee_pence !== null && v.hire_fee_pence <= 35000,
  awaiting: (v) => v.status === "enquired" || v.status === "awaiting",
  rejected: (v) => v.status === "rejected",
  relationships: (v) => v.relationship === 1,
}
const VIEW_HINT = {
  lowcost: "Published hire of £350 or less — the business plan's base envelope.",
  under150: "Recorded capacity of 150 or fewer.",
  rooftop: "Marked as having a rooftop or terrace.",
}

export function Venues({ view }) {
  const app = useApp()
  const { data, error } = useApi("t/venues?limit=500")
  const [q, setQ] = useState("")
  const [pick, setPick] = useState([])
  const items = (data && data.items) || []
  const shortlistName = useMemo(() => {
    const ids = items.map((v) => v.shortlist_event_id).filter(Boolean)
    const e = app.boot.events.find((x) => x.id === ids[0])
    return e ? `${e.name} shortlist` : "Shortlist"
  }, [items, app.boot.events])
  const shown = items.filter(FILTER[view] || FILTER.all).filter((v) => !q || [v.name, v.area, v.address, v.sound_system, v.notes].join(" ").toLowerCase().includes(q.toLowerCase()))
  const setView = (k) => navigate(`venues${k === "all" ? "" : `?view=${k}`}`, { replace: true })
  const togglePick = (id) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]))
  return (
    <div className="page">
      <PageHead
        eyebrow="Venue intelligence"
        title="Venues"
        sub="Every fact is marked verified, estimate or to confirm, with its source. Nothing here is a quote until a venue puts it in writing."
        actions={<Btn kind="primary" icon="plus" onClick={() => app.actions("venue")}>Add venue</Btn>}
      />
      <div className="chips-scroll" role="tablist">
        {VIEWS.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} className={`chip chip--btn${view === k ? " chip--on" : " chip--soft"}`} onClick={() => setView(k)}>
            {k === "shortlist" ? shortlistName : l}
            <span className="chip__n">{items.filter(FILTER[k]).length}</span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div className="searchbox">
          <Icon name="search" size={16} />
          <input className="input input--bare" placeholder="Search venues" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search venues" />
        </div>
        <p className="faint small">{VIEW_HINT[view] || "Tick up to four to compare."}</p>
      </div>
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : shown.length ? (
        <div className="venue-grid">
          {shown.map((v) => <VenueCard key={v.id} v={v} picked={pick.includes(v.id)} onPick={() => togglePick(v.id)} today={app.today} />)}
        </div>
      ) : (
        <Empty icon="venue" title="No venues in this view">{view === "all" ? "Add the rooms you're considering." : "Try another view."}</Empty>
      )}
      {pick.length ? (
        <div className="comparebar">
          <span>{plural(pick.length, "venue")} selected</span>
          <Btn size="sm" kind="quiet" onClick={() => setPick([])}>Clear</Btn>
          <Btn size="sm" kind="primary" icon="columns" disabled={pick.length < 2} onClick={() => navigate(`venues/compare?ids=${pick.join(",")}`)}>Compare</Btn>
        </div>
      ) : null}
    </div>
  )
}

function VenueCard({ v, picked, onPick, today }) {
  const c = confCounts(v)
  const score = venueScore(v)
  const bits = [v.capacity ? `${v.capacity} cap` : null, v.sound_system, v.hire_fee_pence != null ? `hire ${money(v.hire_fee_pence)}` : null].filter(Boolean)
  return (
    <div className={`venue-card${picked ? " is-picked" : ""}`}>
      <button type="button" className={`venue-card__pick${picked ? " is-on" : ""}`} onClick={onPick} aria-pressed={picked} aria-label={`Compare ${v.name}`}>
        <Icon name="check" size={14} />
      </button>
      <A to={`venues/${v.id}`} className="venue-card__body">
        <span className="venue-card__top">
          <strong className="venue-card__name">{v.name}</strong>
          {score !== null ? <span className="score">{score}</span> : null}
        </span>
        <span className="muted small">{[v.area, v.relationship ? "Worked with" : null].filter(Boolean).join(" · ") || "Area not set"}</span>
        <span className="venue-card__facts">{bits.length ? bits.join(" · ") : <span className="faint">No details yet</span>}</span>
        <span className="venue-card__foot">
          <Status value={v.status} labels={VENUE_STATUS} />
          {v.rooftop === 1 ? <Chip tone="soft">Terrace</Chip> : null}
          {v.shortlist_event_id ? <Chip tone="red" icon="star">Shortlist</Chip> : null}
          <span className="conf-sum" title="Verified · estimate · to confirm">
            {c.verified ? <span className="conf conf--verified"><Icon name="check" size={11} />{c.verified}</span> : null}
            {c.estimate ? <span className="conf conf--estimate"><Icon name="timeline" size={11} />{c.estimate}</span> : null}
            {c.confirm ? <span className="conf conf--confirm"><Icon name="warn" size={11} />{c.confirm}</span> : null}
          </span>
        </span>
        {v.next_follow_up ? <span className={`small ${v.next_follow_up < today ? "danger-text" : "muted"}`}><Icon name="clock" size={12} /> Follow up {relDay(v.next_follow_up, today).toLowerCase()}</span> : null}
      </A>
    </div>
  )
}

export function VenueDetail({ id }) {
  const app = useApp()
  const { data, error, reload } = useApi(`t/venues/${id}`)
  const log = useApi(`t/venue_log?venue_id=${id}`)
  const docs = useApi(`t/docs?venue_id=${id}`)
  const notes = useApi(`t/notes?venue_id=${id}`)
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>
  if (!data) return <div className="page"><Loading rows={6} /></div>
  const v = data.item
  const facts = parseJson(v.facts, {}) || {}
  const score = venueScore(v)
  const nextEvent = app.boot.events.find((e) => ["planning", "confirmed", "idea"].includes(e.status))
  const set = async (values, msg) => {
    try {
      await save("venues", values, v.id)
      if (msg) toast(msg)
    } catch (e) {
      toast(e.message, "bad")
    }
  }
  const setConf = (key, c) => set({ facts: JSON.stringify({ ...facts, [key]: { ...(facts[key] || {}), c } }) })
  const photos = ((docs.data && docs.data.items) || []).filter((x) => x.r2_key && (x.mime || "").startsWith("image/"))
  const files = ((docs.data && docs.data.items) || []).filter((x) => !photos.includes(x))
  const research = `Verify and research ${v.name}${v.area ? ` in ${v.area}` : ""}, London, as a venue for an intimate 110–150 person ROUGE night: legal capacity, rooms, sound system and DJ booth kit (exact models), promoter hire terms, minimum bar spend, deposit, security arrangements, licence and finish times, restrictions, and recent reviews from promoters or guests. Flag anything that conflicts with what HQ already holds.`
  return (
    <div className="page">
      <A to="venues" className="back"><Icon name="left" size={16} />Venues</A>
      <header className="pagehead">
        <div className="pagehead__text">
          <p className="eyebrow">{[v.area, v.relationship ? "Existing relationship" : null].filter(Boolean).join(" · ") || "Venue"}</p>
          <h1 className="display">{v.name}</h1>
          <div className="row-gap wrap">
            <div className="select select--inline">
              <select aria-label="Status" value={v.status} onChange={(e) => set({ status: e.target.value }, `Status: ${VENUE_STATUS[e.target.value]}`)}>
                {Object.entries(VENUE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <Icon name="down" size={14} />
            </div>
            {v.website ? <a className="chip chip--soft chip--btn" href={v.website} target="_blank" rel="noopener noreferrer"><Icon name="globe" size={12} />{hostOf(v.website)}</a> : null}
            {v.instagram ? <span className="chip chip--soft">{v.instagram}</span> : null}
          </div>
        </div>
        <div className="pagehead__actions">
          <Btn icon="edit" onClick={() => app.openRecord("venues", { item: v })}>Edit</Btn>
          <Btn kind="primary" icon="plus" onClick={() => app.openRecord("venue_log", { defaults: { venue_id: v.id, kind: "email", date: app.today }, onSaved: () => set({ last_contact: app.today }) })}>Log contact</Btn>
        </div>
      </header>

      <div className="venue-layout">
        <div className="stack">
          <Card eyebrow="At a glance">
            <div className="mini-stats">
              <div><strong>{v.capacity || "—"}</strong><span>capacity</span></div>
              <div><strong>{v.hire_fee_pence != null ? money(v.hire_fee_pence) : "—"}</strong><span>hire</span></div>
              <div><strong>{v.bar_min_pence != null ? money(v.bar_min_pence) : "—"}</strong><span>bar minimum</span></div>
              <div><strong>{score !== null ? score : "—"}</strong><span>suitability</span></div>
            </div>
            {v.negotiation_notes ? <p className="callout">{v.negotiation_notes}</p> : null}
          </Card>

          {FACT_ROWS.map(([group, rows]) => (
            <Card key={group} eyebrow={group}>
              <dl className="facts facts--conf">
                {rows.map(([k, label, noteKey]) => {
                  const val = factValue(v, k)
                  const f = facts[k]
                  return (
                    <div key={k}>
                      <dt>{label}</dt>
                      <dd>
                        {val ? <span>{val}</span> : <span className="faint">Unknown</span>}
                        {noteKey && v[noteKey] ? <span className="fact-note">{v[noteKey]}</span> : null}
                        {val && f && f.s ? <span className="fact-src">{f.s}</span> : null}
                      </dd>
                      <span className="facts__conf">{val ? <Conf value={(f && f.c) || "confirm"} onChange={(c) => setConf(k, c)} /> : null}</span>
                    </div>
                  )
                })}
              </dl>
            </Card>
          ))}
        </div>

        <div className="stack">
          <Card eyebrow="Pipeline">
            <div className="form__grid">
              <div className="field">
                <div className="field__label"><label htmlFor="fu">Next follow-up</label></div>
                <Input id="fu" type="date" value={v.next_follow_up} onChange={(d) => set({ next_follow_up: d || null }, d ? `Follow-up set for ${fmtDay(d)}` : "Follow-up cleared")} />
              </div>
              <div className="field">
                <div className="field__label"><label>Last contact</label></div>
                <p className="field__static">{v.last_contact ? fmtDay(v.last_contact) : "Not logged"}</p>
              </div>
              <div className="field field--wide">
                <div className="field__label"><label htmlFor="sl">Shortlisted for</label></div>
                <Select id="sl" value={v.shortlist_event_id ? String(v.shortlist_event_id) : ""} onChange={(x) => set({ shortlist_event_id: x ? Number(x) : null }, x ? "Shortlisted" : "Removed from shortlist")} options={app.boot.events.map((e) => [String(e.id), e.name])} placeholder="Not shortlisted" />
              </div>
            </div>
            <div className="row-gap wrap">
              <Btn size="sm" icon="globe" onClick={() => navigate(`ai/research?venue=${v.id}&q=${encodeURIComponent(research)}`)}>Research this venue</Btn>
              <Btn size="sm" icon="mail" onClick={() => navigate(`ai?venue=${v.id}&draft=enquiry`)}>Draft enquiry</Btn>
              {nextEvent && !v.shortlist_event_id ? <Btn size="sm" icon="star" onClick={() => set({ shortlist_event_id: nextEvent.id }, `Shortlisted for ${nextEvent.name}`)}>Shortlist for {nextEvent.name}</Btn> : null}
            </div>
          </Card>

          <Card eyebrow="Suitability" title={score !== null ? `${score} / 100` : null}>
            <ul className="scores">
              {VENUE_SCORE.map(([k, label, w]) => (
                <li key={k}>
                  <span>{label} <span className="faint small">{w}%</span></span>
                  <span className="score-pick score-pick--sm" role="radiogroup" aria-label={label}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={v[k] === n} className={v[k] >= n ? "is-on" : ""} onClick={() => set({ [k]: v[k] === n ? null : n })}>{n}</button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="fineprint">Weights from the ROUGE 002 blueprint. Your judgement, 1–5 per area.</p>
          </Card>

          <Card eyebrow="Contact log" action={<Btn size="sm" icon="plus" onClick={() => app.openRecord("venue_log", { defaults: { venue_id: v.id, kind: "note", date: app.today } })}>Add</Btn>}>
            {log.data && log.data.items.length ? (
              <ol className="vlog">
                {log.data.items.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => app.openRecord("venue_log", { item: l })}>
                      <span className="vlog__kind">{LOG_KIND[l.kind]}</span>
                      <strong>{l.title}</strong>
                      <span className="faint small">{l.date ? fmtDay(l.date) : ""}</span>
                      {l.body ? <span className="vlog__body">{l.body.slice(0, 220)}{l.body.length > 220 ? "…" : ""}</span> : null}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty compact icon="mail">Paste emails, meeting notes, quotes and calls here so nothing lives only in your inbox.</Empty>
            )}
          </Card>

          <Card eyebrow="Photos & documents" action={<Btn size="sm" icon="upload" onClick={() => app.openUpload({ venue_id: v.id })}>Add</Btn>}>
            {photos.length ? (
              <div className="thumbs">
                {photos.map((p) => (
                  <a key={p.id} href={`${API}files/${p.id}`} target="_blank" rel="noopener noreferrer" className="thumb">
                    <img src={`${API}files/${p.id}`} alt={p.title} loading="lazy" />
                  </a>
                ))}
              </div>
            ) : null}
            {files.length ? <ul className="docs">{files.map((x) => <li key={x.id}><DocLink doc={x} /></li>)}</ul> : null}
            {!photos.length && !files.length ? <Empty compact icon="photo">Visit photos, floor plans, contracts and quotes.</Empty> : null}
          </Card>

          {notes.data && notes.data.items.length ? (
            <Card eyebrow="Notes & research">
              <ul className="notes-mini">{notes.data.items.map((n) => <li key={n.id}><A to={`knowledge/${n.id}`}><strong>{n.title}</strong><span className="faint small">{n.kind}</span></A></li>)}</ul>
            </Card>
          ) : null}

          {v.sources ? (
            <Card eyebrow="Sources">
              <ul className="sources">
                {v.sources.split(/\n+/).filter(Boolean).map((s, i) => (
                  <li key={i}>{/^https?:\/\//.test(s.trim()) ? <a href={s.trim()} target="_blank" rel="noopener noreferrer">{hostOf(s.trim())}<Icon name="external" size={12} /></a> : s}</li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const COMPARE_ROWS = [
  ["area", "Area"], ["status", "Status"], ["capacity", "Capacity"], ["indoor_outdoor", "Indoor / outdoor"], ["rooftop", "Rooftop / terrace"],
  ["sound_system", "Sound system"], ["cdjs", "CDJs"], ["mixer", "Mixer"], ["turntables", "Turntables"], ["serato", "Laptop / Serato"],
  ["hire_fee_pence", "Hire fee"], ["bar_min_pence", "Bar minimum"], ["deposit_pence", "Deposit"], ["security", "Security"],
  ["licence", "Licence & finish"], ["restrictions", "Restrictions"], ["score", "Suitability"], ["next_follow_up", "Next follow-up"],
]

export function VenueCompare({ ids }) {
  const { data, error } = useApi("t/venues?limit=500")
  if (error) return <div className="page"><ErrorBox error={error} /></div>
  if (!data) return <div className="page"><Loading /></div>
  const want = ids.split(",").map(Number).filter(Boolean)
  const vs = want.map((id) => data.items.find((v) => v.id === id)).filter(Boolean)
  const lowest = (k) => {
    const vals = vs.map((v) => v[k]).filter((x) => x !== null && x !== undefined)
    return vals.length > 1 ? Math.min(...vals) : null
  }
  const best = { hire_fee_pence: lowest("hire_fee_pence"), bar_min_pence: lowest("bar_min_pence"), deposit_pence: lowest("deposit_pence") }
  const scores = vs.map(venueScore)
  const topScore = scores.filter((s) => s !== null).length > 1 ? Math.max(...scores.filter((s) => s !== null)) : null
  return (
    <div className="page">
      <A to="venues" className="back"><Icon name="left" size={16} />Venues</A>
      <PageHead eyebrow="Venue intelligence" title="Compare" sub="Highlighted cells are the best recorded value. Check the confidence marks before relying on any of them." />
      {vs.length < 2 ? (
        <Notice tone="info">Pick at least two venues on the Venues page.</Notice>
      ) : (
        <div className="compare-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th />
                {vs.map((v) => (
                  <th key={v.id}><A to={`venues/${v.id}`}>{v.name}</A></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map(([k, label]) => (
                <tr key={k}>
                  <th scope="row">{label}</th>
                  {vs.map((v, i) => {
                    const facts = parseJson(v.facts, {}) || {}
                    let val
                    if (k === "status") val = VENUE_STATUS[v.status]
                    else if (k === "score") val = scores[i] !== null ? `${scores[i]} / 100` : null
                    else if (k === "next_follow_up") val = v.next_follow_up ? fmtDay(v.next_follow_up) : null
                    else val = factValue(v, k)
                    const isBest = (best[k] !== undefined && best[k] !== null && v[k] === best[k]) || (k === "score" && topScore !== null && scores[i] === topScore)
                    const note = { hire_fee_pence: v.hire_fee_note, bar_min_pence: v.bar_min_note, deposit_pence: v.deposit_note }[k]
                    return (
                      <td key={v.id} className={isBest ? "is-best" : ""}>
                        {val ? <span>{val}</span> : <span className="faint">—</span>}
                        {note ? <span className="fact-note">{note}</span> : null}
                        {val && facts[k] ? <Conf value={facts[k].c} compact source={facts[k].s} /> : val && !["area", "status", "score", "next_follow_up"].includes(k) ? <Conf value="confirm" compact /> : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="cal__legend">
        {Object.entries(CONF).map(([k, l]) => <span key={k}><Conf value={k} compact /> {l}</span>)}
      </div>
    </div>
  )
}
