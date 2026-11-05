// Calendar (all dates across HQ, or one event's) and the People directory.
import { useMemo, useState } from "react"
import { useApi, useApp, navigate, fmtDate, fmtDay, addDays, initials } from "../lib.js"
import { Card, Icon, Btn, Chip, Empty, Loading, ErrorBox, PageHead, Avatar, Segmented } from "../ui.jsx"

const KIND_LABEL = { event: "Event", milestone: "Milestone", task: "Task", content: "Content", radio: "Radio", followup: "Follow-up" }

function monthStart(iso) {
  return iso.slice(0, 8) + "01"
}
function monthGrid(first) {
  const d = new Date(first + "T12:00:00Z")
  const lead = (d.getUTCDay() + 6) % 7 // Monday first
  const start = addDays(first, -lead)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function MonthCalendar({ eventId, initial }) {
  const app = useApp()
  const [month, setMonth] = useState(monthStart(initial || app.today))
  const [picked, setPicked] = useState(null)
  const days = useMemo(() => monthGrid(month), [month])
  const from = days[0]
  const to = days[days.length - 1]
  const { data, error } = useApi(`calendar?from=${from}&to=${to}${eventId ? `&event_id=${eventId}` : ""}`)
  const byDay = useMemo(() => {
    const m = {}
    for (const it of (data && data.items) || []) {
      if (it.date) (m[it.date] ||= []).push(it)
      if (it.type === "milestone" && it.start_date && it.start_date !== it.date) (m[it.start_date] ||= []).push({ ...it, startMark: true })
    }
    return m
  }, [data])
  const shift = (n) => {
    const d = new Date(month + "T12:00:00Z")
    d.setUTCMonth(d.getUTCMonth() + n)
    setMonth(d.toISOString().slice(0, 8) + "01")
    setPicked(null)
  }
  const open = (it) => {
    if (it.type === "event") navigate(`events/${it.id}`)
    else if (it.type === "followup") navigate(`venues/${it.id}`)
    else if (it.type === "task") app.openRecord("tasks", { id: it.id })
    else if (it.type === "milestone") app.openRecord("milestones", { id: it.id })
    else if (it.type === "content") app.openRecord("content", { id: it.id })
    else if (it.type === "radio") app.openRecord("radio", { id: it.id })
  }
  const list = picked ? byDay[picked] || [] : null
  return (
    <div className="cal">
      <div className="cal__head">
        <h3 className="cal__month">{fmtDate(month, { month: "long", year: "numeric" })}</h3>
        <div className="row-gap">
          <Btn size="sm" onClick={() => { setMonth(monthStart(app.today)); setPicked(app.today) }}>Today</Btn>
          <Btn size="sm" icon="left" aria-label="Previous month" onClick={() => shift(-1)} />
          <Btn size="sm" icon="right" aria-label="Next month" onClick={() => shift(1)} />
        </div>
      </div>
      {error ? <ErrorBox error={error} /> : null}
      <div className="cal__grid" role="grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="cal__dow" role="columnheader">{d}</div>
        ))}
        {days.map((day) => {
          const items = byDay[day] || []
          const out = day.slice(0, 7) !== month.slice(0, 7)
          return (
            <button key={day} type="button" role="gridcell" className={`cal__day${out ? " is-out" : ""}${day === app.today ? " is-today" : ""}${picked === day ? " is-picked" : ""}`} onClick={() => setPicked(day === picked ? null : day)} aria-label={`${fmtDay(day)}: ${items.length} items`}>
              <span className="cal__num">{Number(day.slice(8))}</span>
              <span className="cal__items">
                {items.slice(0, 3).map((it, i) => (
                  <span key={i} className={`cal__item cal__item--${it.type}${it.status === "done" || it.status === "published" ? " is-done" : ""}`}>{it.startMark ? "▸ " : ""}{it.title}</span>
                ))}
                {items.length > 3 ? <span className="cal__more">+{items.length - 3}</span> : null}
              </span>
              <span className="cal__dots" aria-hidden="true">
                {items.slice(0, 4).map((it, i) => <i key={i} className={`dot dot--${it.type}`} />)}
              </span>
            </button>
          )
        })}
      </div>
      <div className="cal__legend">
        {Object.entries(KIND_LABEL).map(([k, l]) => (
          <span key={k}><i className={`dot dot--${k}`} />{l}</span>
        ))}
      </div>
      {list ? (
        <div className="cal__list">
          <p className="subhead">{fmtDay(picked)}</p>
          {list.length ? (
            <ul className="dates">
              {list.map((it, i) => (
                <li key={i}>
                  <span className={`dot dot--${it.type}`} />
                  <button type="button" className="dates__what linkish" onClick={() => open(it)}>{it.startMark ? `Starts: ${it.title}` : it.title}</button>
                  <Chip tone="soft">{KIND_LABEL[it.type]}</Chip>
                </li>
              ))}
            </ul>
          ) : (
            <Empty compact icon="calendar">Nothing on this day.</Empty>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function CalendarPage() {
  return (
    <div className="page">
      <PageHead eyebrow="Events" title="Calendar" sub="Events, milestones, deadlines, content, Radio and venue follow-ups in one place." />
      <Card>
        <MonthCalendar />
      </Card>
    </div>
  )
}

export function People() {
  const app = useApp()
  const { data, error } = useApi("t/people")
  const assignments = useApi("t/assignments?limit=1000")
  const items = (data && data.items) || []
  const roles = {}
  for (const a of (assignments.data && assignments.data.items) || []) if (a.person_id) (roles[a.person_id] ||= []).push(a)
  return (
    <div className="page">
      <PageHead eyebrow="Events" title="People" sub="Crew, collaborators and contacts. Assign them to roles inside each event." actions={<Btn kind="primary" icon="plus" onClick={() => app.openRecord("people")}>Add person</Btn>} />
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : items.length ? (
        <div className="people-grid">
          {items.map((p) => (
            <button key={p.id} type="button" className="person" onClick={() => app.openRecord("people", { item: p })}>
              <Avatar name={p.name} size={44} />
              <span className="person__text">
                <strong>{p.name}</strong>
                <span className="muted">{p.role || "No role"}</span>
                <span className="faint small">{[p.email, p.phone, p.instagram].filter(Boolean).join(" · ") || "No contact details"}</span>
                {roles[p.id] ? <span className="small">{roles[p.id].length} event role{roles[p.id].length === 1 ? "" : "s"}</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon="people" title="No one here yet" action={<Btn icon="plus" onClick={() => app.openRecord("people")}>Add person</Btn>}>Add your photographer, door team and collaborators.</Empty>
      )}
    </div>
  )
}
