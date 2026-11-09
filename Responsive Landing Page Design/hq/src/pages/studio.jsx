// STUDIO (ideas, campaigns, content), RADIO and AUDIENCE.
import { useState } from "react"
import { useApi, useApp, post, save, emitChanged, toast, navigate, money, fmtDay, fmtFull, timeAgo, plural, IDEA_KIND, IDEA_STATUS, CAMPAIGN_STATUS, CONTENT_STATUS, CHANNELS, FORMATS, RADIO_STATUS } from "../lib.js"
import { Card, Icon, Btn, A, Chip, Status, Stat, Empty, Loading, ErrorBox, PageHead, Tabs, Menu, Notice, Segmented, Bar } from "../ui.jsx"

// ---------- studio ----------
export function Studio({ tab }) {
  const setTab = (t) => navigate(t === "ideas" ? "studio" : `studio/${t}`, { replace: true })
  return (
    <div className="page">
      <PageHead eyebrow="Creative studio" title="Studio" sub="Capture ideas, shape campaigns and plan every post." />
      <Tabs tabs={[["ideas", "Ideas"], ["campaigns", "Campaigns"], ["content", "Content"]]} value={tab} onChange={setTab} />
      <div className="tabpanel">
        {tab === "ideas" ? <Ideas /> : null}
        {tab === "campaigns" ? <Campaigns /> : null}
        {tab === "content" ? <Content /> : null}
      </div>
    </div>
  )
}

function Ideas() {
  const app = useApp()
  const { data, error } = useApi("t/ideas")
  const [title, setTitle] = useState("")
  const [filter, setFilter] = useState("active")
  const items = (data && data.items) || []
  const shown = items.filter((i) => (filter === "active" ? i.status === "spark" || i.status === "developing" : filter === "all" ? true : i.status === filter))
  const capture = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    try {
      await save("ideas", { title: title.trim(), status: "spark" })
      setTitle("")
      toast("Captured")
    } catch (err) {
      toast(err.message, "bad")
    }
  }
  const convert = async (idea, to) => {
    try {
      const r = await post(`convert/idea/${idea.id}`, { to })
      emitChanged("ideas")
      toast(`Turned into a ${to}`)
      if (to === "event") navigate(`events/${r.item.id}`)
      if (to === "note") navigate(`knowledge/${r.item.id}`)
    } catch (err) {
      toast(err.message, "bad")
    }
  }
  return (
    <>
      <form className="capture" onSubmit={capture}>
        <Icon name="bulb" size={20} />
        <input className="input input--bare" placeholder="Capture an idea…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New idea" />
        <Btn kind="primary" size="sm" onClick={capture} disabled={!title.trim()}>Capture</Btn>
      </form>
      <div className="toolbar">
        <Segmented small options={{ active: "Active", converted: "Converted", parked: "Parked", all: "All" }} value={filter} onChange={setFilter} />
        <Btn size="sm" icon="ai" onClick={() => navigate("ai?prompt=" + encodeURIComponent("Give me five fresh ROUGE ideas that build on what's already in my notebook. For each: a name, one line, and why it suits ROUGE."))}>Ideas from AI</Btn>
      </div>
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : shown.length ? (
        <div className="idea-grid">
          {shown.map((i) => (
            <article key={i.id} className={`idea idea--${i.status}`}>
              <button type="button" className="idea__main" onClick={() => app.openRecord("ideas", { item: i })}>
                <span className="idea__top">
                  <Chip tone="soft">{IDEA_KIND[i.kind] || "Other"}</Chip>
                  {i.pinned ? <Icon name="star" size={14} className="brass" /> : null}
                </span>
                <h3 className="idea__title">{i.title}</h3>
                {i.body ? <p className="idea__body">{i.body}</p> : null}
              </button>
              <footer className="idea__foot">
                <span className="faint small">{i.status === "converted" ? `→ ${i.converted_type}` : timeAgo(i.created_at)}</span>
                {i.status !== "converted" ? (
                  <Menu kind="quiet" size="sm" icon="right" label="Turn into" items={[{ label: "An event", icon: "events", onClick: () => convert(i, "event") }, { label: "A task", icon: "check", onClick: () => convert(i, "task") }, { label: "A campaign", icon: "campaign", onClick: () => convert(i, "campaign") }, { label: "A content piece", icon: "photo", onClick: () => convert(i, "content") }, { label: "A Radio episode", icon: "radio", onClick: () => convert(i, "radio") }, { label: "A note", icon: "note", onClick: () => convert(i, "note") }, "-", { label: i.status === "parked" ? "Unpark" : "Park it", icon: "flag", onClick: () => save("ideas", { status: i.status === "parked" ? "spark" : "parked" }, i.id) }]} />
                ) : null}
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <Empty icon="bulb" title="Nothing here">Capture an idea above — half-formed is fine.</Empty>
      )}
    </>
  )
}

function Campaigns() {
  const app = useApp()
  const { data, error } = useApi("t/campaigns")
  const content = useApi("t/content")
  const items = (data && data.items) || []
  const pieces = (content.data && content.data.items) || []
  return (
    <>
      <div className="toolbar">
        <p className="muted small">A campaign groups the posts, emails and drops around one goal.</p>
        <Btn kind="primary" size="sm" icon="plus" onClick={() => app.actions("campaign")}>Campaign</Btn>
      </div>
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : items.length ? (
        <div className="stack">
          {items.map((c) => {
            const mine = pieces.filter((p) => p.campaign_id === c.id)
            const pub = mine.filter((p) => p.status === "published").length
            const ev = app.boot.events.find((e) => e.id === c.event_id)
            return (
              <Card key={c.id} className="campaign">
                <div className="campaign__head">
                  <button type="button" className="campaign__title" onClick={() => app.openRecord("campaigns", { item: c })}>
                    <h3>{c.title}</h3>
                    <span className="muted small">{[ev && ev.name, c.channel, c.start_date ? `${fmtDay(c.start_date)}${c.end_date ? ` → ${fmtDay(c.end_date)}` : ""}` : null, c.budget_pence != null ? `${money(c.budget_pence)} budget` : null].filter(Boolean).join(" · ")}</span>
                  </button>
                  <Status value={c.status} labels={CAMPAIGN_STATUS} />
                </div>
                {c.goal ? <p className="campaign__goal">{c.goal}</p> : null}
                {mine.length ? (
                  <>
                    <Bar value={pub} max={mine.length} label="Published" />
                    <ul className="dates">
                      {mine.map((p) => (
                        <li key={p.id}>
                          <span className="dates__day">{p.publish_date ? fmtDay(p.publish_date) : "—"}</span>
                          <button type="button" className="dates__what linkish" onClick={() => app.openRecord("content", { item: p })}>{p.title}</button>
                          <Status value={p.status} labels={CONTENT_STATUS} />
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <div className="row-gap wrap">
                  <Btn size="sm" icon="plus" onClick={() => app.openRecord("content", { defaults: { campaign_id: c.id, event_id: c.event_id, status: "idea" } })}>Content</Btn>
                  <Btn size="sm" icon="ai" onClick={() => navigate("ai?prompt=" + encodeURIComponent(`Plan the content for the campaign “${c.title}”${ev ? ` for ${ev.name}` : ""}${c.goal ? ` (goal: ${c.goal})` : ""}. Give a dated schedule of posts, stories and emails with a one-line idea and draft caption for each, in the ROUGE voice.`))}>Plan with AI</Btn>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Empty icon="campaign" title="No campaigns yet" action={<Btn kind="primary" icon="plus" onClick={() => app.actions("campaign")}>Plan a campaign</Btn>}>Start with the ROUGE 002 announcement.</Empty>
      )}
    </>
  )
}

const BOARD = ["idea", "drafting", "ready", "scheduled", "published"]
function Content() {
  const app = useApp()
  const { data, error } = useApi("t/content")
  const [view, setView] = useState("board")
  const items = (data && data.items) || []
  const move = async (p, dir) => {
    const i = BOARD.indexOf(p.status)
    const next = BOARD[Math.min(BOARD.length - 1, Math.max(0, i + dir))]
    if (next !== p.status) await save("content", { status: next }, p.id)
  }
  return (
    <>
      <div className="toolbar">
        <Segmented small options={{ board: "Board", list: "By date" }} value={view} onChange={setView} />
        <Btn kind="primary" size="sm" icon="plus" onClick={() => app.openRecord("content", { defaults: { status: "idea", channel: "instagram" } })}>Content</Btn>
      </div>
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : !items.length ? (
        <Empty icon="photo" title="No content planned" action={<Btn icon="plus" onClick={() => app.openRecord("content", { defaults: { status: "idea", channel: "instagram" } })}>Add a post</Btn>}>Posts, reels, emails and posters — each with a date and a status.</Empty>
      ) : view === "board" ? (
        <div className="board">
          {BOARD.map((s) => {
            const col = items.filter((p) => p.status === s)
            return (
              <section key={s} className="board__col">
                <h3 className="board__title">{CONTENT_STATUS[s]}<span>{col.length}</span></h3>
                {col.map((p) => (
                  <div key={p.id} className="board__card">
                    <button type="button" onClick={() => app.openRecord("content", { item: p })}>
                      <strong>{p.title}</strong>
                      <span className="faint small">{[CHANNELS[p.channel], FORMATS[p.format], p.publish_date ? fmtDay(p.publish_date) : null].filter(Boolean).join(" · ")}</span>
                    </button>
                    <span className="board__move">
                      {s !== BOARD[0] ? <Btn size="sm" kind="quiet" icon="left" aria-label="Move back" onClick={() => move(p, -1)} /> : <span />}
                      {s !== BOARD[BOARD.length - 1] ? <Btn size="sm" kind="quiet" icon="right" aria-label="Move on" onClick={() => move(p, 1)} /> : null}
                    </span>
                  </div>
                ))}
              </section>
            )
          })}
        </div>
      ) : (
        <Card pad={false}>
          <ul className="ledger">
            {items.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => app.openRecord("content", { item: p })}>
                  <span className="dates__day">{p.publish_date ? fmtDay(p.publish_date) : "No date"}</span>
                  <span className="ledger__text"><strong>{p.title}</strong><span className="faint small">{[CHANNELS[p.channel], FORMATS[p.format]].filter(Boolean).join(" · ")}</span></span>
                  <Status value={p.status} labels={CONTENT_STATUS} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

// ---------- radio ----------
const RADIO_FLOW = ["idea", "booked", "recorded", "editing", "scheduled", "published"]
export function Radio() {
  const app = useApp()
  const { data, error } = useApi("t/radio")
  const items = (data && data.items) || []
  return (
    <div className="page">
      <PageHead eyebrow="Sound" title="ROUGE Radio" sub="Episodes from idea to release." actions={<><Btn icon="mail" onClick={() => navigate("radio/applications")}>Applications</Btn><Btn kind="primary" icon="plus" onClick={() => app.openRecord("radio", { defaults: { status: "idea", number: String(items.length + 1).padStart(3, "0"), platform: "Mixcloud" } })}>Episode</Btn></>} />
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : items.length ? (
        <div className="stack">
          {items.map((r) => {
            const step = RADIO_FLOW.indexOf(r.status)
            return (
              <Card key={r.id} className="episode">
                <div className="episode__head">
                  <span className="episode__num">{r.number || "—"}</span>
                  <button type="button" className="episode__title" onClick={() => app.openRecord("radio", { item: r })}>
                    <h3>{r.title}</h3>
                    <span className="muted small">{[r.guest ? `with ${r.guest}` : null, r.platform, r.record_date ? `record ${fmtDay(r.record_date)}` : null, r.release_date ? `release ${fmtDay(r.release_date)}` : null].filter(Boolean).join(" · ") || "No dates yet"}</span>
                  </button>
                  {r.link ? <a className="btn btn--ghost btn--sm" href={r.link} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} /><span>Listen</span></a> : null}
                </div>
                <ol className="stepper" aria-label="Progress">
                  {RADIO_FLOW.map((s, i) => (
                    <li key={s} className={i < step ? "is-done" : i === step ? "is-now" : ""}>
                      <button type="button" onClick={() => save("radio", { status: s }, r.id)} aria-label={`Set to ${RADIO_STATUS[s]}`}>
                        <i />
                        <span>{RADIO_STATUS[s]}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                {r.notes ? <p className="muted small">{r.notes}</p> : null}
                {r.tracklist ? <details className="tracklist"><summary>Tracklist ({r.tracklist.split("\n").filter(Boolean).length})</summary><ol>{r.tracklist.split("\n").filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}</ol></details> : null}
              </Card>
            )
          })}
          <Notice tone="info" icon="globe">Episodes marked Published here don't appear on rouge-london.com/radio automatically yet. The public Radio page still reads from the site config.</Notice>
        </div>
      ) : (
        <Empty icon="radio" title="No episodes yet" action={<Btn icon="plus" onClick={() => app.openRecord("radio", { defaults: { status: "idea", number: "001" } })}>Plan episode 001</Btn>}>A monthly edited mix series is the plan.</Empty>
      )}
    </div>
  )
}

// ---------- audience ----------
function WeeklyBars({ weeks }) {
  const [hover, setHover] = useState(null)
  if (!weeks.length) return <Empty compact icon="audience">No signups in the last 12 weeks.</Empty>
  const max = Math.max(...weeks.map((w) => w.n), 1)
  const W = 100 / weeks.length
  return (
    <figure className="chart">
      <div className="chart__plot" role="img" aria-label={`Weekly signups for the last ${weeks.length} weeks, peak ${max}`}>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          {[0.5, 1].map((g) => <line key={g} x1="0" x2="100" y1={40 - g * 36} y2={40 - g * 36} className="chart__grid" />)}
          {weeks.map((w, i) => {
            const h = Math.max(0.6, (w.n / max) * 36)
            return <rect key={w.week} x={i * W + W * 0.18} width={W * 0.64} y={40 - h} height={h} rx="0.8" className={`chart__bar${hover === i ? " is-hover" : ""}`} />
          })}
        </svg>
        <div className="chart__hits">
          {weeks.map((w, i) => (
            <button key={w.week} type="button" style={{ width: `${W}%` }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={`Week of ${fmtDay(w.start)}: ${w.n} signups`} />
          ))}
        </div>
        {hover !== null ? (
          <div className="chart__tip" style={{ left: `${(hover + 0.5) * W}%` }}>
            <strong>{weeks[hover].n}</strong> signups<br /><span className="faint">week of {fmtDay(weeks[hover].start)}</span>
          </div>
        ) : null}
      </div>
      <figcaption className="chart__axis"><span>{fmtDay(weeks[0].start)}</span><span>peak {max}/week</span><span>{fmtDay(weeks[weeks.length - 1].start)}</span></figcaption>
    </figure>
  )
}

export function Audience() {
  const app = useApp()
  const { data, error } = useApi("audience")
  const [show, setShow] = useState(false)
  if (error) return <div className="page"><ErrorBox error={error} /></div>
  if (!data) return <div className="page"><Loading /></div>
  const s = data.summary
  const mask = (e) => (show ? e : e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "•".repeat(Math.min(6, b.length)) + c))
  return (
    <div className="page">
      <PageHead eyebrow="Community" title="Audience" sub="Your mailing list, read live from the signup form. Only people who opted in and haven't unsubscribed can be emailed." actions={<><Btn icon="audience" onClick={() => navigate("audience/members")}>Members</Btn><Btn icon="mail" onClick={() => (window.location.href = "/admin/invites")}>Send invites</Btn><Btn kind="primary" icon="ai" onClick={() => navigate("ai?draft=email")}>Draft email</Btn></>} />
      {!s.available ? (
        <Notice tone="info">The signups table wasn't found in the database, so there's nothing to show yet.</Notice>
      ) : (
        <>
          <div className="pulse pulse--4">
            <Stat icon="audience" label="Can be emailed" value={s.eligible.toLocaleString("en-GB")} sub={`${s.total.toLocaleString("en-GB")} signups in total`} />
            <Stat icon="plus" label="This week" value={s.last7} sub="new signups" />
            <Stat icon="calendar" label="Last 30 days" value={s.last30} sub={`previous 30: ${s.prev30}`} />
            <Stat icon="close" label="Unsubscribed" value={s.unsubscribed} sub="never emailed again" />
          </div>
          <div className="two-col">
            <Card eyebrow="Weekly signups" title="Last 12 weeks">
              <WeeklyBars weeks={data.weekly} />
            </Card>
            <Card eyebrow="Where they came from">
              <ul className="sources-list">
                {data.sources.map((x) => (
                  <li key={x.source}>
                    <span>{x.source}</span>
                    <Bar value={x.n} max={s.total} tone="brass" />
                    <span className="num">{x.n}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <Card eyebrow="Email campaigns" action={<a className="link-sm" href="/admin/invites">Invites dashboard <Icon name="right" size={14} /></a>}>
            {data.campaigns.length ? (
              <table className="table">
                <thead><tr><th>Campaign</th><th>Status</th><th className="num">Sent</th><th className="num">Delivered</th><th className="num">Problems</th></tr></thead>
                <tbody>
                  {data.campaigns.map((c) => (
                    <tr key={c.slug}><td><strong>{c.name}</strong>{c.launched_at ? <span className="faint small block">{fmtFull(c.launched_at.slice(0, 10))}</span> : null}</td><td><Chip tone="soft">{c.status.replace(/_/g, " ")}</Chip></td><td className="num">{c.deliveries}</td><td className="num">{c.delivered || 0}</td><td className="num">{c.problems || 0}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty compact icon="mail">No campaigns sent yet.</Empty>
            )}
          </Card>
          <Card eyebrow="Newest signups" action={<Btn size="sm" kind="quiet" icon="eye" onClick={() => setShow((x) => !x)}>{show ? "Hide emails" : "Show emails"}</Btn>}>
            <table className="table table--compact">
              <thead><tr><th>Name</th><th>Email</th><th>Source</th><th>Joined</th></tr></thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id} className={r.marketing_consent ? "" : "is-muted"}><td>{r.first_name || <span className="faint">—</span>}</td><td className="mono">{mask(r.email)}</td><td>{r.source || "—"}</td><td>{timeAgo(r.created_at)}{r.marketing_consent ? "" : " · no consent"}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
