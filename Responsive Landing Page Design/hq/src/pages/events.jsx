// EVENTS — list of nights and the production workspace for each one.
import { useEffect, useMemo, useRef, useState } from "react"
import { useApi, useApp, post, patch, save, remove, emitChanged, toast, navigate, money, fmtDay, fmtLong, fmtFull, fmtDate, relDay, pct, plural, daysBetween, EVENT_STATUS, VENUE_STATUS, PRIORITY, CONF, MS_STATUS, DOC_KIND, NOTE_KIND, timeAgo, API } from "../lib.js"
import { Card, Icon, Btn, A, Chip, Status, Stat, Ring, Bar, Empty, Loading, ErrorBox, Tabs, Segmented, Menu, Tick, Conf, Avatar, Notice, Sheet, Field, Input, copyText, Toggle } from "../ui.jsx"
import { MonthCalendar } from "./calendar.jsx"
import { completeTask } from "./home.jsx"

// ---------- list ----------
export function EventsList() {
  const app = useApp()
  const all = useApi("t/events")
  if (all.error) return <div className="page"><ErrorBox error={all.error} /></div>
  if (!all.data) return <div className="page"><Loading /></div>
  const events = all.data.items
  const open = events.filter((e) => !["completed", "cancelled"].includes(e.status))
  const past = events.filter((e) => ["completed", "cancelled"].includes(e.status))
  return (
    <div className="page">
      <header className="pagehead">
        <div className="pagehead__text">
          <p className="eyebrow">Event production</p>
          <h1 className="display">Events</h1>
          <p className="pagehead__sub">Every ROUGE night from first idea to reconciliation.</p>
        </div>
        <div className="pagehead__actions">
          <Btn icon="venue" onClick={() => navigate("venues")}>Venues</Btn>
          <Btn kind="primary" icon="plus" onClick={() => app.actions("event")}>New event</Btn>
        </div>
      </header>
      <div className="event-grid">
        {[...open, ...past].map((e) => <EventCard key={e.id} e={e} today={app.today} />)}
      </div>
    </div>
  )
}

function EventCard({ e, today }) {
  const days = e.date ? daysBetween(today, e.date) : null
  return (
    <A to={`events/${e.id}`} className={`event-card event-card--${e.status}`}>
      <span className="event-card__img" style={e.cover ? { backgroundImage: `url("${e.cover}")` } : undefined} aria-hidden="true" />
      <span className="event-card__body">
        <span className="event-card__top">
          <span className="event-card__num">{e.number || "—"}</span>
          <Status value={e.status} labels={EVENT_STATUS} />
        </span>
        <strong className="event-card__name">{e.name}</strong>
        {e.tagline ? <em className="event-card__tag">{e.tagline}</em> : null}
        <span className="event-card__meta">
          <span><Icon name="calendar" size={14} />{e.date ? `${fmtFull(e.date)}${days !== null && days >= 0 && e.status !== "completed" ? ` · ${days}d` : ""}` : "Date not set"}</span>
          <span><Icon name="venue" size={14} />{e.venue_name || "Venue not set"}</span>
        </span>
      </span>
    </A>
  )
}

// ---------- workspace ----------
const TABS = [
  ["overview", "Overview"],
  ["checklist", "Checklist"],
  ["timeline", "Timeline"],
  ["run", "Running order"],
  ["team", "Team"],
  ["money", "Budget & money"],
  ["files", "Files & notes"],
]

export function EventWorkspace({ id, tab }) {
  const app = useApp()
  const ws = useApi(`event/${id}`)
  if (ws.error) return <div className="page"><ErrorBox error={ws.error} onRetry={ws.reload} /></div>
  if (!ws.data) return <div className="page"><Loading rows={6} /></div>
  const d = ws.data
  const e = d.event
  const top = d.tasks.filter((t) => !t.parent_id)
  const done = top.filter((t) => t.status === "done").length
  const setTab = (t) => navigate(`events/${id}${t === "overview" ? "" : "/" + t}`, { replace: true })
  const counts = { checklist: `${done}/${top.length}`, run: d.run.length || null, team: d.assignments.length || null, files: d.docs.length + d.notes.length || null }
  return (
    <div className="page page--event">
      <header className="event-head" style={e.cover ? { "--cover": `url("${e.cover}")` } : undefined}>
        <div className="event-head__inner">
          <A to="events" className="back"><Icon name="left" size={16} />Events</A>
          <div className="event-head__row">
            <div>
              <p className="eyebrow eyebrow--light">{e.number ? `ROUGE · ${e.number}` : "Event"}</p>
              <h1 className="display event-head__title">{e.name}</h1>
              {e.tagline ? <p className="event-head__tag">{e.tagline}</p> : null}
            </div>
            <div className="event-head__side">
              <StatusPicker e={e} />
              <Btn kind="glass" icon="edit" onClick={() => app.openRecord("events", { item: e })}>Edit</Btn>
            </div>
          </div>
          <div className="event-head__facts">
            <span><Icon name="calendar" size={15} />{e.date ? fmtLong(e.date) : "Date not set"}{e.start_time ? ` · ${e.start_time}${e.end_time ? `–${e.end_time}` : ""}` : ""}</span>
            <span><Icon name="venue" size={15} />{e.venue_name || (d.venue && d.venue.name) || "Venue not set"}</span>
            {e.capacity ? <span><Icon name="people" size={15} />{e.capacity} capacity</span> : null}
            <span><Icon name="check" size={15} />{pct(done, top.length)}% of checklist</span>
          </div>
        </div>
      </header>
      <Tabs className="tabs--sticky" tabs={TABS.map(([k, l]) => [k, l, counts[k]])} value={tab} onChange={setTab} />
      <div className="tabpanel">
        {tab === "overview" ? <Overview d={d} reload={ws.reload} /> : null}
        {tab === "checklist" ? <Checklist d={d} setData={ws.setData} /> : null}
        {tab === "timeline" ? <Timeline d={d} /> : null}
        {tab === "run" ? <RunOrder d={d} setData={ws.setData} /> : null}
        {tab === "team" ? <Team d={d} /> : null}
        {tab === "money" ? <Money d={d} /> : null}
        {tab === "files" ? <Files d={d} /> : null}
      </div>
    </div>
  )
}

function StatusPicker({ e }) {
  return (
    <div className="select select--glass">
      <select
        aria-label="Event status"
        value={e.status}
        onChange={async (ev) => {
          try {
            await save("events", { status: ev.target.value }, e.id)
            toast(`Status: ${EVENT_STATUS[ev.target.value]}`)
          } catch (err) {
            toast(err.message, "bad")
          }
        }}
      >
        {Object.entries(EVENT_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <Icon name="down" size={14} />
    </div>
  )
}

function moneyFor(d) {
  const sum = (kind, status) => d.ledger.filter((l) => l.kind === kind && l.status === status).reduce((s, l) => s + l.amount_pence, 0)
  const budget = d.budget.reduce((s, b) => s + b.amount_pence, 0)
  const income = sum("income", "actual")
  const expense = sum("expense", "actual")
  return { income, expense, planned: sum("expense", "planned"), plannedIncome: sum("income", "planned"), budget, hasBudget: d.budget.length > 0, profit: income - expense, unconfirmed: d.ledger.filter((l) => l.confidence !== "verified").length, estimates: d.budget.filter((b) => b.confidence === "estimate").length }
}

function Overview({ d }) {
  const app = useApp()
  const e = d.event
  const top = d.tasks.filter((t) => !t.parent_id)
  const done = top.filter((t) => t.status === "done").length
  const m = moneyFor(d)
  const nextMs = d.milestones.filter((x) => x.status !== "done").slice(0, 4)
  const open = top.filter((t) => t.status !== "done")
  const urgent = open.filter((t) => t.priority === "urgent" || t.priority === "high" || (t.due && t.due < app.today)).slice(0, 5)
  return (
    <div className="ov-grid">
      <Card className="ov-progress" eyebrow="Progress">
        <div className="ov-progress__row">
          <Ring value={pct(done, top.length)} size={88} label="Checklist progress" />
          <div className="ov-progress__text">
            <p><strong>{done}</strong> of {top.length} tasks done</p>
            <p className="muted">{d.milestones.filter((x) => x.status === "done").length} of {d.milestones.length} milestones</p>
            {nextMs[0] ? <p className="small">Now: <strong>{(d.milestones.find((x) => x.status === "doing") || nextMs[0]).title}</strong></p> : null}
          </div>
        </div>
        {d.milestones.length ? (
          <div className="phasetrack phasetrack--labels">
            {d.milestones.map((x) => <span key={x.id} className={`phasetrack__seg phasetrack__seg--${x.status}`} title={x.title} />)}
          </div>
        ) : null}
      </Card>

      <Card eyebrow="The essentials" action={<Btn size="sm" icon="edit" onClick={() => app.openRecord("events", { item: e })}>Edit</Btn>}>
        <dl className="facts">
          <div><dt>Date</dt><dd>{e.date ? fmtLong(e.date) : <span className="faint">Not set</span>}</dd></div>
          <div><dt>Doors</dt><dd>{e.start_time ? `${e.start_time}${e.end_time ? ` – ${e.end_time}` : ""}` : <span className="faint">Not set</span>}</dd></div>
          <div><dt>Venue</dt><dd>{d.venue ? <A to={`venues/${d.venue.id}`}>{d.venue.name}</A> : e.venue_name || <span className="faint">{d.shortlist.length ? <A to="venues?view=shortlist">{plural(d.shortlist.length, "venue")} shortlisted</A> : "Not chosen"}</span>}</dd></div>
          <div><dt>Capacity</dt><dd>{e.capacity || <span className="faint">Not set</span>}</dd></div>
          <div><dt>Tickets</dt><dd>{e.tickets_sold != null ? `${e.tickets_sold}${e.ticket_target ? ` of ${e.ticket_target}` : ""} sold` : e.ticket_target ? <span>Target {e.ticket_target}</span> : <span className="faint">Not recorded</span>}{e.ticket_target && e.tickets_sold != null ? <Bar value={e.tickets_sold} max={e.ticket_target} /> : null}</dd></div>
          <div><dt>Prices</dt><dd>{e.ticket_price || <span className="faint">Not set</span>}</dd></div>
          <div><dt>Attendance</dt><dd>{e.attendance != null ? e.attendance : <span className="faint">Not recorded</span>}</dd></div>
          {e.ticket_url ? <div><dt>Ticket link</dt><dd><a href={e.ticket_url} target="_blank" rel="noopener noreferrer">Open <Icon name="external" size={13} /></a></dd></div> : null}
        </dl>
      </Card>

      <Card eyebrow="Money" action={<A to={`events/${e.id}/money`} className="link-sm">Details <Icon name="right" size={14} /></A>}>
        {m.hasBudget || d.ledger.length ? (
          <div className="mini-stats mini-stats--2">
            <div><strong>{m.hasBudget ? money(m.budget) : "—"}</strong><span>budget{m.estimates ? " (estimate)" : ""}</span></div>
            <div><strong>{money(m.expense)}</strong><span>spent</span></div>
            <div><strong>{money(m.income)}</strong><span>income</span></div>
            <div><strong className={m.profit < 0 ? "danger-text" : ""}>{d.ledger.length ? money(m.profit) : "—"}</strong><span>profit{m.unconfirmed ? " · provisional" : ""}</span></div>
          </div>
        ) : (
          <Empty compact icon="money">No budget or money recorded yet.</Empty>
        )}
        {e.bar_minimum_pence != null || e.bar_takings_pence != null ? (
          <div className="barresult">
            <p className="subhead">Bar (venue revenue)</p>
            <p>{e.bar_takings_pence != null ? money(e.bar_takings_pence) : "—"} takings vs {e.bar_minimum_pence != null ? money(e.bar_minimum_pence) : "—"} minimum{e.bar_takings_pence && e.bar_minimum_pence ? <strong> · {(e.bar_takings_pence / e.bar_minimum_pence).toFixed(2)}×</strong> : null}</p>
          </div>
        ) : null}
      </Card>

      <Card eyebrow="Needs attention" action={<A to={`events/${e.id}/checklist`} className="link-sm">Checklist <Icon name="right" size={14} /></A>}>
        {urgent.length ? (
          <ul className="lines">
            {urgent.map((t) => (
              <li key={t.id} className="line">
                <Tick checked={false} onChange={() => completeTask(t)} />
                <span className="line__main">
                  <span className="line__title">{t.title}</span>
                  <span className="line__meta">{t.priority !== "normal" ? <Chip tone={t.priority === "urgent" ? "red" : "brass"}>{PRIORITY[t.priority]}</Chip> : null}{t.due ? <span className={t.due < app.today ? "danger-text" : ""}>{relDay(t.due, app.today)}</span> : <span className="faint">No deadline</span>}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty compact icon="check">Nothing urgent.</Empty>
        )}
      </Card>

      <Card eyebrow="Key milestones" action={<A to={`events/${e.id}/timeline`} className="link-sm">Timeline <Icon name="right" size={14} /></A>}>
        {nextMs.length ? (
          <ul className="dates">
            {nextMs.map((x) => (
              <li key={x.id}>
                <span className="dates__day">{x.due_date ? fmtDay(x.due_date) : "—"}</span>
                <span className="dates__what">{x.title}</span>
                <Status value={x.status} labels={MS_STATUS} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty compact icon="timeline">{d.milestones.length ? "Every milestone is done." : "No timeline yet."}</Empty>
        )}
        {!e.date && d.milestones.length ? <p className="fineprint">Set the date, then “Schedule from date” on the Checklist to give these real deadlines.</p> : null}
      </Card>

      <Card eyebrow="Team" action={<A to={`events/${e.id}/team`} className="link-sm">Team <Icon name="right" size={14} /></A>}>
        {d.assignments.length ? (
          <ul className="team-mini">
            {d.assignments.slice(0, 6).map((a) => (
              <li key={a.id}><Avatar name={a.person_display || a.person_name || a.role} size={30} /><span><strong>{a.role}</strong><span className="muted small">{a.person_display || a.person_name || "Unassigned"}</span></span></li>
            ))}
          </ul>
        ) : (
          <Empty compact icon="people">No roles assigned yet.</Empty>
        )}
      </Card>

      <Card eyebrow="Documents & notes" action={<A to={`events/${e.id}/files`} className="link-sm">All <Icon name="right" size={14} /></A>}>
        {d.docs.length || d.notes.length ? (
          <ul className="notes-mini">
            {d.notes.slice(0, 4).map((n) => <li key={"n" + n.id}><A to={`knowledge/${n.id}`}><strong>{n.title}</strong><span className="faint small">{NOTE_KIND[n.kind]}</span></A></li>)}
            {d.docs.slice(0, 4).map((x) => <li key={"d" + x.id}><DocLink doc={x} /></li>)}
          </ul>
        ) : (
          <Empty compact icon="file">Nothing attached yet.</Empty>
        )}
      </Card>

      <Card className="ov-ai" eyebrow="ROUGE AI">
        <p className="muted">Ask about this event with all of its data in view, or send a research job out to the web.</p>
        <div className="row-gap wrap">
          <Btn icon="ai" onClick={() => navigate(`ai?event=${e.id}`)}>Ask about {e.name}</Btn>
          <Btn icon="globe" onClick={() => navigate(`ai/research?event=${e.id}`)}>Research for this event</Btn>
        </div>
        {e.summary ? <p className="ov-summary">{e.summary}</p> : null}
        {e.notes ? <p className="fineprint">{e.notes}</p> : null}
      </Card>
    </div>
  )
}

export function DocLink({ doc }) {
  const href = doc.r2_key ? `${API}files/${doc.id}` : doc.link
  return (
    <a href={href || "#"} target="_blank" rel="noopener noreferrer" className="doclink">
      <Icon name={doc.kind === "photo" ? "photo" : doc.r2_key ? "file" : "link"} size={16} />
      <strong>{doc.title}</strong>
      <span className="faint small">{DOC_KIND[doc.kind] || "File"}{doc.size ? ` · ${(doc.size / 1024 / 1024).toFixed(1)} MB` : ""}</span>
    </a>
  )
}

// ---------- checklist ----------
function Checklist({ d, setData }) {
  const app = useApp()
  const e = d.event
  const [filter, setFilter] = useState("open")
  const [group, setGroup] = useState("section")
  const [openId, setOpenId] = useState(null)
  const [newTitle, setNewTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const top = d.tasks.filter((t) => !t.parent_id)
  const subs = useMemo(() => {
    const m = {}
    for (const t of d.tasks) if (t.parent_id) (m[t.parent_id] ||= []).push(t)
    return m
  }, [d.tasks])
  const phases = Object.fromEntries(app.boot.phases.map((p, i) => [p.key, [i, p.title]]))
  const shown = top.filter((t) => (filter === "open" ? t.status !== "done" : filter === "done" ? t.status === "done" : filter === "overdue" ? t.status !== "done" && t.due && t.due < app.today : true))
  const groups = {}
  for (const t of shown) {
    const k = group === "section" ? t.section || "Other" : t.phase ? phases[t.phase]?.[1] || t.phase : "No phase"
    ;(groups[k] ||= []).push(t)
  }
  const order = Object.keys(groups).sort((a, b) => {
    if (group === "phase") {
      const ia = Object.values(phases).find((p) => p[1] === a)?.[0] ?? 99
      const ib = Object.values(phases).find((p) => p[1] === b)?.[0] ?? 99
      return ia - ib
    }
    const ia = top.findIndex((t) => (t.section || "Other") === a)
    const ib = top.findIndex((t) => (t.section || "Other") === b)
    return ia - ib
  })

  const toggle = (t, v) => {
    setData((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, status: v ? "done" : "todo" } : x)) }))
    completeTask(t, v)
  }
  const add = async () => {
    if (!newTitle.trim()) return
    setBusy(true)
    try {
      await save("tasks", { title: newTitle.trim(), event_id: e.id, priority: "normal" })
      setNewTitle("")
    } catch (err) {
      toast(err.message, "bad")
    }
    setBusy(false)
  }
  const doTemplate = async (tid) => {
    try {
      const r = await post(`event/${e.id}/template`, { template_id: tid })
      emitChanged("tasks")
      toast(r.added ? `Added ${plural(r.added, "task")}` : "Everything in that template is already here")
    } catch (err) {
      toast(err.message, "bad")
    }
  }
  const schedule = async () => {
    if (!e.date) {
      toast("Set the event date first", "bad")
      app.openRecord("events", { item: e })
      return
    }
    try {
      await post(`event/${e.id}/schedule`, {})
      emitChanged("tasks")
      toast(`Deadlines set from ${fmtDay(e.date)}`)
    } catch (err) {
      toast(err.message, "bad")
    }
  }
  const saveTemplate = async () => {
    const name = window.prompt("Name this checklist template", `${e.name} checklist`)
    if (!name) return
    try {
      await post(`event/${e.id}/save-template`, { name })
      emitChanged("templates")
      toast("Template saved")
    } catch (err) {
      toast(err.message, "bad")
    }
  }

  return (
    <div className="checklist">
      <div className="toolbar">
        <Segmented small options={{ open: "Open", overdue: "Overdue", done: "Done", all: "All" }} value={filter} onChange={setFilter} />
        <div className="row-gap">
          <Segmented small options={{ section: "By area", phase: "By phase" }} value={group} onChange={setGroup} />
          <Menu
            kind="ghost"
            items={[
              ...app.boot.templates.map((t) => ({ label: `Apply “${t.name}”`, icon: "list", onClick: () => doTemplate(t.id) })),
              "-",
              { label: e.date ? `Schedule from ${fmtDay(e.date)}` : "Schedule from date…", icon: "calendar", onClick: schedule },
              { label: "Save as a template", icon: "copy", onClick: saveTemplate },
            ]}
          />
        </div>
      </div>
      <form className="addline" onSubmit={(ev) => { ev.preventDefault(); add() }}>
        <Icon name="plus" size={18} />
        <input className="input input--bare" placeholder="Add a task…" value={newTitle} onChange={(ev) => setNewTitle(ev.target.value)} aria-label="New task" />
        {newTitle ? <Btn size="sm" kind="primary" busy={busy} onClick={add}>Add</Btn> : null}
      </form>
      {!top.length ? (
        <Empty icon="list" title="No checklist yet" action={app.boot.templates[0] ? <Btn kind="primary" onClick={() => doTemplate(app.boot.templates[0].id)}>Use “{app.boot.templates[0].name}”</Btn> : null}>Start from the standard ROUGE night, then edit it to fit.</Empty>
      ) : !shown.length ? (
        <Empty compact icon="check">{filter === "overdue" ? "Nothing overdue." : filter === "open" ? "Everything is done." : "Nothing here."}</Empty>
      ) : (
        order.map((g) => {
          const items = groups[g]
          const all = top.filter((t) => (group === "section" ? (t.section || "Other") === g : (phases[t.phase]?.[1] || (t.phase ? t.phase : "No phase")) === g))
          return (
            <section key={g} className="tgroup">
              <h3 className="tgroup__title">{g}<span>{all.filter((t) => t.status === "done").length}/{all.length}</span></h3>
              <ul className="tasks">
                {items.map((t) => (
                  <TaskRow key={t.id} t={t} subs={subs[t.id] || []} open={openId === t.id} onOpen={() => setOpenId(openId === t.id ? null : t.id)} onToggle={toggle} setData={setData} eventId={e.id} />
                ))}
              </ul>
            </section>
          )
        })
      )}
      {top.some((t) => t.offset_days != null && !t.due) && !e.date ? <Notice tone="info" icon="calendar">These tasks have suggested timings. Set the event date, then use ⋯ → Schedule from date.</Notice> : null}
    </div>
  )
}

function TaskRow({ t, subs, open, onOpen, onToggle, setData, eventId }) {
  const app = useApp()
  const [sub, setSub] = useState("")
  const overdue = t.status !== "done" && t.due && t.due < app.today
  const subDone = subs.filter((s) => s.status === "done").length
  const addSub = async () => {
    if (!sub.trim()) return
    try {
      await save("tasks", { title: sub.trim(), parent_id: t.id, event_id: eventId, section: t.section, phase: t.phase, sort: subs.length })
      setSub("")
    } catch (err) {
      toast(err.message, "bad")
    }
  }
  return (
    <li className={`task${t.status === "done" ? " is-done" : ""}${open ? " is-open" : ""}`}>
      <div className="task__row">
        <Tick checked={t.status === "done"} onChange={(v) => onToggle(t, v)} />
        <button type="button" className="task__main" onClick={onOpen} aria-expanded={open}>
          <span className="task__title">{t.title}</span>
          <span className="task__meta">
            {t.priority === "urgent" || t.priority === "high" ? <span className={`prio prio--${t.priority}`}>{PRIORITY[t.priority]}</span> : null}
            {t.due ? <span className={overdue ? "danger-text" : ""}><Icon name="calendar" size={12} />{relDay(t.due, app.today)}</span> : null}
            {t.owner ? <span><Icon name="people" size={12} />{t.owner}</span> : null}
            {subs.length ? <span><Icon name="list" size={12} />{subDone}/{subs.length}</span> : null}
            {t.status === "doing" ? <Chip tone="brass">In progress</Chip> : null}
          </span>
        </button>
        <Btn kind="quiet" size="sm" icon="edit" aria-label="Edit task" onClick={() => app.openRecord("tasks", { item: t })} />
      </div>
      {open ? (
        <div className="task__detail">
          {t.notes ? <p className="task__notes">{t.notes}</p> : null}
          <ul className="subtasks">
            {subs.map((s) => (
              <li key={s.id} className={s.status === "done" ? "is-done" : ""}>
                <Tick size={18} checked={s.status === "done"} onChange={(v) => onToggle(s, v)} />
                <span>{s.title}</span>
                <button type="button" className="x" aria-label={`Delete ${s.title}`} onClick={() => remove("tasks", s.id)}><Icon name="close" size={14} /></button>
              </li>
            ))}
          </ul>
          <form className="addline addline--sub" onSubmit={(ev) => { ev.preventDefault(); addSub() }}>
            <Icon name="plus" size={16} />
            <input className="input input--bare" placeholder="Add a subtask…" value={sub} onChange={(ev) => setSub(ev.target.value)} aria-label="New subtask" />
          </form>
          <div className="row-gap wrap task__actions">
            {t.status !== "doing" && t.status !== "done" ? <Btn size="sm" onClick={() => save("tasks", { status: "doing" }, t.id)}>Start</Btn> : null}
            <Btn size="sm" icon="edit" onClick={() => app.openRecord("tasks", { item: t })}>Deadline, owner, priority</Btn>
          </div>
        </div>
      ) : null}
    </li>
  )
}

// ---------- timeline ----------
function Timeline({ d }) {
  const app = useApp()
  const [view, setView] = useState("timeline")
  const e = d.event
  const ms = d.milestones
  const dated = ms.filter((m) => m.due_date || m.start_date)
  const cycle = async (m) => {
    const next = { todo: "doing", doing: "done", done: "todo" }[m.status]
    try {
      await save("milestones", { status: next }, m.id)
    } catch (err) {
      toast(err.message, "bad")
    }
  }
  return (
    <div className="timeline-tab">
      <div className="toolbar">
        <Segmented small options={{ timeline: "Timeline", calendar: "Calendar" }} value={view} onChange={setView} />
        <div className="row-gap">
          {!ms.length ? <Btn size="sm" icon="plus" onClick={async () => { await post(`event/${e.id}/milestones`, {}); emitChanged("milestones") }}>Add the standard timeline</Btn> : null}
          <Btn size="sm" icon="plus" onClick={() => app.openRecord("milestones", { defaults: { event_id: e.id, status: "todo", sort: ms.length } })}>Milestone</Btn>
        </div>
      </div>
      {view === "calendar" ? (
        <Card><MonthCalendar eventId={e.id} initial={e.date || (dated[0] && (dated[0].start_date || dated[0].due_date)) || undefined} /></Card>
      ) : !ms.length ? (
        <Empty icon="timeline" title="No timeline yet">Add the standard production timeline: venue research through to reconciliation.</Empty>
      ) : (
        <Card pad={false}>
          {!dated.length ? (
            <div className="card--pad">
              <Notice tone="info" icon="calendar" action={e.date ? <Btn size="sm" kind="primary" onClick={async () => { await post(`event/${e.id}/schedule`, {}); emitChanged("milestones"); toast("Scheduled") }}>Schedule from {fmtDay(e.date)}</Btn> : <Btn size="sm" kind="primary" onClick={() => app.openRecord("events", { item: e })}>Set the date</Btn>}>
                {e.date ? "The phases have suggested timings. Turn them into dates." : "No dates yet. Set the event date and HQ will lay the phases out backwards from the night."}
              </Notice>
            </div>
          ) : null}
          <Gantt ms={ms} today={app.today} eventDate={e.date} onCycle={cycle} onEdit={(m) => app.openRecord("milestones", { item: m })} />
        </Card>
      )}
    </div>
  )
}

function Gantt({ ms, today, eventDate, onCycle, onEdit }) {
  const dates = ms.flatMap((m) => [m.start_date, m.due_date]).filter(Boolean)
  const hasDates = dates.length > 0
  const min = hasDates ? dates.reduce((a, b) => (a < b ? a : b)) : null
  const max = hasDates ? dates.reduce((a, b) => (a > b ? a : b)) : null
  const span = hasDates ? Math.max(1, daysBetween(min, max)) : 1
  const x = (iso) => (daysBetween(min, iso) / span) * 100
  const todayX = hasDates && today >= min && today <= max ? x(today) : null
  const eventX = hasDates && eventDate && eventDate >= min && eventDate <= max ? x(eventDate) : null
  return (
    <div className="gantt">
      {hasDates ? (
        <div className="gantt__scale" aria-hidden="true">
          <span>{fmtDate(min)}</span>
          <span>{fmtDate(max)}</span>
        </div>
      ) : null}
      <ul className="gantt__rows">
        {ms.map((m) => {
          const s = m.start_date || m.due_date
          const f = m.due_date || m.start_date
          const late = m.status !== "done" && m.due_date && m.due_date < today
          return (
            <li key={m.id} className={`gantt__row gantt__row--${m.status}${late ? " is-late" : ""}`}>
              <button type="button" className="gantt__label" onClick={() => onEdit(m)}>
                <strong>{m.title}</strong>
                <span className="faint small">{s ? (s === f ? fmtDay(f) : `${fmtDate(s)} → ${fmtDate(f)}`) : "No date"}{late ? " · late" : ""}</span>
              </button>
              <div className="gantt__track">
                {hasDates && s ? <span className="gantt__bar" style={{ left: `${x(s)}%`, width: `max(8px, ${x(f) - x(s)}%)` }} /> : null}
                {todayX !== null ? <span className="gantt__today" style={{ left: `${todayX}%` }} /> : null}
                {eventX !== null ? <span className="gantt__event" style={{ left: `${eventX}%` }} /> : null}
              </div>
              <button type="button" className="gantt__status" onClick={() => onCycle(m)} aria-label={`${m.title}: ${MS_STATUS[m.status]}. Tap to change.`}>
                <Status value={m.status} labels={MS_STATUS} />
              </button>
            </li>
          )
        })}
      </ul>
      {hasDates ? (
        <p className="gantt__legend faint small">
          <span><i className="gantt__key gantt__key--today" />Today</span>
          {eventX !== null ? <span><i className="gantt__key gantt__key--event" />The night</span> : null}
          <span>Tap a status to move it on.</span>
        </p>
      ) : null}
    </div>
  )
}

// ---------- running order (drag to reorder) ----------
function useDragOrder(ids, onCommit) {
  const [order, setOrder] = useState(ids)
  const [dragging, setDragging] = useState(null)
  const refs = useRef({})
  const orderRef = useRef(ids)
  useEffect(() => {
    if (!dragging) {
      setOrder(ids)
      orderRef.current = ids
    }
  }, [ids.join(",")])
  const handle = (id) => ({
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button !== 0) return
      e.preventDefault()
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      setDragging(id)
      const move = (ev) => {
        const y = ev.clientY
        const cur = orderRef.current
        const idx = cur.indexOf(id)
        let target = idx
        for (let i = 0; i < cur.length; i++) {
          const r = refs.current[cur[i]] && refs.current[cur[i]].getBoundingClientRect()
          if (!r) continue
          const mid = r.top + r.height / 2
          if (i < idx && y < mid) {
            target = i
            break
          }
          if (i > idx && y > mid) target = i
        }
        if (target !== idx) {
          const next = cur.slice()
          next.splice(idx, 1)
          next.splice(target, 0, id)
          orderRef.current = next
          setOrder(next)
        }
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        el.removeEventListener("pointercancel", up)
        setDragging(null)
        if (orderRef.current.join(",") !== ids.join(",")) onCommit(orderRef.current)
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
      el.addEventListener("pointercancel", up)
    },
    onKeyDown: (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
      e.preventDefault()
      const cur = orderRef.current.slice()
      const i = cur.indexOf(id)
      const j = e.key === "ArrowUp" ? i - 1 : i + 1
      if (j < 0 || j >= cur.length) return
      ;[cur[i], cur[j]] = [cur[j], cur[i]]
      orderRef.current = cur
      setOrder(cur)
      onCommit(cur)
    },
  })
  return { order, dragging, refs, handle }
}

function RunOrder({ d, setData }) {
  const app = useApp()
  const e = d.event
  const byId = Object.fromEntries(d.run.map((r) => [r.id, r]))
  const ids = d.run.map((r) => r.id)
  const commit = async (next) => {
    setData((s) => ({ ...s, run: next.map((id) => s.run.find((r) => r.id === id)) }))
    try {
      await post("reorder", { type: "run", ids: next })
    } catch (err) {
      toast(err.message, "bad")
    }
  }
  const { order, dragging, refs, handle } = useDragOrder(ids, commit)
  const toggle = async (r) => {
    setData((s) => ({ ...s, run: s.run.map((x) => (x.id === r.id ? { ...x, done: x.done ? 0 : 1 } : x)) }))
    try {
      await save("run", { done: r.done ? 0 : 1 }, r.id)
    } catch (err) {
      toast(err.message, "bad")
    }
  }
  const useTemplate = async () => {
    try {
      await post(`event/${e.id}/run-template`, {})
      emitChanged("run")
    } catch (err) {
      toast(err.message, "bad")
    }
  }
  const done = d.run.filter((r) => r.done).length
  return (
    <div className="runorder">
      <div className="toolbar">
        <p className="muted small">{d.run.length ? `${done} of ${d.run.length} done · drag ⠿ to reorder` : "The event-day timetable."}</p>
        <div className="row-gap">
          <Btn size="sm" icon="link" onClick={() => navigate(`events/${e.id}/team`)}>Share with crew</Btn>
          <Btn size="sm" kind="primary" icon="plus" onClick={() => app.openRecord("run", { defaults: { event_id: e.id, sort: d.run.length } })}>Add</Btn>
        </div>
      </div>
      {!d.run.length ? (
        <Empty icon="clock" title="No running order yet" action={<Btn kind="primary" onClick={useTemplate}>Start from a standard night</Btn>}>Load-in to settlement, with suggested times you can edit for the venue.</Empty>
      ) : (
        <ol className="run">
          {order.map((id) => {
            const r = byId[id]
            if (!r) return null
            return (
              <li key={id} ref={(el) => (refs.current[id] = el)} className={`run__item${r.done ? " is-done" : ""}${dragging === id ? " is-dragging" : ""}`}>
                <button type="button" className="run__grip" aria-label={`Move ${r.activity}. Use arrow keys.`} {...handle(id)}>
                  <Icon name="grip" size={18} />
                </button>
                <span className="run__time">{r.time || "—"}</span>
                <button type="button" className="run__main" onClick={() => app.openRecord("run", { item: r })}>
                  <strong>{r.activity}</strong>
                  {r.person || r.location ? <span className="muted small">{[r.person, r.location].filter(Boolean).join(" · ")}</span> : null}
                  {r.notes ? <span className="faint small">{r.notes}</span> : null}
                </button>
                <Tick checked={!!r.done} onChange={() => toggle(r)} />
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

// ---------- team & crew links ----------
function Team({ d }) {
  const app = useApp()
  const e = d.event
  const taken = new Set(d.assignments.map((a) => a.role))
  const free = app.boot.roles.filter((r) => !taken.has(r))
  const [share, setShare] = useState(null)
  return (
    <div className="team-tab">
      <Card eyebrow="Roles & shifts" action={<Btn size="sm" kind="primary" icon="plus" onClick={() => app.openRecord("assignments", { defaults: { event_id: e.id } })}>Assign</Btn>}>
        {d.assignments.length ? (
          <ul className="assign">
            {d.assignments.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => app.openRecord("assignments", { item: a })}>
                  <Avatar name={a.person_display || a.person_name || a.role} size={36} />
                  <span className="assign__text">
                    <strong>{a.role}</strong>
                    <span className="muted small">{a.person_display || a.person_name || "Unassigned"}{a.shift_start ? ` · ${a.shift_start}${a.shift_end ? `–${a.shift_end}` : ""}` : ""}</span>
                    {a.notes ? <span className="faint small">{a.notes}</span> : null}
                  </span>
                  {a.confirmed ? <Chip tone="ok" icon="check">Confirmed</Chip> : <Chip tone="soft">Unconfirmed</Chip>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty compact icon="people">No one assigned yet.</Empty>
        )}
        {free.length ? (
          <div className="chips-row">
            <span className="faint small">Add a role:</span>
            {free.map((r) => (
              <button key={r} type="button" className="chip chip--soft chip--btn" onClick={() => app.openRecord("assignments", { defaults: { event_id: e.id, role: r } })}>
                <Icon name="plus" size={12} />{r}
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      <Card eyebrow="Crew links" title="Give collaborators only what they need" action={<Btn size="sm" icon="link" onClick={() => setShare({})}>New link</Btn>}>
        <p className="muted small">A crew link opens a read-only sheet for this event — no sign-in, no money, no contracts, no subscriber data. Links expire, and you can turn one off at any time.</p>
        {d.shares.length ? (
          <ul className="shares">
            {d.shares.map((s) => {
              const expired = s.expires_at && Date.parse(s.expires_at) < Date.now()
              return (
                <li key={s.id} className={s.revoked || expired ? "is-off" : ""}>
                  <span>
                    <strong>{s.label}</strong>
                    <span className="faint small">{s.areas.split(",").map((a) => ({ run: "Running order", team: "Team", tasks: "Crew tasks", venue: "Venue" })[a]).join(" · ")} · {s.revoked ? "Turned off" : expired ? "Expired" : `until ${fmtDay(s.expires_at.slice(0, 10))}`}{s.last_seen ? ` · opened ${timeAgo(s.last_seen)}` : " · not opened yet"}</span>
                  </span>
                  {!s.revoked && !expired ? <Btn size="sm" kind="quiet" onClick={async () => { await post(`shares/${s.id}/revoke`, {}); emitChanged("shares"); toast("Link turned off") }}>Turn off</Btn> : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </Card>
      {share ? <ShareSheet e={e} onClose={() => setShare(null)} /> : null}
    </div>
  )
}

function ShareSheet({ e, onClose }) {
  const [label, setLabel] = useState("Crew")
  const [areas, setAreas] = useState({ run: true, team: true, tasks: false, venue: true })
  const [days, setDays] = useState(30)
  const [url, setUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const create = async () => {
    setBusy(true)
    try {
      const r = await post("shares", { event_id: e.id, label, areas: Object.keys(areas).filter((k) => areas[k]), days })
      setUrl(r.url)
      emitChanged("shares")
    } catch (err) {
      toast(err.message, "bad")
    }
    setBusy(false)
  }
  return (
    <Sheet open onClose={onClose} eyebrow={e.name} title="New crew link" footer={url ? <><span /><Btn kind="primary" onClick={onClose}>Done</Btn></> : <><span /><div className="row-gap"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" busy={busy} onClick={create}>Create link</Btn></div></>}>
      {url ? (
        <div className="form">
          <Notice tone="ok" icon="check">Copy it now — for safety HQ only keeps a fingerprint of the link, so it can't show it again.</Notice>
          <div className="copyline">
            <input className="input" readOnly value={url} onFocus={(ev) => ev.target.select()} aria-label="Crew link" />
            <Btn kind="primary" icon="copy" onClick={async () => toast((await copyText(url)) ? "Copied" : "Select and copy the link", "ok")}>Copy</Btn>
          </div>
        </div>
      ) : (
        <div className="form">
          <Field label="Who it's for">{(id) => <Input id={id} value={label} onChange={setLabel} placeholder="Door team" />}</Field>
          <div className="field field--wide">
            <div className="field__label"><label>What they can see</label></div>
            <div className="checks">
              {[["run", "Running order"], ["team", "Team & shifts"], ["tasks", "Crew tasks (prep, kit, staffing, the night)"], ["venue", "Venue name, address and licence"]].map(([k, l]) => (
                <Toggle key={k} checked={areas[k]} onChange={(v) => setAreas((a) => ({ ...a, [k]: !!v }))} label={l} />
              ))}
            </div>
          </div>
          <Field label="Expires after (days)">{(id) => <Input id={id} type="number" value={days} onChange={(v) => setDays(Number(v) || 1)} min={1} max={120} />}</Field>
        </div>
      )}
    </Sheet>
  )
}

// ---------- money ----------
function Money({ d }) {
  const app = useApp()
  const e = d.event
  const m = moneyFor(d)
  const remaining = m.budget - m.expense - m.planned
  return (
    <div className="money-tab">
      <div className="pulse pulse--4">
        <Stat label="Income" value={money(m.income)} sub={m.plannedIncome ? `${money(m.plannedIncome)} expected` : "Received"} empty={!d.ledger.some((l) => l.kind === "income")} />
        <Stat label="Costs" value={money(m.expense)} sub={m.planned ? `+ ${money(m.planned)} planned` : "Paid"} empty={!d.ledger.some((l) => l.kind === "expense")} />
        <Stat label="Profit" value={money(m.profit)} sub={m.unconfirmed ? `Provisional · ${plural(m.unconfirmed, "entry", "entries")} to confirm` : "From recorded entries"} empty={!d.ledger.length} tone={m.profit < 0 ? "bad" : undefined} />
        <Stat label="Budget left" value={money(remaining)} sub={m.hasBudget ? `of ${money(m.budget)}${m.estimates ? " (estimate)" : ""}` : "No budget"} empty={!m.hasBudget} tone={remaining < 0 ? "bad" : undefined} />
      </div>

      <Card eyebrow="Budget" title={m.hasBudget ? money(m.budget) : null} action={<Btn size="sm" icon="plus" onClick={() => app.openRecord("budget", { defaults: { event_id: e.id, confidence: "estimate", sort: d.budget.length } })}>Line</Btn>}>
        {d.budget.length ? (
          <table className="table">
            <thead><tr><th>Line</th><th className="num">Amount</th><th>Basis</th></tr></thead>
            <tbody>
              {d.budget.map((b) => (
                <tr key={b.id} onClick={() => app.openRecord("budget", { item: b })} className="is-clickable">
                  <td><strong>{b.category}</strong>{b.notes ? <span className="faint small block">{b.notes}</span> : null}</td>
                  <td className="num">{money(b.amount_pence)}</td>
                  <td><Conf value={b.confidence} compact /></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>Total</td><td className="num">{money(m.budget)}</td><td /></tr></tfoot>
          </table>
        ) : (
          <Empty compact icon="money">No budget yet. Add the lines you expect to spend on.</Empty>
        )}
      </Card>

      <Card eyebrow="Income & costs" action={<div className="row-gap"><Btn size="sm" icon="plus" onClick={() => app.openRecord("ledger", { defaults: { event_id: e.id, kind: "income", status: "actual", confidence: "verified", category: "Tickets" } })}>Income</Btn><Btn size="sm" icon="plus" onClick={() => app.actions("expense", { event_id: e.id })}>Cost</Btn></div>}>
        <LedgerList items={d.ledger} />
      </Card>
    </div>
  )
}

export function LedgerList({ items, showEvent }) {
  const app = useApp()
  if (!items.length) return <Empty compact icon="money">Nothing recorded yet. Every figure in HQ comes from entries like these.</Empty>
  return (
    <ul className="ledger">
      {items.map((l) => (
        <li key={l.id}>
          <button type="button" onClick={() => app.openRecord("ledger", { item: l })}>
            <span className={`ledger__sign ledger__sign--${l.kind}`} aria-hidden="true">{l.kind === "income" ? "+" : "−"}</span>
            <span className="ledger__text">
              <strong>{l.description}</strong>
              <span className="faint small">{[l.category, l.date ? fmtDay(l.date) : null, l.party, showEvent && l.event_name].filter(Boolean).join(" · ")}{l.status === "planned" ? " · planned" : ""}</span>
            </span>
            <span className="ledger__amt">
              <span className={`num ${l.kind === "income" ? "" : "muted"}`}>{l.kind === "income" ? "" : "−"}{money(l.amount_pence)}</span>
              <Conf value={l.confidence} compact />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ---------- files & notes ----------
function Files({ d }) {
  const app = useApp()
  const e = d.event
  const newNote = async () => {
    try {
      const n = await save("notes", { title: `${e.name} — note`, kind: "note", event_id: e.id, body: "" })
      navigate(`knowledge/${n.id}`)
    } catch (err) {
      toast(err.message, "bad")
    }
  }
  return (
    <div className="files-tab">
      <Card eyebrow="Documents" action={<Btn size="sm" icon="upload" onClick={() => app.openUpload({ event_id: e.id })}>Add</Btn>}>
        {d.docs.length ? (
          <ul className="docs">
            {d.docs.map((x) => (
              <li key={x.id}>
                <DocLink doc={x} />
                <Btn kind="quiet" size="sm" icon="edit" aria-label="Edit" onClick={() => app.openRecord("docs", { item: x })} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty compact icon="file">Contracts, invoices, riders and photos for this night go here.</Empty>
        )}
      </Card>
      <Card eyebrow="Notes" action={<Btn size="sm" icon="plus" onClick={newNote}>Note</Btn>}>
        {d.notes.length ? (
          <ul className="notes-mini">
            {d.notes.map((n) => <li key={n.id}><A to={`knowledge/${n.id}`}><strong>{n.title}</strong><span className="faint small">{NOTE_KIND[n.kind]} · {timeAgo(n.updated_at)}</span></A></li>)}
          </ul>
        ) : (
          <Empty compact icon="note">No notes yet.</Empty>
        )}
      </Card>
      <Card eyebrow="Research" action={<Btn size="sm" icon="globe" onClick={() => navigate(`ai/research?event=${e.id}`)}>New</Btn>}>
        {d.research.length ? (
          <ul className="notes-mini">
            {d.research.map((r) => <li key={r.id}><A to={`ai/research/${r.id}`}><strong>{r.question}</strong><span className="faint small">{r.status} · {timeAgo(r.created_at)}</span></A></li>)}
          </ul>
        ) : (
          <Empty compact icon="globe">No research for this event yet.</Empty>
        )}
      </Card>
      {d.ideas.length ? (
        <Card eyebrow="Ideas">
          <ul className="notes-mini">{d.ideas.map((i) => <li key={i.id}><A to="studio"><strong>{i.title}</strong><span className="faint small">{i.status}</span></A></li>)}</ul>
        </Card>
      ) : null}
    </div>
  )
}
