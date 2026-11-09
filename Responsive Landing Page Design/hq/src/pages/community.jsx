// RADIO → Applications and AUDIENCE → Members.
import { useEffect, useMemo, useState } from "react"
import { useApi, useApp, api, get, post, patch, emitChanged, toast, navigate, fmtDay, fmtFull, timeAgo, parseJson, plural, hostOf, API } from "../lib.js"
import { Card, Icon, Btn, A, Chip, Status, Stat, Empty, Loading, ErrorBox, PageHead, Notice, Sheet, Field, Input, TextArea, Select, Toggle, Segmented, Bar, copyText } from "../ui.jsx"

const APP_LABEL = { new: "New", reviewing: "Reviewing", shortlisted: "Shortlisted", contacted: "Contacted", accepted: "Accepted", declined: "Declined", withdrawn: "Withdrawn", archived: "Archived" }
const APP_TONE = { new: "red", reviewing: "brass", shortlisted: "brass", contacted: "soft", accepted: "ok", declined: "muted", withdrawn: "muted", archived: "muted" }
const AppStatus = ({ value }) => <Chip tone={APP_TONE[value] || "soft"}>{APP_LABEL[value] || value}</Chip>
const RATINGS = [["rating_selection", "Musical selection"], ["rating_originality", "Originality"], ["rating_fit", "Fit with ROUGE"], ["rating_overall", "Overall impression"]]
const REPLIES = { radio_more_info: "Ask for more information", radio_shortlisted: "Shortlisted", radio_accepted: "Acceptance", radio_declined: "Respectful decline" }
const sqlDay = (s) => (s ? String(s).slice(0, 10) : null)

function avgRating(a) {
  const v = RATINGS.map(([k]) => a[k]).filter((x) => x)
  return v.length ? (v.reduce((s, x) => s + x, 0) / v.length).toFixed(1) : null
}

// Safe embedded players for the platforms that offer them. Everything else opens in a new tab.
export function embedFor(url) {
  try {
    const u = new URL(url)
    const h = u.hostname.replace(/^www\./, "")
    if (h === "soundcloud.com" || h.endsWith(".soundcloud.com")) return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%237a1626&visual=false&show_comments=false`, height: 166 }
    if (h === "mixcloud.com" || h.endsWith(".mixcloud.com")) return { src: `https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&feed=${encodeURIComponent(u.pathname)}`, height: 120 }
    if (h === "youtube.com" || h === "m.youtube.com" || h === "youtu.be") {
      const id = h === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v")
      return id && /^[\w-]{6,20}$/.test(id) ? { src: `https://www.youtube-nocookie.com/embed/${id}`, height: 220 } : null
    }
  } catch {}
  return null
}

function MixPlayer({ url, label }) {
  const [show, setShow] = useState(false)
  const embed = embedFor(url)
  return (
    <div className="mix">
      <div className="mix__head">
        <span className="mix__label">{label}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="link-sm">{hostOf(url)} <Icon name="external" size={13} /></a>
      </div>
      {embed ? (
        show ? (
          <iframe className="mix__frame" src={embed.src} height={embed.height} title={`Player: ${hostOf(url)}`} loading="lazy" allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <Btn size="sm" icon="radio" onClick={() => setShow(true)}>Load player</Btn>
        )
      ) : (
        <p className="faint small">No embedded player for this site. Open it in a new tab to listen.</p>
      )}
    </div>
  )
}

// ---------- applications list ----------

export function Applications({ query }) {
  const app = useApp()
  const [status, setStatus] = useState(query.get("status") || "open")
  const [genre, setGenre] = useState("")
  const [tag, setTag] = useState("")
  const [q, setQ] = useState("")
  const [term, setTerm] = useState("")
  const [pick, setPick] = useState([])
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 200)
    return () => clearTimeout(t)
  }, [q])
  const params = new URLSearchParams()
  if (status !== "all") params.set("status", status)
  if (genre) params.set("genre", genre)
  if (tag) params.set("tag", tag)
  if (term) params.set("q", term)
  const { data, error } = useApi(`community/applications?${params}`)
  const counts = (data && data.counts) || {}
  const open = ["new", "reviewing", "shortlisted", "contacted", "accepted"].reduce((s, k) => s + (counts[k] || 0), 0)
  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  const labels = (data && data.labels) || { genres: {} }
  const togglePick = (id) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]))
  return (
    <div className="page">
      <PageHead
        eyebrow="ROUGE Radio"
        title="Applications"
        sub="Guest selector applications from rouge-london.com/radio/apply. For Radio mixes only, not event bookings. Nothing is decided or sent automatically."
        actions={<><a className="btn btn--ghost" href={`${API}community/applications/export?${params}`} download><Icon name="download" size={18} /><span>Export CSV</span></a><a className="btn btn--ghost" href="/radio/apply" target="_blank" rel="noopener"><Icon name="external" size={18} /><span>Public form</span></a></>}
      />
      <div className="chips-scroll">
        {[["open", "Open", open], ...Object.keys(APP_LABEL).map((k) => [k, APP_LABEL[k], counts[k] || 0]), ["all", "All", total]].map(([k, l, n]) => (
          <button key={k} type="button" className={`chip chip--btn${status === k ? " chip--on" : " chip--soft"}`} onClick={() => setStatus(k)}>{l}<span className="chip__n">{n}</span></button>
        ))}
      </div>
      <div className="toolbar">
        <div className="searchbox">
          <Icon name="search" size={16} />
          <input className="input input--bare" placeholder="Search name, location, idea" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search applications" />
        </div>
        <div className="row-gap wrap">
          <Select value={genre} onChange={(v) => setGenre(v || "")} options={labels.genres} placeholder="Any sound" aria-label="Filter by sound" />
          {data && data.tags.length ? <Select value={tag} onChange={(v) => setTag(v || "")} options={data.tags.map((t) => [t.tag, `${t.tag} (${t.n})`])} placeholder="Any tag" aria-label="Filter by tag" /> : null}
        </div>
      </div>
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : data.items.length ? (
        <div className="apps">
          {data.items.map((a) => {
            const genres = parseJson(a.genres, [])
            const tags = parseJson(a.tags, [])
            const avg = avgRating(a)
            return (
              <div key={a.id} className={`appcard${pick.includes(a.id) ? " is-picked" : ""}`}>
                <button type="button" className={`venue-card__pick${pick.includes(a.id) ? " is-on" : ""}`} onClick={() => togglePick(a.id)} aria-pressed={pick.includes(a.id)} aria-label={`Compare ${a.artist_name}`}>
                  <Icon name="check" size={14} />
                </button>
                <A to={`radio/applications/${a.id}`} className="appcard__body">
                  <span className="appcard__top">
                    <strong className="appcard__name">{a.artist_name}</strong>
                    <AppStatus value={a.status} />
                  </span>
                  <span className="muted small">{a.location} · {timeAgo(a.created_at)}{a.session_title ? ` · “${a.session_title}”` : ""}</span>
                  <span className="appcard__genres">{genres.slice(0, 4).map((g) => <Chip key={g} tone="soft">{labels.genres[g] || g}</Chip>)}{genres.length > 4 ? <span className="faint small">+{genres.length - 4}</span> : null}</span>
                  <span className="appcard__foot">
                    <span className="faint small"><Icon name="radio" size={12} /> {hostOf(a.mix_url)}</span>
                    {avg ? <span className="score">{avg}</span> : null}
                    {a.notes ? <span className="faint small"><Icon name="note" size={12} /> {a.notes}</span> : null}
                    {tags.slice(0, 3).map((t) => <span key={t} className="tagpill">#{t}</span>)}
                  </span>
                </A>
              </div>
            )
          })}
        </div>
      ) : (
        <Empty icon="radio" title={total ? "Nothing in this view" : "No applications yet"}>{total ? "Try another status or filter." : "When DJs apply at rouge-london.com/radio/apply, they'll appear here and you'll get an email."}</Empty>
      )}
      {pick.length ? (
        <div className="comparebar">
          <span>{plural(pick.length, "applicant")} selected</span>
          <Btn size="sm" kind="quiet" onClick={() => setPick([])}>Clear</Btn>
          <Btn size="sm" kind="primary" icon="columns" disabled={pick.length < 2} onClick={() => navigate(`radio/applications/compare?ids=${pick.join(",")}`)}>Compare</Btn>
        </div>
      ) : null}
    </div>
  )
}

// ---------- application detail ----------

export function ApplicationDetail({ id }) {
  const app = useApp()
  const { data, error, reload, setData } = useApi(`community/applications/${id}`)
  const [note, setNote] = useState("")
  const [reply, setReply] = useState(null)
  const [tagText, setTagText] = useState("")
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>
  if (!data) return <div className="page"><Loading rows={6} /></div>
  const a = data.application
  const L = data.labels
  const genres = parseJson(a.genres, [])
  const tags = parseJson(a.tags, [])
  const acks = parseJson(a.acknowledgements, {})
  const update = async (body, msg) => {
    try {
      const r = await patch(`community/applications/${a.id}`, body)
      setData(r)
      emitChanged("applications")
      if (msg) toast(msg)
    } catch (e) {
      toast(e.message, "bad")
    }
  }
  const addNote = async () => {
    if (!note.trim()) return
    try {
      setData(await post(`community/applications/${a.id}/note`, { body: note }))
      setNote("")
    } catch (e) {
      toast(e.message, "bad")
    }
  }
  const draft = async (template) => {
    try {
      const d = await post(`community/applications/${a.id}/draft`, { template })
      setReply({ ...d, template, set_status: d.suggested_status })
    } catch (e) {
      toast(e.message, "bad")
    }
  }
  const makeEpisode = async () => {
    try {
      const r = await post(`community/applications/${a.id}/episode`, {})
      emitChanged("radio")
      toast(`Draft episode “${r.episode.title}” created`)
      reload()
    } catch (e) {
      toast(e.message, "bad")
    }
  }
  const field = (label, value) => (value ? <div><dt>{label}</dt><dd>{value}</dd></div> : null)
  const addTag = () => {
    const t = tagText.trim().toLowerCase()
    if (!t) return
    setTagText("")
    update({ tags: [...tags, t] })
  }
  return (
    <div className="page">
      <A to="radio/applications" className="back"><Icon name="left" size={16} />Applications</A>
      <header className="pagehead">
        <div className="pagehead__text">
          <p className="eyebrow">ROUGE Radio application · {a.ref} · {fmtFull(sqlDay(a.created_at))}</p>
          <h1 className="display">{a.artist_name}</h1>
          <p className="pagehead__sub">{[a.full_name && a.full_name !== a.artist_name ? a.full_name : null, a.pronouns, a.location].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="pagehead__actions">
          <div className="select select--inline">
            <select aria-label="Status" value={a.status} onChange={(e) => update({ status: e.target.value }, `Moved to ${APP_LABEL[e.target.value]}`)}>
              {data.statuses.map((s) => <option key={s} value={s}>{APP_LABEL[s]}</option>)}
            </select>
            <Icon name="down" size={14} />
          </div>
          <Btn kind="primary" icon="mail" onClick={() => setReply({ template: "", subject: "", heading: "", body: "" })}>Reply</Btn>
        </div>
      </header>

      <div className="venue-layout">
        <div className="stack">
          <Card eyebrow="Their music">
            <MixPlayer url={a.mix_url} label="Mix 1" />
            {a.mix_url_2 ? <MixPlayer url={a.mix_url_2} label="Mix 2" /> : null}
            {a.mix_why ? <p className="quote-block">{a.mix_why}</p> : null}
            <p className="fineprint">Players load from the platform only when you press play. Nothing is downloaded or copied.</p>
          </Card>
          <Card eyebrow="Session idea" title={a.session_title || null}>
            <p className="prose-p">{a.session_concept}</p>
            {a.session_different ? <><p className="subhead">What would make it different</p><p className="prose-p">{a.session_different}</p></> : null}
            <dl className="facts">
              {field("Mix length", a.mix_length)}
              {field("Plays", a.performance ? L.performance[a.performance] : null)}
              {field("Can record clean", a.can_record ? L.can_record[a.can_record] : null)}
              {field("Technical", a.technical_notes)}
            </dl>
          </Card>
          <Card eyebrow="Their sound">
            <div className="chips-row chips-row--flush">{genres.map((g) => <Chip key={g} tone="soft">{L.genres[g] || g}</Chip>)}{a.genre_other ? <Chip tone="soft">{a.genre_other}</Chip> : null}</div>
            <p className="subhead">Selection style</p>
            <p className="prose-p">{a.selection_style}</p>
          </Card>
          <Card eyebrow="About them">
            <p className="prose-p">{a.bio}</p>
            <dl className="facts">
              {field("Email", <a href={`mailto:${a.email}`}>{a.email}</a>)}
              {field("Location", a.location)}
              {field("Profile", <a href={a.profile_url} target="_blank" rel="noopener noreferrer">{a.profile_url.replace(/^https?:\/\/(www\.)?/, "")} <Icon name="external" size={12} /></a>)}
              {field("Website", a.website ? <a href={a.website} target="_blank" rel="noopener noreferrer">{hostOf(a.website)}</a> : null)}
              {field("Other socials", a.other_socials)}
              {field("Found ROUGE via", a.discovery)}
              {field("Anything else", a.extra)}
            </dl>
          </Card>
          <Card eyebrow="Confirmations">
            <ul className="bullets">
              {(acks.accepted || []).map((k) => <li key={k}>{L.acks[k] || k}</li>)}
              <li>Happy to be contacted about this application{a.contact_ok ? "" : " — NO"}</li>
              <li>{a.marketing_opt_in ? "Also asked to join ROUGE Members (separately confirmed by email)" : "Did not ask to join ROUGE Members"}</li>
            </ul>
            {acks.at ? <p className="fineprint">Confirmed {new Date(acks.at).toLocaleString("en-GB")}</p> : null}
          </Card>
        </div>

        <div className="stack">
          <Card eyebrow="Your review" title={avgRating(a) ? `${avgRating(a)} / 5` : null}>
            <ul className="scores">
              {RATINGS.map(([k, label]) => (
                <li key={k}>
                  <span>{label}</span>
                  <span className="score-pick score-pick--sm" role="radiogroup" aria-label={label}>
                    {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={a[k] === n} className={a[k] >= n ? "is-on" : ""} onClick={() => update({ [k]: a[k] === n ? null : n })}>{n}</button>)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="fineprint">For your own organisation only. Ratings never decide anything automatically.</p>
            <p className="subhead">Tags</p>
            <div className="chips-row chips-row--flush">
              {tags.map((t) => <button key={t} type="button" className="tagpill tagpill--btn" onClick={() => update({ tags: tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`}>#{t} <Icon name="close" size={11} /></button>)}
              <form onSubmit={(e) => { e.preventDefault(); addTag() }} className="tagadd">
                <input className="input input--bare" placeholder="Add tag" value={tagText} onChange={(e) => setTagText(e.target.value)} aria-label="Add a tag" maxLength={30} />
              </form>
            </div>
          </Card>

          <Card eyebrow="Reply">
            <p className="muted small">Pick a starting point, edit it, then send. Every reply is logged below.</p>
            <div className="stack stack--tight">
              {Object.entries(REPLIES).map(([k, l]) => <Btn key={k} size="sm" icon="mail" onClick={() => draft(k)}>{l}</Btn>)}
            </div>
          </Card>

          {a.status === "accepted" || a.radio_episode_id ? (
            <Card eyebrow="Radio planning">
              {data.episode ? (
                <>
                  <p><strong>{data.episode.number ? `${data.episode.number} · ` : ""}{data.episode.title}</strong></p>
                  <p className="muted small">Draft episode, not published or announced.</p>
                  <Btn size="sm" icon="radio" onClick={() => navigate("radio")}>Open Radio</Btn>
                </>
              ) : (
                <>
                  <p className="muted small">Create a draft ROUGE Radio episode with their concept, a guest profile and production tasks (permissions, licensing, artwork, final audio). Nothing is published.</p>
                  <Btn kind="primary" icon="plus" onClick={makeEpisode}>Create draft episode</Btn>
                </>
              )}
            </Card>
          ) : null}

          <Card eyebrow="Private notes">
            <form onSubmit={(e) => { e.preventDefault(); addNote() }} className="form">
              <TextArea value={note} onChange={setNote} rows={2} placeholder="Only you can see these." aria-label="New note" />
              {note.trim() ? <div><Btn size="sm" kind="primary" onClick={addNote}>Add note</Btn></div> : null}
            </form>
          </Card>

          <Card eyebrow="History">
            <ol className="vlog">
              {data.events.map((e) => (
                <li key={e.id}>
                  <div className="vlog__item">
                    <span className="vlog__kind">{e.kind === "status" ? "Status" : e.kind === "email" ? "Email" : e.kind === "note" ? "Note" : "System"}</span>
                    <strong>{e.kind === "status" ? `${APP_LABEL[e.from_status] || e.from_status} → ${APP_LABEL[e.to_status] || e.to_status}` : e.kind === "email" ? e.subject : e.kind === "note" ? "Private note" : e.body}</strong>
                    <span className="faint small">{timeAgo(e.created_at)}</span>
                    {e.body && ["email", "note", "status"].includes(e.kind) ? <span className="vlog__body">{e.body}</span> : null}
                  </div>
                </li>
              ))}
            </ol>
            {data.history.length ? (
              <>
                <p className="subhead">Other applications from this email</p>
                <ul className="notes-mini">{data.history.map((h) => <li key={h.id}><A to={`radio/applications/${h.id}`}><strong>{h.ref}</strong><span className="faint small">{APP_LABEL[h.status]} · {fmtDay(sqlDay(h.created_at))}</span></A></li>)}</ul>
              </>
            ) : null}
          </Card>
        </div>
      </div>
      {reply ? <ReplySheet a={a} reply={reply} onClose={() => setReply(null)} onSent={(r) => { setData(r); setReply(null) }} /> : null}
    </div>
  )
}

function ReplySheet({ a, reply, onClose, onSent }) {
  const [v, setV] = useState({ subject: reply.subject || "", heading: reply.heading || "", body: reply.body || "", set_status: reply.set_status || "" })
  const [busy, setBusy] = useState(false)
  const gaps = /\[[^\]\n]{2,60}\]/.test(v.subject + v.body)
  const send = async () => {
    setBusy(true)
    try {
      const r = await post(`community/applications/${a.id}/send`, v)
      toast(`Sent to ${a.email}`)
      emitChanged("applications")
      onSent(r)
    } catch (e) {
      toast(e.message, "bad")
      setBusy(false)
    }
  }
  return (
    <Sheet open onClose={onClose} eyebrow={`To ${a.artist_name} · ${a.email}`} title={reply.template ? REPLIES[reply.template] : "Reply"} wide footer={<><span /><div className="row-gap"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="send" busy={busy} disabled={gaps || !v.subject.trim() || !v.body.trim()} onClick={send}>Send</Btn></div></>}>
      <div className="form">
        {gaps ? <Notice tone="warn" icon="edit">Fill in the [bracketed] gaps before sending.</Notice> : null}
        <Field label="Subject">{(id) => <Input id={id} value={v.subject} onChange={(x) => setV((s) => ({ ...s, subject: x }))} />}</Field>
        <Field label="Heading (large text at the top)">{(id) => <Input id={id} value={v.heading} onChange={(x) => setV((s) => ({ ...s, heading: x }))} />}</Field>
        <Field label="Message">{(id) => <TextArea id={id} value={v.body} onChange={(x) => setV((s) => ({ ...s, body: x }))} rows={12} />}</Field>
        <Field label="After sending, move to">{(id) => <Select id={id} value={v.set_status} onChange={(x) => setV((s) => ({ ...s, set_status: x || "" }))} options={APP_LABEL} placeholder="Keep current status" />}</Field>
        <p className="fineprint">Sent from ROUGE Radio in the branded layout. Replies come back to the ROUGE inbox.</p>
      </div>
    </Sheet>
  )
}

export function ApplicationCompare({ ids }) {
  const want = ids.split(",").map(Number).filter(Boolean).slice(0, 4)
  const [items, setItems] = useState(null)
  useEffect(() => {
    Promise.all(want.map((i) => get(`community/applications/${i}`))).then((r) => setItems(r)).catch((e) => toast(e.message, "bad"))
  }, [ids])
  if (!items) return <div className="page"><Loading /></div>
  const L = items[0] ? items[0].labels : { genres: {} }
  const rows = [
    ["Location", (a) => a.location],
    ["Status", (a) => APP_LABEL[a.status]],
    ["Sound", (a) => parseJson(a.genres, []).map((g) => L.genres[g] || g).join(", ")],
    ["Selection style", (a) => a.selection_style],
    ["Session idea", (a) => a.session_concept],
    ["Different because", (a) => a.session_different],
    ["Plays", (a) => (a.performance ? L.performance[a.performance] : null)],
    ["Can record", (a) => (a.can_record ? L.can_record[a.can_record] : null)],
    ["Mix", (a) => <a href={a.mix_url} target="_blank" rel="noopener noreferrer">{hostOf(a.mix_url)}</a>],
    ...RATINGS.map(([k, l]) => [l, (a) => a[k]]),
    ["Tags", (a) => parseJson(a.tags, []).map((t) => `#${t}`).join(" ")],
  ]
  return (
    <div className="page">
      <A to="radio/applications" className="back"><Icon name="left" size={16} />Applications</A>
      <PageHead eyebrow="ROUGE Radio" title="Compare" sub="Side by side, from what they wrote. Ratings are yours." />
      <div className="compare-wrap">
        <table className="compare">
          <thead><tr><th />{items.map(({ application: a }) => <th key={a.id}><A to={`radio/applications/${a.id}`}>{a.artist_name}</A></th>)}</tr></thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label}><th scope="row">{label}</th>{items.map(({ application: a }) => <td key={a.id}>{fn(a) || <span className="faint">—</span>}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- members ----------

const M_STATUS = { subscribed: "Subscribed", pending: "Awaiting confirmation", member: "Member, no emails", unsubscribed: "Unsubscribed" }
const M_TONE = { subscribed: "ok", pending: "brass", member: "soft", unsubscribed: "muted" }
const QUICK = [["topic", "events", "ROUGE events"], ["topic", "radio", "ROUGE Radio"], ["interest", "rnb", "R&B"], ["interest", "house", "House"], ["interest", "garage", "UK garage"], ["interest", "amapiano", "Amapiano"]]

export function Members() {
  const [filter, setFilter] = useState({})
  const [q, setQ] = useState("")
  const [term, setTerm] = useState("")
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 200)
    return () => clearTimeout(t)
  }, [q])
  const params = new URLSearchParams(Object.entries(filter).filter(([, v]) => v))
  if (term) params.set("q", term)
  const { data, error } = useApi(`community/members?${params}`)
  const set = (k, v) => setFilter((f) => ({ ...f, [k]: f[k] === v ? "" : v }))
  const mask = (e) => (show ? e : e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "•".repeat(Math.min(6, b.length)) + c))
  if (error) return <div className="page"><ErrorBox error={error} /></div>
  if (!data) return <div className="page"><Loading rows={6} /></div>
  const s = data.summary
  const music = data.labels.music
  const topics = data.labels.topics
  const maxInterest = Math.max(1, ...data.interests.map((x) => x.n))
  return (
    <div className="page">
      <PageHead
        eyebrow="Audience"
        title="Members"
        sub="Everyone who has joined ROUGE: the same list your invitations use. Only details people chose to give are shown."
        actions={<a className="btn btn--ghost" href={`${API}community/members/export?${params}`} download><Icon name="download" size={18} /><span>Export CSV</span></a>}
      />
      <div className="pulse pulse--4">
        <Stat icon="audience" label="Total" value={s.total.toLocaleString("en-GB")} sub={`+${s.last7} this week · +${s.last30} in 30 days`} />
        <Stat icon="check" label="Subscribed" value={s.subscribed.toLocaleString("en-GB")} sub="Consented and can be emailed" onClick={() => set("status", "subscribed")} />
        <Stat icon="clock" label="Awaiting confirmation" value={s.pending} sub="Haven't clicked the email link yet" onClick={() => set("status", "pending")} />
        <Stat icon="close" label="Not emailable" value={s.member + s.unsubscribed} sub={`${s.unsubscribed} unsubscribed · ${s.member} no consent`} onClick={() => set("status", "unsubscribed")} />
      </div>
      <div className="two-col">
        <Card eyebrow="Music they love">
          {data.interests.length ? (
            <ul className="sources-list">
              {data.interests.map((x) => (
                <li key={x.k}><button type="button" className="linkish" onClick={() => set("interest", x.k)}>{music[x.k] || x.k}</button><Bar value={x.n} max={maxInterest} tone="brass" /><span className="num">{x.n}</span></li>
              ))}
            </ul>
          ) : <Empty compact icon="radio">No music preferences shared yet.</Empty>}
          {data.topics.length ? <p className="fineprint">Want to hear about: {data.topics.map((t) => `${topics[t.k] || t.k} ${t.n}`).join(" · ")}</p> : null}
        </Card>
        <Card eyebrow="Where they joined">
          <ul className="sources-list">
            {data.sources.map((x) => (
              <li key={x.source}><button type="button" className="linkish" onClick={() => set("source", x.source)}>{x.source.replace(/^members:/, "")}</button><Bar value={x.n} max={s.total} tone="brass" /><span className="num">{x.n}</span></li>
            ))}
          </ul>
        </Card>
      </div>
      <Card pad>
        <div className="chips-row chips-row--flush">
          <span className="faint small">Interested in:</span>
          {QUICK.map(([k, v, l]) => <button key={v} type="button" className={`chip chip--btn${filter[k] === v ? " chip--on" : " chip--soft"}`} onClick={() => set(k, v)}>{l}</button>)}
        </div>
        <div className="toolbar">
          <div className="searchbox">
            <Icon name="search" size={16} />
            <input className="input input--bare" placeholder="Search name, email, Instagram, area" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
          </div>
          <div className="row-gap wrap">
            <Select value={filter.status || ""} onChange={(v) => setFilter((f) => ({ ...f, status: v || "" }))} options={M_STATUS} placeholder="Any status" aria-label="Status" />
            <Select value={filter.interest || ""} onChange={(v) => setFilter((f) => ({ ...f, interest: v || "" }))} options={music} placeholder="Any music" aria-label="Music" />
            <Btn size="sm" kind="quiet" icon="eye" onClick={() => setShow((x) => !x)}>{show ? "Hide emails" : "Show emails"}</Btn>
          </div>
        </div>
        {Object.values(filter).some(Boolean) || term ? <p className="faint small">{plural(data.matched, "member")} match · <button type="button" className="linkish" onClick={() => { setFilter({}); setQ("") }}>Clear filters</button></p> : null}
        {data.items.length ? (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead><tr><th>Name</th><th>Email</th><th>Area</th><th>Music</th><th>Joined</th><th>Status</th></tr></thead>
              <tbody>
                {data.items.map((m) => (
                  <tr key={m.id} className="is-clickable" onClick={() => navigate(`audience/members/${m.id}`)}>
                    <td><strong>{m.first_name || "—"}</strong>{m.instagram ? <span className="faint small block">{m.instagram}</span> : null}</td>
                    <td className="mono">{mask(m.email)}</td>
                    <td>{m.location || <span className="faint">—</span>}</td>
                    <td className="small">{parseJson(m.interests, []).map((k) => music[k] || k).join(", ") || <span className="faint">—</span>}</td>
                    <td className="small">{fmtDay(sqlDay(m.created_at))}</td>
                    <td><Chip tone={M_TONE[m.status]}>{M_STATUS[m.status]}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty compact icon="audience">No members match.</Empty>}
      </Card>
      <p className="fineprint"><Icon name="lock" size={13} /> Exports contain personal data. Keep them private and delete them when you're done.</p>
    </div>
  )
}

const EVENT_LABEL = {
  privacy_acknowledged: "Read the privacy notice",
  marketing_opt_in_requested: "Asked to receive emails",
  marketing_opt_in_confirmed: "Confirmed email consent",
  email_verified: "Confirmed their email address",
  marketing_opt_out: "Stopped emails",
  preferences_updated: "Updated preferences",
}

export function MemberProfile({ id }) {
  const { data, error, reload } = useApi(`community/members/${id}`)
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState("")
  if (error) return <div className="page"><ErrorBox error={error} /></div>
  if (!data) return <div className="page"><Loading rows={5} /></div>
  const m = data.member
  const music = parseJson(m.interests, [])
  const topics = parseJson(m.topics, [])
  const unsub = async () => {
    try {
      await post(`community/members/${m.id}/unsubscribe`, {})
      toast("Removed from emails")
      reload()
    } catch (e) {
      toast(e.message, "bad")
    }
  }
  const erase = async () => {
    try {
      await api("DELETE", `community/members/${m.id}`)
      toast("Member deleted")
      navigate("audience/members")
    } catch (e) {
      toast(e.message, "bad")
    }
  }
  return (
    <div className="page">
      <A to="audience/members" className="back"><Icon name="left" size={16} />Members</A>
      <PageHead eyebrow={`Member${m.member_uid ? ` · ${m.member_uid}` : ""} · joined ${fmtFull(sqlDay(m.created_at))}`} title={m.first_name || "Member"} sub={m.email} actions={<Chip tone={M_TONE[m.status]}>{M_STATUS[m.status]}</Chip>} />
      <div className="venue-layout">
        <div className="stack">
          <Card eyebrow="What they told us">
            <dl className="facts">
              <div><dt>Instagram</dt><dd>{m.instagram ? <a href={`https://instagram.com/${m.instagram.slice(1)}`} target="_blank" rel="noopener noreferrer">{m.instagram}</a> : <span className="faint">Not given</span>}</dd></div>
              <div><dt>Area</dt><dd>{m.location || <span className="faint">Not given</span>}</dd></div>
              <div><dt>Music</dt><dd>{music.length ? music.join(", ") : <span className="faint">Not given</span>}</dd></div>
              <div><dt>Hear about</dt><dd>{topics.length ? topics.join(", ") : <span className="faint">Not given</span>}</dd></div>
              <div><dt>Joined via</dt><dd>{(m.source || "unknown").replace(/^members:/, "")}</dd></div>
              <div><dt>Email confirmed</dt><dd>{m.verified_at ? fmtFull(sqlDay(m.verified_at)) : m.member_uid ? "Not yet" : <span className="faint">Joined before confirmation was introduced</span>}</dd></div>
            </dl>
            {m.pending ? <p className="fineprint"><Icon name="clock" size={13} /> Has unconfirmed changes waiting for them to click the email link.</p> : null}
          </Card>
          <Card eyebrow="Consent history">
            {data.events.length ? (
              <ol className="vlog">
                {data.events.map((e, i) => (
                  <li key={i}><div className="vlog__item"><span className="vlog__kind">{fmtFull(sqlDay(e.created_at))}</span><strong>{EVENT_LABEL[e.kind] || e.kind}</strong>{e.source ? <span className="faint small">via {e.source}</span> : null}{e.wording ? <span className="vlog__body">“{e.wording}”</span> : null}</div></li>
                ))}
              </ol>
            ) : <Empty compact icon="lock">No recorded consent events. This sign-up came from the original list form, which recorded consent on the sign-up itself.</Empty>}
          </Card>
        </div>
        <div className="stack">
          <Card eyebrow="Emails received">
            {data.deliveries.length ? <ul className="dates">{data.deliveries.map((d, i) => <li key={i}><span className="dates__what">{d.name}</span><Chip tone="soft">{d.status}</Chip></li>)}</ul> : <Empty compact icon="mail">No campaign emails yet.</Empty>}
          </Card>
          {data.applications.length ? (
            <Card eyebrow="Radio applications">
              <ul className="notes-mini">{data.applications.map((a) => <li key={a.id}><A to={`radio/applications/${a.id}`}><strong>{a.artist_name}</strong><span className="faint small">{a.ref} · {APP_LABEL[a.status]}</span></A></li>)}</ul>
            </Card>
          ) : null}
          <Card eyebrow="Actions">
            <div className="stack stack--tight">
              <Btn icon="copy" onClick={async () => toast((await copyText(data.prefs_url)) ? "Preferences link copied — send it only to this member" : "Couldn't copy")}>Copy their preferences link</Btn>
              {m.status === "subscribed" ? <Btn icon="close" onClick={unsub}>Remove from emails</Btn> : null}
              <Btn kind="quiet" icon="trash" className="danger-text" onClick={() => setConfirm(true)}>Delete member</Btn>
            </div>
            <p className="fineprint">Deleting removes their sign-up, profile, consent history and delivery records for good (right to erasure).</p>
          </Card>
        </div>
      </div>
      {confirm ? (
        <Sheet open onClose={() => setConfirm(false)} title="Delete this member?" footer={<><span /><div className="row-gap"><Btn onClick={() => setConfirm(false)}>Cancel</Btn><Btn kind="primary" className="btn--danger" disabled={typed.trim().toUpperCase() !== "DELETE"} onClick={erase}>Delete for good</Btn></div></>}>
          <div className="form">
            <p>This permanently removes {m.first_name || "this member"} ({m.email}) and their history. If they asked never to be contacted again, remove them from emails instead.</p>
            <Field label="Type DELETE to confirm">{(fid) => <Input id={fid} value={typed} onChange={setTyped} />}</Field>
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}

// ---------- settings: templates, notifications, retention ----------

export function CommunitySettings() {
  const { data, error, setData } = useApi("community/templates")
  const [edit, setEdit] = useState(null)
  if (error) return <ErrorBox error={error} />
  if (!data) return <Loading />
  const st = data.settings
  const saveSetting = async (body) => {
    try {
      setData(await post("community/settings", body))
      toast("Saved")
    } catch (e) {
      toast(e.message, "bad")
    }
  }
  const KIND = { transactional: "Automatic", membership: "Automatic", manual: "You send it", marketing: "Marketing draft" }
  return (
    <>
      <Card eyebrow="Email templates">
        <p className="muted small">The emails Members and Radio applicants receive, all in the ROUGE layout. Edit the words; links, unsubscribe and preferences are added for you.</p>
        <ul className="ledger">
          {data.items.map((t) => (
            <li key={t.key}>
              <button type="button" onClick={() => setEdit(t)}>
                <Icon name="mail" size={18} />
                <span className="ledger__text"><strong>{t.name}</strong><span className="faint small">{t.subject}</span></span>
                <Chip tone={t.kind === "marketing" ? "brass" : t.kind === "manual" ? "soft" : "ok"}>{KIND[t.kind]}</Chip>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card eyebrow="Notifications">
        <div className="form">
          <Toggle checked={st.notify_applications === "on"} onChange={(v) => saveSetting({ notify_applications: v ? "on" : "off" })} label="Email me when a Radio application arrives" />
          <div className="field">
            <div className="field__label"><label>Member sign-up digest</label></div>
            <Segmented small options={{ off: "Off", daily: "Daily", weekly: "Weekly" }} value={st.member_digest} onChange={(v) => saveSetting({ member_digest: v })} />
            <p className="field__hint">A summary instead of an email per member. It goes out with the first sign-up after each day or week, so quiet periods send nothing.</p>
          </div>
        </div>
      </Card>
      <Card eyebrow="Data retention">
        <ul className="bullets">
          <li>Sign-ups that never confirm their email: deleted after 30 days.</li>
          <li>Declined, withdrawn or archived Radio applications: deleted 12 months after the decision.</li>
          <li>Anti-spam counters: cleared after two days. Unsubscribes are kept so people are never emailed again.</li>
        </ul>
        <p className="fineprint">Runs automatically once a day when HQ is opened{st.retention_last_run ? ` · last run ${timeAgo(st.retention_last_run.replace("T", " ").slice(0, 19))}` : ""}.</p>
        <Btn size="sm" icon="refresh" onClick={async () => { try { const r = await post("community/retention", {}); toast(`Removed ${r.result.unconfirmed_members_removed} unconfirmed sign-ups, ${r.result.old_applications_removed} old applications`) } catch (e) { toast(e.message, "bad") } }}>Run now</Btn>
      </Card>
      {edit ? <TemplateSheet t={edit} onClose={() => setEdit(null)} onSaved={(d) => { setData(d); setEdit(null) }} /> : null}
    </>
  )
}

function TemplateSheet({ t, onClose, onSaved }) {
  const [v, setV] = useState({ subject: t.subject, heading: t.heading || "", body: t.body, cta_label: t.cta_label || "" })
  const [html, setHtml] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const h = setTimeout(() => post("community/templates/preview", { key: t.key, ...v }).then((r) => setHtml(r.html)).catch(() => {}), 250)
    return () => clearTimeout(h)
  }, [v.subject, v.heading, v.body, v.cta_label])
  const save = async () => {
    setBusy(true)
    try {
      onSaved(await patch(`community/templates/${t.key}`, v))
      toast("Template saved")
    } catch (e) {
      toast(e.message, "bad")
      setBusy(false)
    }
  }
  const reset = async () => {
    if (!window.confirm("Put the original wording back?")) return
    onSaved(await post(`community/templates/${t.key}/reset`, {}))
    toast("Reset to the original")
  }
  return (
    <Sheet open onClose={onClose} eyebrow="Email template" title={t.name} wide footer={<><Btn kind="quiet" icon="refresh" onClick={reset}>Reset</Btn><div className="row-gap"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" busy={busy} onClick={save}>Save</Btn></div></>}>
      <div className="form">
        {t.notes ? <Notice tone="info" icon="mail">{t.notes}</Notice> : null}
        <Field label="Subject">{(id) => <Input id={id} value={v.subject} onChange={(x) => setV((s) => ({ ...s, subject: x }))} />}</Field>
        <Field label="Heading">{(id) => <Input id={id} value={v.heading} onChange={(x) => setV((s) => ({ ...s, heading: x }))} />}</Field>
        <Field label="Message" hint="Use {{first_name}}, {{artist_name}} or {{ref}} where they apply. A blank line starts a new paragraph.">{(id) => <TextArea id={id} value={v.body} onChange={(x) => setV((s) => ({ ...s, body: x }))} rows={10} />}</Field>
        {t.cta_label !== null || ["member_confirm", "member_welcome", "announce_002"].includes(t.key) ? <Field label="Button text">{(id) => <Input id={id} value={v.cta_label} onChange={(x) => setV((s) => ({ ...s, cta_label: x }))} />}</Field> : null}
        <p className="subhead">Preview (sample details)</p>
        {html ? <iframe className="email-preview" title="Email preview" sandbox="" srcDoc={html} /> : <Loading rows={2} />}
      </div>
    </Sheet>
  )
}
