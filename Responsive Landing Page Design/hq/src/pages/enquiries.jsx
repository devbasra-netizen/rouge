// VENUE ENQUIRIES — review and send, track follow-ups, log replies and compare confirmed quotes.
import { useEffect, useMemo, useState } from "react"
import { useApi, useApp, api, post, patch, emitChanged, toast, navigate, money, fmtDay, relDay, timeAgo, parseJson, plural, hostOf } from "../lib.js"
import { Card, Icon, Btn, A, Chip, Empty, Loading, ErrorBox, PageHead, Tabs, Notice, Sheet, Field, Input, TextArea, MoneyInput, Toggle, Conf } from "../ui.jsx"

const sqlDay = (s) => (s ? String(s).slice(0, 10) : null)

export function Enquiries({ tab }) {
  const app = useApp()
  const cfg = useApi("outreach/config")
  const enq = useApi("t/enquiries?limit=500")
  const ven = useApi("t/venues?limit=500")
  const quotes = useApi("t/quotes?limit=500")
  const [sending, setSending] = useState(false)
  const [replyFor, setReplyFor] = useState(null)
  const [quoteFor, setQuoteFor] = useState(null)
  if (enq.error || ven.error) return <div className="page"><ErrorBox error={enq.error || ven.error} /></div>
  if (!enq.data || !ven.data || !cfg.data) return <div className="page"><Loading rows={6} /></div>
  const venues = Object.fromEntries(ven.data.items.map((v) => [v.id, v]))
  const all = enq.data.items
  const drafts = all.filter((e) => e.status === "draft" || e.status === "failed")
  const sent = all.filter((e) => e.status === "sent")
  const replied = all.filter((e) => (e.status === "replied" || e.status === "closed") && (e.kind === "enquiry" || !all.some((x) => x.id === e.parent_id)))
  const q = (quotes.data && quotes.data.items) || []
  const setTab = (t) => navigate(`enquiries${t === "review" ? "" : `/${t}`}`, { replace: true })
  const selected = drafts.filter((d) => d.include)
  const withEnquiry = new Set(all.map((e) => e.venue_id))
  const noEmail = ven.data.items.filter((v) => v.shortlist_event_id && !v.contact_email && !["rejected", "past"].includes(v.status))
  const emailNoDraft = ven.data.items.filter((v) => v.shortlist_event_id && v.contact_email && !withEnquiry.has(v.id) && !["rejected", "past"].includes(v.status))
  const dueCount = sent.filter((e) => e.follow_up_on && e.follow_up_on <= app.today).length
  return (
    <div className="page">
      <A to="venues" className="back"><Icon name="left" size={16} />Venues</A>
      <PageHead
        eyebrow="ROUGE 002 outreach"
        title="Venue enquiries"
        sub={cfg.data.bcc === cfg.data.reply_to ? <>Sent from <strong>{cfg.data.from}</strong>. Replies (with attachments) and a copy of every email go straight to <strong>{cfg.data.reply_to}</strong>.</> : <>Sent from <strong>{cfg.data.from}</strong>. Replies go straight to <strong>{cfg.data.reply_to}</strong> (attachments included), and a copy of every email goes to {cfg.data.bcc}.</>}
      />
      {!cfg.data.ready ? <Notice tone="warn" icon="lock">Email sending isn't configured: RESEND_API_KEY is missing in Cloudflare.</Notice> : null}
      <Tabs
        tabs={[["review", "Review & send", drafts.length], ["sent", "Awaiting reply", sent.length], ["replies", "Replies", replied.length], ["quotes", "Confirmed quotes", q.length]]}
        value={tab}
        onChange={setTab}
      />
      <div className="tabpanel">
        {tab === "review" ? (
          <>
            {drafts.length ? (
              <>
                <Notice tone="info" icon="eye">Read each message and check each address before sending. Nothing goes out until you press Send and confirm.</Notice>
                <div className="stack">
                  {drafts.map((d) => <DraftCard key={d.id} d={d} v={venues[d.venue_id]} />)}
                </div>
              </>
            ) : (
              <Empty icon="mail" title="No drafts waiting">{sent.length ? "Everything has been sent. Follow-ups and replies are in the other tabs." : "Shortlist venues with an email address, then draft an enquiry."}</Empty>
            )}
            {emailNoDraft.length ? (
              <Card eyebrow="Shortlisted, not contacted yet" className="mt">
                <ul className="ledger">
                  {emailNoDraft.map((v) => (
                    <li key={v.id}>
                      <div className="ledger__row">
                        <Icon name="venue" size={18} />
                        <span className="ledger__text"><strong>{v.name}</strong><span className="faint small">{v.contact_email}</span></span>
                        <Btn size="sm" icon="mail" onClick={async () => { try { await post("enquiries/draft", { venue_id: v.id }); emitChanged("enquiries"); toast("Draft ready to review") } catch (e) { toast(e.message, "bad") } }}>Draft enquiry</Btn>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            {noEmail.length ? (
              <Card eyebrow="Shortlisted, but no verified email" className="mt">
                <p className="muted small">These venues don't publish an email address that could be verified. Use their enquiry form or phone, then log it on the venue page — or add their address to the venue and draft an enquiry here.</p>
                <ul className="ledger">
                  {noEmail.map((v) => (
                    <li key={v.id}>
                      <div className="ledger__row">
                        <Icon name="venue" size={18} />
                        <span className="ledger__text"><strong>{v.name}</strong><span className="faint small">{[v.area, v.contact_phone, v.website ? hostOf(v.website) : null].filter(Boolean).join(" · ") || "No contact details yet"}</span></span>
                        <Btn size="sm" onClick={() => navigate(`venues/${v.id}`)}>Open</Btn>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            {selected.length ? (
              <div className="comparebar sendbar">
                <span>{plural(selected.length, "enquiry", "enquiries")} selected</span>
                <Btn size="sm" kind="primary" icon="send" disabled={!cfg.data.ready} onClick={() => setSending(true)}>Review &amp; send</Btn>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === "sent" ? (
          sent.length ? (
            <Card pad={false}>
              {dueCount ? <div className="card--pad"><Notice tone="warn" icon="clock">{plural(dueCount, "follow-up")} due. Draft one, review it, and send it from Review &amp; send.</Notice></div> : null}
              <ul className="ledger">
                {sent.map((e) => {
                  const v = venues[e.venue_id] || {}
                  const due = e.follow_up_on && e.follow_up_on <= app.today
                  return (
                    <li key={e.id}>
                      <div className="ledger__row enq-row">
                        <Icon name={e.kind === "followup" ? "refresh" : "mail"} size={18} />
                        <span className="ledger__text">
                          <A to={`venues/${e.venue_id}`}><strong>{v.name}</strong></A>
                          <span className="faint small">{e.kind === "followup" ? "Follow-up" : "Enquiry"} sent {fmtDay(sqlDay(e.sent_at))} to {e.to_email}</span>
                          {e.follow_up_on ? <span className={`small ${due ? "danger-text" : "muted"}`}><Icon name="clock" size={12} /> Follow up {relDay(e.follow_up_on, app.today).toLowerCase()}</span> : null}
                        </span>
                        <span className="row-gap wrap enq-actions">
                          <Btn size="sm" kind="primary" onClick={() => setReplyFor(e)}>Log reply</Btn>
                          <Btn size="sm" onClick={async () => { try { await post(`enquiries/${e.id}/followup`, {}); emitChanged("enquiries"); toast("Follow-up drafted — review it before sending"); setTab("review") } catch (err) { toast(err.message, "bad") } }}>Draft follow-up</Btn>
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ) : (
            <Empty icon="clock" title="Nothing waiting">Sent enquiries appear here with their follow-up date (five days after sending).</Empty>
          )
        ) : null}

        {tab === "replies" ? (
          replied.length ? (
            <div className="stack">
              {replied.map((e) => {
                const v = venues[e.venue_id] || {}
                const has = q.filter((x) => x.venue_id === e.venue_id).length
                return (
                  <Card key={e.id}>
                    <div className="campaign__head">
                      <div>
                        <A to={`venues/${e.venue_id}`}><h3 className="card__title">{v.name}</h3></A>
                        <span className="faint small">{e.status === "closed" ? "Declined" : "Replied"} {fmtDay(sqlDay(e.replied_at))}</span>
                      </div>
                      {e.status === "closed" ? <Chip tone="muted">Declined</Chip> : has ? <Chip tone="ok" icon="check">{plural(has, "quote")}</Chip> : <Btn size="sm" kind="primary" icon="plus" onClick={() => setQuoteFor(e)}>Add quote</Btn>}
                    </div>
                    {e.reply_body ? <p className="reply-text">{e.reply_body.length > 600 ? e.reply_body.slice(0, 600) + "…" : e.reply_body}</p> : null}
                    {has && e.status !== "closed" ? <Btn size="sm" onClick={() => setQuoteFor(e)}>Add another quote</Btn> : null}
                  </Card>
                )
              })}
            </div>
          ) : (
            <Empty icon="mail" title="No replies logged yet">Replies land in {cfg.data.reply_to}. When one arrives, press “Log reply” on the Awaiting reply tab and paste it in.</Empty>
          )
        ) : null}

        {tab === "quotes" ? <QuoteTable quotes={q} venues={venues} /> : null}
      </div>

      {sending ? <SendSheet items={selected} venues={venues} cfg={cfg.data} onClose={() => setSending(false)} onDone={() => setTab("sent")} /> : null}
      {replyFor ? <ReplySheet e={replyFor} v={venues[replyFor.venue_id]} onClose={() => setReplyFor(null)} onLogged={(text) => { setReplyFor(null); setQuoteFor({ ...replyFor, reply_body: text }) }} /> : null}
      {quoteFor ? <QuoteSheet e={quoteFor} v={venues[quoteFor.venue_id]} onClose={() => setQuoteFor(null)} /> : null}
    </div>
  )
}

function DraftCard({ d, v }) {
  const [vals, setVals] = useState({ to_email: d.to_email || "", subject: d.subject || "", body: d.body || "" })
  const [busy, setBusy] = useState(false)
  useEffect(() => setVals({ to_email: d.to_email || "", subject: d.subject || "", body: d.body || "" }), [d.id, d.updated_at])
  const dirty = vals.to_email !== (d.to_email || "") || vals.subject !== (d.subject || "") || vals.body !== (d.body || "")
  const facts = parseJson(v && v.facts, {}) || {}
  const ef = facts.contact_email
  const saveIt = async () => {
    setBusy(true)
    try {
      await patch(`t/enquiries/${d.id}`, vals)
      emitChanged("enquiries")
      toast("Draft saved")
    } catch (e) {
      toast(e.message, "bad")
    }
    setBusy(false)
  }
  return (
    <Card className={`draft${d.include ? "" : " draft--off"}`}>
      <div className="draft__head">
        <div>
          <p className="eyebrow">{d.kind === "followup" ? "Follow-up" : "Enquiry"}{v && v.area ? ` · ${v.area}` : ""}</p>
          <h3 className="card__title"><A to={`venues/${d.venue_id}`}>{v ? v.name : "Venue"}</A></h3>
        </div>
        <Toggle checked={d.include} onChange={async (x) => { await patch(`t/enquiries/${d.id}`, { include: x }); emitChanged("enquiries") }} label={d.include ? "Sending" : "Not sending"} />
      </div>
      {d.status === "failed" ? <Notice tone="bad" icon="warn">Last attempt failed: {d.error || "unknown error"}. Fix it and send again.</Notice> : null}
      <div className="form">
        <Field label="To" conf={ef ? <Conf value={ef.c} source={ef.s} /> : null} hint={ef ? ef.s : null}>
          {(id) => <Input id={id} type="email" value={vals.to_email} onChange={(x) => setVals((s) => ({ ...s, to_email: x }))} />}
        </Field>
        <Field label="Subject">{(id) => <Input id={id} value={vals.subject} onChange={(x) => setVals((s) => ({ ...s, subject: x }))} />}</Field>
        <Field label="Message">{(id) => <TextArea id={id} value={vals.body} onChange={(x) => setVals((s) => ({ ...s, body: x }))} rows={12} />}</Field>
      </div>
      {dirty ? (
        <div className="row-gap draft__save">
          <Btn size="sm" kind="primary" busy={busy} onClick={saveIt}>Save changes</Btn>
          <Btn size="sm" kind="quiet" onClick={() => setVals({ to_email: d.to_email || "", subject: d.subject || "", body: d.body || "" })}>Undo</Btn>
        </div>
      ) : null}
    </Card>
  )
}

function SendSheet({ items, venues, cfg, onClose, onDone }) {
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState(null)
  const go = async () => {
    setBusy(true)
    try {
      const r = await post("enquiries/send", { ids: items.map((i) => i.id), confirm: true })
      setResults(r.results)
      emitChanged("enquiries")
      emitChanged("venues")
      toast(`Sent ${plural(r.sent, "email")}`, r.sent === items.length ? "ok" : "bad")
    } catch (e) {
      toast(e.message, "bad")
    }
    setBusy(false)
  }
  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow="Final review"
      title={results ? "Sent" : `Send ${plural(items.length, "enquiry", "enquiries")}?`}
      footer={results ? <><span /><Btn kind="primary" onClick={() => { onClose(); onDone() }}>Done</Btn></> : <><span /><div className="row-gap"><Btn onClick={onClose}>Back</Btn><Btn kind="primary" icon="send" busy={busy} disabled={!ok} onClick={go}>Send now</Btn></div></>}
    >
      {results ? (
        <ul className="ledger">
          {results.map((r) => (
            <li key={r.id}>
              <div className="ledger__row">
                <Icon name={r.ok ? "check" : "warn"} size={18} className={r.ok ? "" : "danger-text"} />
                <span className="ledger__text"><strong>{r.venue || (venues[(items.find((i) => i.id === r.id) || {}).venue_id] || {}).name}</strong><span className={`small ${r.ok ? "faint" : "danger-text"}`}>{r.ok ? "Sent. Logged on the venue with a follow-up in five days." : r.error}</span></span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="form">
          <dl className="facts">
            <div><dt>From</dt><dd>{cfg.from}</dd></div>
            <div><dt>Replies to</dt><dd>{cfg.reply_to}</dd></div>
            <div><dt>Copy to</dt><dd>{cfg.bcc} (BCC)</dd></div>
          </dl>
          <ul className="ledger">
            {items.map((i) => (
              <li key={i.id}>
                <div className="ledger__row">
                  <Icon name="mail" size={18} />
                  <span className="ledger__text"><strong>{(venues[i.venue_id] || {}).name}</strong><span className="small">{i.to_email}</span><span className="faint small">{i.subject}</span></span>
                </div>
              </li>
            ))}
          </ul>
          <Toggle checked={ok} onChange={(x) => setOk(!!x)} label="I've read every message and the addresses are right" />
        </div>
      )}
    </Sheet>
  )
}

function ReplySheet({ e, v, onClose, onLogged }) {
  const app = useApp()
  const [text, setText] = useState("")
  const [date, setDate] = useState(app.today)
  const [declined, setDeclined] = useState(false)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      await post(`enquiries/${e.id}/reply`, { text, date, declined })
      emitChanged("enquiries")
      emitChanged("venues")
      toast(declined ? "Logged: declined" : "Reply logged on the venue")
      if (declined) onClose()
      else onLogged(text)
    } catch (err) {
      toast(err.message, "bad")
      setBusy(false)
    }
  }
  return (
    <Sheet open onClose={onClose} eyebrow={v ? v.name : "Reply"} title="Log their reply" wide footer={<><span /><div className="row-gap"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" busy={busy} disabled={text.trim().length < 2} onClick={go}>{declined ? "Log as declined" : "Log reply, then add quote"}</Btn></div></>}>
      <div className="form">
        <p className="muted small">Open their email in your iCloud inbox, copy the text and paste it here. Save any attachments (quotes, floor plans, contracts) to the venue's Photos &amp; documents.</p>
        <Field label="Their reply">{(id) => <TextArea id={id} value={text} onChange={setText} rows={10} placeholder="Paste the email here" />}</Field>
        <div className="form__grid">
          <Field label="Received on">{(id) => <Input id={id} type="date" value={date} onChange={setDate} />}</Field>
          <div className="field"><div className="field__label"><label>Outcome</label></div><Toggle checked={declined} onChange={(x) => setDeclined(!!x)} label="They declined" /></div>
        </div>
      </div>
    </Sheet>
  )
}

const QFIELDS = [
  ["room", "Room / space", "text"],
  ["available_dates", "Dates offered", "text"],
  ["capacity", "Capacity (standing)", "int"],
  ["hire_fee_pence", "Hire fee", "money"],
  ["hire_note", "What the fee includes", "text"],
  ["bar_min_pence", "Minimum bar spend", "money"],
  ["bar_min_note", "Bar terms", "text"],
  ["deposit_pence", "Deposit", "money"],
  ["security_pence", "Security cost", "money"],
  ["security_note", "Security details", "text"],
  ["dj_equipment", "DJ equipment", "text"],
  ["licence", "Licensing hours", "text"],
  ["ticketing", "Ticketing", "text"],
  ["other_costs", "Other costs", "text"],
]

function QuoteSheet({ e, v, onClose }) {
  const app = useApp()
  const [text, setText] = useState(e.reply_body || "")
  const [vals, setVals] = useState({ received_on: sqlDay(e.replied_at) || app.today })
  const [evidence, setEvidence] = useState({})
  const [apply, setApply] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const read = async () => {
    setReading(true)
    try {
      const r = await post("quotes/extract", { text })
      setVals((s) => ({ ...s, ...r.quote }))
      setEvidence(r.evidence || {})
      toast(Object.keys(r.quote).length ? `Found ${plural(Object.keys(r.quote).length, "term")} — check each one` : "No terms found in that email")
    } catch (err) {
      toast(err.message, "bad")
    }
    setReading(false)
  }
  const go = async () => {
    setBusy(true)
    try {
      await post("quotes/save", { ...vals, venue_id: e.venue_id, enquiry_id: e.id, evidence, apply_to_venue: apply })
      emitChanged("quotes")
      emitChanged("venues")
      toast("Confirmed quote saved")
      onClose()
    } catch (err) {
      toast(err.message, "bad")
      setBusy(false)
    }
  }
  const set = (k) => (x) => setVals((s) => ({ ...s, [k]: x === "" ? null : x }))
  return (
    <Sheet open onClose={onClose} eyebrow={v ? v.name : "Quote"} title="Add a confirmed quote" wide footer={<><span /><div className="row-gap"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" busy={busy} onClick={go}>Save quote</Btn></div></>}>
      <div className="form">
        <p className="muted small">Only enter what the venue actually wrote. Leave anything they didn't state blank.</p>
        <Field label="Their email">{(id) => <TextArea id={id} value={text} onChange={setText} rows={5} />}</Field>
        {app.boot.config.ai ? <div><Btn icon="ai" busy={reading} disabled={text.trim().length < 20} onClick={read}>Read the terms from this email</Btn></div> : null}
        <div className="form__grid">
          <Field label="Received on">{(id) => <Input id={id} type="date" value={vals.received_on} onChange={set("received_on")} />}</Field>
          {QFIELDS.map(([k, label, kind]) => (
            <Field key={k} label={label} hint={evidence[k] ? `“${evidence[k]}”` : null} wide={kind === "text" && ["hire_note", "bar_min_note", "security_note", "other_costs", "available_dates"].includes(k)}>
              {(id) =>
                kind === "money" ? <MoneyInput id={id} value={vals[k] ?? null} onChange={set(k)} /> : kind === "int" ? <Input id={id} type="number" value={vals[k] ?? ""} onChange={(x) => set(k)(x === "" ? null : Number(x))} /> : <Input id={id} value={vals[k] ?? ""} onChange={set(k)} />
              }
            </Field>
          ))}
          <Field label="Notes" wide>{(id) => <TextArea id={id} value={vals.notes || ""} onChange={set("notes")} rows={3} />}</Field>
        </div>
        <Toggle checked={apply} onChange={(x) => setApply(!!x)} label="Update the venue's facts and mark them verified" />
      </div>
    </Sheet>
  )
}

const QROWS = [
  ["received_on", "Received"],
  ["room", "Room"],
  ["available_dates", "Dates offered"],
  ["capacity", "Capacity"],
  ["hire_fee_pence", "Hire fee"],
  ["bar_min_pence", "Minimum bar spend"],
  ["deposit_pence", "Deposit"],
  ["security_pence", "Security"],
  ["dj_equipment", "DJ equipment"],
  ["licence", "Licensing hours"],
  ["ticketing", "Ticketing"],
  ["other_costs", "Other costs"],
  ["total", "Hire + bar minimum + security"],
]

function QuoteTable({ quotes, venues }) {
  const latest = useMemo(() => {
    const m = new Map()
    for (const q of quotes) if (!m.has(q.venue_id) || String(q.received_on) > String(m.get(q.venue_id).received_on)) m.set(q.venue_id, q)
    return [...m.values()]
  }, [quotes])
  if (!latest.length) return <Empty icon="columns" title="No confirmed quotes yet">Quotes appear here only once a venue has put its terms in writing and you've logged the reply. Nothing is estimated.</Empty>
  const total = (q) => (q.hire_fee_pence == null && q.bar_min_pence == null && q.security_pence == null ? null : (q.hire_fee_pence || 0) + (q.bar_min_pence || 0) + (q.security_pence || 0))
  const lowest = (k) => {
    const vals = latest.map((q) => (k === "total" ? total(q) : q[k])).filter((x) => x !== null && x !== undefined)
    return vals.length > 1 ? Math.min(...vals) : null
  }
  const best = { hire_fee_pence: lowest("hire_fee_pence"), bar_min_pence: lowest("bar_min_pence"), deposit_pence: lowest("deposit_pence"), security_pence: lowest("security_pence"), total: lowest("total") }
  const cell = (q, k) => {
    const v = k === "total" ? total(q) : q[k]
    if (v === null || v === undefined || v === "") return null
    if (k.endsWith("_pence") || k === "total") return money(v)
    if (k === "received_on") return fmtDay(v)
    return String(v)
  }
  const note = (q, k) => ({ hire_fee_pence: q.hire_note, bar_min_pence: q.bar_min_note, security_pence: q.security_note })[k]
  return (
    <>
      <div className="compare-wrap">
        <table className="compare">
          <thead>
            <tr><th />{latest.map((q) => <th key={q.id}><A to={`venues/${q.venue_id}`}>{(venues[q.venue_id] || {}).name}</A></th>)}</tr>
          </thead>
          <tbody>
            {QROWS.map(([k, label]) => (
              <tr key={k}>
                <th scope="row">{label}</th>
                {latest.map((q) => {
                  const val = cell(q, k)
                  const isBest = best[k] !== undefined && best[k] !== null && (k === "total" ? total(q) : q[k]) === best[k]
                  return (
                    <td key={q.id} className={isBest ? "is-best" : ""}>
                      {val ? <span>{val}</span> : <span className="faint">Not stated</span>}
                      {note(q, k) ? <span className="fact-note">{note(q, k)}</span> : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fineprint"><Conf value="verified" compact /> Every figure comes from a venue's written reply. Highlighted cells are the lowest stated cost. “Not stated” means the venue didn't say — ask before comparing.</p>
    </>
  )
}
