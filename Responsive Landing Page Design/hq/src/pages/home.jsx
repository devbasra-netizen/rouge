// HOME — the daily control centre.
import { useState } from "react"
import { useApi, useApp, patch, post, emitChanged, toast, money, fmtLong, fmtDay, relDay, timeAgo, greeting, pct, plural, navigate, EVENT_STATUS, VENUE_STATUS, IDEA_KIND, CHANNELS, CONTENT_STATUS, QUICK } from "../lib.js"
import { Card, Icon, Btn, A, Chip, Status, Stat, Ring, Empty, Loading, ErrorBox, Tick, Menu, Bar } from "../ui.jsx"

export async function completeTask(t, done = true) {
  try {
    await patch(`t/tasks/${t.id}`, { status: done ? "done" : "todo" })
    emitChanged("tasks")
    if (done) toast(`Done: ${t.title}`)
  } catch (e) {
    toast(e.message, "bad")
  }
}

function TaskLine({ t, today, showEvent = true }) {
  const [done, setDone] = useState(false)
  const overdue = t.due && t.due < today
  return (
    <li className={`line${done ? " is-done" : ""}`}>
      <Tick checked={done} onChange={(v) => { setDone(v); completeTask(t, v) }} />
      <a className="line__main" href={`/admin/hq/events/${t.event_id}/checklist`} onClick={(e) => { e.preventDefault(); t.event_id && navigate(`events/${t.event_id}/checklist`) }}>
        <span className="line__title">{t.title}</span>
        <span className="line__meta">
          {t.priority === "urgent" ? <Chip tone="red">Urgent</Chip> : t.priority === "high" ? <Chip tone="brass">High</Chip> : null}
          {showEvent && t.event_number ? <span>ROUGE {t.event_number}</span> : null}
          {t.due ? <span className={overdue ? "danger-text" : ""}>{relDay(t.due, today)}</span> : <span className="faint">No deadline</span>}
        </span>
      </a>
    </li>
  )
}

function NextChapter({ e, milestones, today }) {
  const app = useApp()
  if (!e)
    return (
      <Card className="chapter chapter--empty" eyebrow="The next chapter">
        <Empty icon="events" title="No upcoming event" action={<Btn kind="primary" icon="plus" onClick={() => app.actions("event")}>Create event</Btn>}>Plan the next ROUGE and it will live here.</Empty>
      </Card>
    )
  const taskPct = pct(e.tasks.done, e.tasks.total)
  const budget = e.budget && e.budget.n ? e.budget.total : null
  return (
    <section className="chapter" style={e.cover ? { "--cover": `url("${e.cover}")` } : undefined}>
      <div className="chapter__inner">
        <div className="chapter__top">
          <div>
            <p className="eyebrow eyebrow--light">The next chapter</p>
            <h2 className="chapter__title">{e.name}</h2>
            {e.tagline ? <p className="chapter__tag">{e.tagline}</p> : null}
          </div>
          <Ring value={taskPct} label={`Checklist ${taskPct}% complete`} />
        </div>
        <div className="chapter__facts">
          <span><Icon name="calendar" size={15} />{e.date ? `${fmtLong(e.date)}${e.days_to_go >= 0 ? ` · ${plural(e.days_to_go, "day")} to go` : ""}` : "Date not set"}</span>
          <span><Icon name="venue" size={15} />{e.venue_name || (e.shortlist ? `Venue not chosen · ${e.shortlist} shortlisted` : "Venue not chosen")}</span>
          <span><Icon name="check" size={15} />{e.tasks.total ? `${e.tasks.done} of ${e.tasks.total} tasks` : "No checklist yet"}</span>
          {budget !== null ? <span><Icon name="money" size={15} />{money(budget)} budget{e.budget.estimates ? " (estimate)" : ""}</span> : null}
        </div>
        {milestones.length ? (
          <div className="phasetrack" aria-label="Production timeline">
            {milestones.map((m) => (
              <span key={m.id} className={`phasetrack__seg phasetrack__seg--${m.status}`} title={`${m.title}: ${m.status === "done" ? "done" : m.status === "doing" ? "in progress" : "not started"}${m.due_date ? ` · due ${fmtDay(m.due_date)}` : ""}`} />
            ))}
          </div>
        ) : null}
        {milestones.length ? (
          <p className="chapter__now">
            Now: <strong>{(milestones.find((m) => m.status === "doing") || milestones.find((m) => m.status !== "done") || milestones[milestones.length - 1]).title}</strong>
          </p>
        ) : null}
        <div className="chapter__actions">
          <Btn kind="light" iconRight="right" onClick={() => navigate(`events/${e.id}`)}>Open workspace</Btn>
          <Btn kind="glass" onClick={() => navigate(`events/${e.id}/checklist`)}>Checklist</Btn>
          {e.shortlist ? <Btn kind="glass" onClick={() => navigate("venues?view=shortlist")}>Venues</Btn> : null}
        </div>
      </div>
    </section>
  )
}

function Spark({ ideas }) {
  const app = useApp()
  const [i, setI] = useState(0)
  if (!ideas.length)
    return (
      <Card className="spark" eyebrow="Creative spark">
        <Empty icon="bulb" title="The notebook is empty" action={<Btn icon="plus" onClick={() => app.actions("idea")}>Capture an idea</Btn>}>Half-formed is fine. Capture it before it goes.</Empty>
      </Card>
    )
  const idea = ideas[i % ideas.length]
  const convert = async (to) => {
    try {
      const r = await post(`convert/idea/${idea.id}`, { to })
      emitChanged("ideas")
      toast(`Turned into a ${to}`)
      if (to === "event") navigate(`events/${r.item.id}`)
      if (to === "note") navigate(`knowledge/${r.item.id}`)
    } catch (e) {
      toast(e.message, "bad")
    }
  }
  return (
    <Card className="spark" eyebrow="Creative spark" action={ideas.length > 1 ? <Btn kind="quiet" size="sm" icon="shuffle" onClick={() => setI((x) => x + 1)} aria-label="Another idea" /> : null}>
      <blockquote className="spark__quote">{idea.title}</blockquote>
      {idea.body ? <p className="spark__body">{idea.body}</p> : null}
      <div className="spark__foot">
        <span className="row-gap">
          <Chip tone="soft">{IDEA_KIND[idea.kind] || idea.kind}</Chip>
          {idea.source ? <span className="faint small">{idea.source}</span> : null}
        </span>
        <span className="row-gap">
          <Btn size="sm" onClick={() => app.openRecord("ideas", { item: idea })}>Develop</Btn>
          <Menu kind="ghost" size="sm" icon="right" label="Turn into" align="right" items={[{ label: "An event", icon: "events", onClick: () => convert("event") }, { label: "A task", icon: "check", onClick: () => convert("task") }, { label: "A campaign", icon: "campaign", onClick: () => convert("campaign") }, { label: "A Radio episode", icon: "radio", onClick: () => convert("radio") }, { label: "A note", icon: "note", onClick: () => convert("note") }]} />
        </span>
      </div>
    </Card>
  )
}

function Pulse({ p, last }) {
  const tr = p.ticket_revenue
  const ep = p.event_profit
  const lg = p.list_growth
  const at = p.attendance
  const uc = p.upcoming_costs
  const br = p.budget_remaining
  return (
    <div className="pulse">
      <Stat icon="ticket" label="Ticket revenue" empty={!tr} value={tr && money(tr.value)} sub={tr ? (tr.unconfirmed ? `${plural(tr.unconfirmed, "entry", "entries")} to confirm` : "All verified") : "No ticket income recorded"} onClick={() => navigate("finance")} />
      <Stat icon="finance" label="Event profit" empty={!ep} value={ep && money(ep.value)} sub={ep ? `${ep.event}${ep.unconfirmed ? " · provisional" : ""}` : "No completed event with money yet"} tone={ep && ep.value < 0 ? "bad" : undefined} onClick={() => navigate(last ? `events/${last.id}/money` : "finance")} />
      <Stat icon="audience" label="Mailing list" empty={!lg} value={lg && lg.total.toLocaleString("en-GB")} sub={lg ? `+${lg.last30} in 30 days${lg.prev30 || lg.last30 ? ` (previous 30: ${lg.prev30})` : ""}` : "Signup table not found"} onClick={() => navigate("audience")} />
      <Stat icon="people" label="Attendance" empty={!at || at.value === null || at.value === undefined} value={at && at.value} sub={at ? (at.value === null || at.value === undefined ? `Not recorded for ${at.event}` : `${at.event}${at.capacity ? ` · cap ${at.capacity}` : ""}`) : "No completed events"} onClick={() => last && navigate(`events/${last.id}`)} />
      <Stat icon="calendar" label="Upcoming costs" empty={!uc} value={uc && money(uc.value)} sub={uc ? `${plural(uc.items.length, "planned cost")}` : "No planned costs"} onClick={() => navigate("finance")} />
      <Stat icon="money" label="Budget remaining" empty={!br} value={br && money(br.value)} sub={br ? `of ${money(br.budget)} for ${br.event}${br.estimates ? " (estimate)" : ""}` : "No budget set"} tone={br && br.value < 0 ? "bad" : undefined} onClick={() => br && navigate("finance")} />
    </div>
  )
}

export default function Home() {
  const app = useApp()
  const { data, error, loading, reload } = useApi("dashboard")
  const today = app.today
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>
  if (!data) return <div className="page"><Loading rows={5} /></div>
  const d = data
  const needs = [...d.overdue, ...d.priority.filter((t) => !d.overdue.some((o) => o.id === t.id))].slice(0, 7)
  const summary = [
    d.overdue_count ? `${d.overdue_count} overdue` : null,
    d.priority.length ? plural(d.priority.length, "priority task") : null,
    d.reminders.length ? plural(d.reminders.length, "reminder") : null,
    d.venues_pending.length ? plural(d.venues_pending.length, "venue enquiry", "venue enquiries") : null,
  ].filter(Boolean)

  return (
    <div className="page page--home">
      <header className="hello">
        <p className="eyebrow">{fmtLong(today)}</p>
        <h1 className="display hello__title">{greeting()}, {app.boot.me.name || "Dev"}.</h1>
        <p className="hello__sub">{summary.length ? summary.join(" · ") : "Nothing urgent. A good day to make something."}</p>
      </header>

      <div className="home-grid">
        <Card className="today" eyebrow="Today at ROUGE" title="Needs you" action={<Btn size="sm" kind="quiet" icon="plus" onClick={() => app.actions("task")}>Task</Btn>}>
          {needs.length ? (
            <ul className="lines">
              {needs.map((t) => <TaskLine key={t.id} t={t} today={today} />)}
            </ul>
          ) : (
            <Empty compact icon="check" title="Clear">No overdue or high-priority tasks.</Empty>
          )}
          {d.deadlines.length ? (
            <>
              <p className="subhead">Next 14 days</p>
              <ul className="dates">
                {d.deadlines.map((x) => (
                  <li key={x.kind + x.id}>
                    <span className="dates__day">{fmtDay(x.date)}</span>
                    <span className="dates__what">{x.title}{x.event_number ? <span className="faint"> · {x.event_number}</span> : null}</span>
                    <Chip tone="soft">{x.kind === "milestone" ? "Milestone" : "Task"}</Chip>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>

        <div className="stack">
          <Card eyebrow="Upcoming event" className="upnext">
            {d.next_event ? (
              <A to={`events/${d.next_event.id}`} className="upnext__link">
                <span className="upnext__num">{d.next_event.number || "—"}</span>
                <span>
                  <strong>{d.next_event.name}</strong>
                  <span className="muted">{d.next_event.date ? `${fmtDay(d.next_event.date)}${d.next_event.days_to_go >= 0 ? ` · in ${plural(d.next_event.days_to_go, "day")}` : ""}` : "Date not set"} · {EVENT_STATUS[d.next_event.status]}</span>
                </span>
                <Icon name="right" size={18} />
              </A>
            ) : (
              <Empty compact icon="events">No upcoming event.</Empty>
            )}
          </Card>
          <Card eyebrow="Reminders">
            {d.reminders.length ? (
              <ul className="dates">
                {d.reminders.map((r, i) => (
                  <li key={i}>
                    <span className={`dates__day${r.overdue ? " danger-text" : ""}`}>{r.date ? relDay(r.date, today) : ""}</span>
                    <span className="dates__what">
                      {r.kind === "followup" ? <A to={`venues/${r.id}`}>{r.text}</A> : r.kind === "event" ? <A to={`events/${r.id}`}>{r.text}</A> : r.text}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty compact icon="clock">No follow-ups or milestones due this week.</Empty>
            )}
          </Card>
        </div>

        <div className="span-all">
          <NextChapter e={d.next_event} milestones={d.next_milestones} today={today} />
        </div>

        <Card className="span-all" eyebrow="Quick actions" pad>
          <div className="quick-grid">
            {QUICK.map(([k, label, icon]) => (
              <button key={k} type="button" className="quick" onClick={() => app.actions(k)}>
                <Icon name={icon} size={22} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="span-all" eyebrow="Business pulse" action={<A to="finance" className="link-sm">Finance <Icon name="right" size={14} /></A>}>
          <Pulse p={d.pulse} last={d.last_event} />
          <p className="fineprint">Every figure comes from what's recorded in HQ. “Provisional” means some entries are still marked to confirm.</p>
        </Card>

        <div className="span-2">
          <Spark ideas={d.ideas} />
        </div>

        <Card eyebrow="Venue enquiries" action={<A to="venues" className="link-sm">Venues <Icon name="right" size={14} /></A>}>
          {d.venues_pending.length ? (
            <ul className="dates">
              {d.venues_pending.map((v) => (
                <li key={v.id}>
                  <span className="dates__what"><A to={`venues/${v.id}`}>{v.name}</A>{v.area ? <span className="faint"> · {v.area}</span> : null}</span>
                  <Status value={v.status} labels={VENUE_STATUS} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty compact icon="venue">No enquiries out. Mark a venue “Enquired” when you contact it.</Empty>
          )}
        </Card>

        <Card eyebrow="Latest ticket sales">
          {d.tickets.length ? (
            <ul className="dates">
              {d.tickets.map((l) => (
                <li key={l.id}>
                  <span className="dates__what">{l.description}{l.event_number ? <span className="faint"> · {l.event_number}</span> : null}</span>
                  <span className="num">{money(l.amount_pence)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty compact icon="ticket">No ticket income recorded yet.</Empty>
          )}
        </Card>

        <Card eyebrow="Marketing" action={<A to="studio/content" className="link-sm">Studio <Icon name="right" size={14} /></A>}>
          {d.marketing.content.length || d.marketing.campaigns.length ? (
            <ul className="dates">
              {d.marketing.campaigns.map((c) => (
                <li key={"c" + c.id}><span className="dates__what">{c.title}</span><Status value={c.status} /></li>
              ))}
              {d.marketing.content.map((c) => (
                <li key={c.id}>
                  <span className="dates__day">{c.publish_date ? fmtDay(c.publish_date) : "—"}</span>
                  <span className="dates__what">{c.title}{c.channel ? <span className="faint"> · {CHANNELS[c.channel]}</span> : null}</span>
                  <Status value={c.status} labels={CONTENT_STATUS} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty compact icon="campaign" action={<Btn size="sm" onClick={() => app.actions("campaign")}>Plan a campaign</Btn>}>No campaigns or posts scheduled.</Empty>
          )}
        </Card>

        <Card eyebrow="Mailing list" action={<A to="audience" className="link-sm">Audience <Icon name="right" size={14} /></A>}>
          {d.audience.available ? (
            <div className="mini-stats">
              <div><strong>{d.audience.last7}</strong><span>new this week</span></div>
              <div><strong>{d.audience.last30}</strong><span>last 30 days</span></div>
              <div><strong>{d.audience.eligible}</strong><span>can be emailed</span></div>
            </div>
          ) : (
            <Empty compact icon="audience">The signup table wasn't found.</Empty>
          )}
        </Card>

        <Card eyebrow="Financial overview">
          {d.finance.entries ? (
            <>
              <div className="mini-stats">
                <div><strong>{money(d.finance.income)}</strong><span>income</span></div>
                <div><strong>{money(d.finance.expense)}</strong><span>costs</span></div>
                <div><strong>{money(d.finance.income - d.finance.expense)}</strong><span>net</span></div>
              </div>
              {d.finance.unconfirmed ? <p className="fineprint"><Icon name="warn" size={13} /> {plural(d.finance.unconfirmed, "entry", "entries")} still to confirm.</p> : null}
            </>
          ) : (
            <Empty compact icon="money">Nothing recorded yet.</Empty>
          )}
        </Card>

        <Card eyebrow="Recent notes" action={<A to="knowledge" className="link-sm">Knowledge <Icon name="right" size={14} /></A>}>
          {d.notes.length ? (
            <ul className="notes-mini">
              {d.notes.map((n) => (
                <li key={n.id}>
                  <A to={`knowledge/${n.id}`}>
                    <strong>{n.title}</strong>
                    <span className="faint small">{timeAgo(n.updated_at)}</span>
                  </A>
                </li>
              ))}
            </ul>
          ) : (
            <Empty compact icon="note">No notes yet.</Empty>
          )}
        </Card>

        <Card eyebrow="Activity">
          {d.activity.length ? (
            <ul className="activity">
              {d.activity.map((a) => (
                <li key={a.id}>
                  <span>{a.summary}</span>
                  <span className="faint small">{timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty compact icon="clock">Nothing yet.</Empty>
          )}
        </Card>
      </div>
    </div>
  )
}
