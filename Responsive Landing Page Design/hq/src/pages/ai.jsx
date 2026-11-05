// AI — ROUGE AI chat (knows the live HQ data) and deep research (web search + reading sources).
import { useEffect, useRef, useState } from "react"
import { useApi, useApp, api, get, post, save, emitChanged, toast, navigate, md, readSSE, blockCollector, citedMarkdown, hostOf, timeAgo, parseJson, plural, fmtDay } from "../lib.js"
import { Card, Icon, Btn, A, Chip, Status, Empty, Loading, ErrorBox, PageHead, Segmented, Notice, Sheet, Select, Toggle, copyText } from "../ui.jsx"

function NotConfigured() {
  return (
    <Notice tone="warn" icon="lock">
      ROUGE AI needs the <code>ANTHROPIC_API_KEY</code> secret. In Cloudflare: Workers &amp; Pages → rouge-london → Settings → Variables and secrets → add it as a <strong>Secret</strong> for Production, then redeploy. Never paste the key into a chat.
    </Notice>
  )
}

const CHAT_PROMPTS = [
  "What needs doing this week?",
  "Compare my shortlisted venues for ROUGE 002",
  "Draft the ROUGE 002 announcement caption",
  "Plan a four-week promo campaign for 002",
  "Five ideas for ROUGE Radio 001",
  "What's still unconfirmed from ROUGE 001's money?",
]

function bulletLines(text) {
  return String(text || "")
    .split("\n")
    .map((l) => /^\s*(?:[-*•]|\d+[.)])\s+(?:\[[ x]\]\s*)?(.+)$/.exec(l))
    .filter(Boolean)
    .map((m) => m[1].replace(/\*\*|__|`/g, "").replace(/\[\^?\d+\]\([^)]*\)/g, "").trim())
    .filter((l) => l.length > 3 && l.length < 300)
}

function TasksFromText({ text, onClose }) {
  const app = useApp()
  const lines = bulletLines(text)
  const [pick, setPick] = useState(() => lines.map(() => true))
  const [eventId, setEventId] = useState("")
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    let n = 0
    for (let i = 0; i < lines.length; i++) {
      if (!pick[i]) continue
      try {
        await post("t/tasks", { title: lines[i].slice(0, 400), event_id: eventId ? Number(eventId) : null, priority: "normal" })
        n++
      } catch {}
    }
    emitChanged("tasks")
    toast(`Added ${plural(n, "task")}`)
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title="Turn into tasks" footer={<><span /><div className="row-gap"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" busy={busy} disabled={!lines.length} onClick={go}>Add {pick.filter(Boolean).length}</Btn></div></>}>
      {lines.length ? (
        <div className="form">
          <div className="field"><div className="field__label"><label htmlFor="tev">For event</label></div><Select id="tev" value={eventId} onChange={(v) => setEventId(v || "")} options={app.boot.events.map((e) => [String(e.id), e.name])} placeholder="No event" /></div>
          <ul className="picklist">
            {lines.map((l, i) => (
              <li key={i}><Toggle checked={pick[i]} onChange={(v) => setPick((p) => p.map((x, j) => (j === i ? !!v : x)))} label={l} /></li>
            ))}
          </ul>
        </div>
      ) : (
        <Empty compact icon="list">No list items in that answer to turn into tasks.</Empty>
      )}
    </Sheet>
  )
}

function Message({ m, onSave, onTasks }) {
  if (m.role === "user") return <div className="msg msg--user"><p>{m.content}</p></div>
  return (
    <div className="msg msg--ai">
      {m.searches && m.searches.length ? (
        <div className="msg__searches">
          {m.searches.map((q, i) => <Chip key={i} tone="soft" icon="search">{q}</Chip>)}
        </div>
      ) : null}
      {m.content ? <div className="prose" dangerouslySetInnerHTML={{ __html: md(m.content) }} /> : m.pending ? <p className="typing"><i /><i /><i /></p> : null}
      {m.error ? <p className="danger-text small">{m.error}</p> : null}
      {m.sources && m.sources.length ? (
        <ol className="msg__sources">
          {m.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.n ? `${s.n}. ` : ""}{s.title || hostOf(s.url)}</a></li>)}
        </ol>
      ) : null}
      {!m.pending && m.content ? (
        <div className="msg__actions">
          <Btn size="sm" kind="quiet" icon="copy" onClick={async () => toast((await copyText(m.content)) ? "Copied" : "Couldn't copy", "ok")}>Copy</Btn>
          <Btn size="sm" kind="quiet" icon="note" onClick={onSave}>Save to Knowledge</Btn>
          {bulletLines(m.content).length ? <Btn size="sm" kind="quiet" icon="check" onClick={onTasks}>Make tasks</Btn> : null}
        </div>
      ) : null}
    </div>
  )
}

export function AiChat({ chatId, query }) {
  const app = useApp()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [web, setWeb] = useState(false)
  const [busy, setBusy] = useState(false)
  const [id, setId] = useState(chatId ? Number(chatId) : null)
  const [history, setHistory] = useState(false)
  const [tasksFrom, setTasksFrom] = useState(null)
  const [focus, setFocus] = useState(() => ({ event: query.get("event"), venue: query.get("venue") }))
  const ctl = useRef(null)
  const endRef = useRef(null)
  const chats = useApi("t/chats?limit=50")
  const focusEvent = focus.event ? app.boot.events.find((e) => String(e.id) === String(focus.event)) : null
  const [focusVenue, setFocusVenue] = useState(null)

  useEffect(() => {
    if (focus.venue) get(`t/venues/${focus.venue}`).then((r) => setFocusVenue(r.item)).catch(() => {})
  }, [focus.venue])

  useEffect(() => {
    setId(chatId ? Number(chatId) : null)
    if (chatId) {
      get(`t/chats/${chatId}`)
        .then((r) => setMessages(parseJson(r.item.messages, [])))
        .catch((e) => toast(e.message, "bad"))
    } else setMessages([])
  }, [chatId])

  useEffect(() => {
    const p = query.get("prompt")
    const draft = query.get("draft")
    if (p) setInput(p)
    else if (draft === "email") setInput("Draft an email to the ROUGE mailing list about ")
    else if (draft === "enquiry") setInput("")
  }, [])
  useEffect(() => {
    if (query.get("draft") === "enquiry" && focusVenue && !input)
      setInput(`Draft a short, warm enquiry email to ${focusVenue.name} asking about hosting ROUGE 002 (110–150 capacity). Mention the ROUGE 001 result, ask for promoter terms in one all-in quote, the bar minimum, capacity, licence, DJ kit and available Saturday dates. Only use facts HQ has; leave placeholders for anything unknown.`)
  }, [focusVenue])

  useEffect(() => {
    endRef.current && endRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, busy])

  const persist = async (msgs) => {
    const clean = msgs.map(({ role, content, sources, searches }) => ({ role, content, ...(sources ? { sources } : {}), ...(searches ? { searches } : {}) }))
    try {
      if (id) await api("PATCH", `t/chats/${id}`, { messages: clean })
      else {
        const r = await api("POST", "t/chats", { title: msgs[0].content.slice(0, 80), messages: clean })
        setId(r.item.id)
        window.history.replaceState(null, "", `/admin/hq/ai/chat/${r.item.id}`)
      }
      emitChanged("chats")
    } catch {}
  }

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput("")
    const next = [...messages, { role: "user", content }]
    const pending = { role: "assistant", content: "", pending: true, searches: [] }
    setMessages([...next, pending])
    setBusy(true)
    const controller = new AbortController()
    ctl.current = controller
    const col = blockCollector()
    const sources = new Map()
    const update = (patch) => setMessages((ms) => [...ms.slice(0, -1), { ...ms[ms.length - 1], ...patch }])
    let final = { ...pending }
    try {
      const res = await api("POST", "ai/chat", { messages: next.map(({ role, content }) => ({ role, content })), web, event_id: focus.event ? Number(focus.event) : null, venue_id: focus.venue ? Number(focus.venue) : null }, { raw: true, signal: controller.signal })
      await readSSE(
        res,
        (ev) => {
          col.handle(ev, {
            onStop: (b) => {
              if (b && b.type === "server_tool_use" && b.input && b.input.query) {
                final.searches = [...(final.searches || []), b.input.query]
                update({ searches: final.searches })
              }
            },
            onStart: (b) => {
              if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const r of b.content) if (r.url && !sources.has(r.url)) sources.set(r.url, { url: r.url, title: r.title })
            },
            onText: () => {
              final.content = citedMarkdown(col.blocks.filter(Boolean), sources)
              update({ content: final.content })
            },
          })
        },
        controller.signal,
      )
      if (col.error) throw new Error(col.error)
      final.content = citedMarkdown(col.blocks.filter(Boolean), sources)
      final.sources = [...sources.values()].filter((s) => s.n).sort((a, b) => a.n - b.n)
      final.pending = false
      const done = [...next, { role: "assistant", content: final.content || "(No answer.)", sources: final.sources.length ? final.sources : undefined, searches: final.searches && final.searches.length ? final.searches : undefined }]
      setMessages(done)
      persist(done)
    } catch (e) {
      if (controller.signal.aborted) {
        const partial = [...next, { role: "assistant", content: (final.content || "") + "\n\n*(Stopped.)*" }]
        setMessages(partial)
        persist(partial)
      } else update({ pending: false, error: e.code === "not_configured" ? "Add the ANTHROPIC_API_KEY secret in Cloudflare to use ROUGE AI." : e.message })
    } finally {
      setBusy(false)
      ctl.current = null
    }
  }

  const saveToKnowledge = async (m, i) => {
    const q = messages[i - 1] ? messages[i - 1].content : "ROUGE AI"
    try {
      const n = await save("notes", { title: q.slice(0, 90), body: m.content, kind: /email/i.test(q) ? "email" : "note", event_id: focus.event ? Number(focus.event) : null, venue_id: focus.venue ? Number(focus.venue) : null, sources: m.sources || null })
      toast("Saved to Knowledge")
      return n
    } catch (e) {
      toast(e.message, "bad")
    }
  }

  const list = (chats.data && chats.data.items) || []
  return (
    <div className="page page--chat">
      <div className="chat-layout">
        <aside className="chat-history">
          <Btn kind="primary" icon="plus" onClick={() => navigate("ai")}>New chat</Btn>
          <A to="ai/research" className="btn btn--ghost"><Icon name="globe" size={18} /><span>Deep research</span></A>
          <p className="subhead">Recent</p>
          <ul>
            {list.map((c) => (
              <li key={c.id}><A to={`ai/chat/${c.id}`} className={String(c.id) === String(id) ? "is-on" : ""}>{c.title}<span className="faint small">{timeAgo(c.updated_at)}</span></A></li>
            ))}
            {!list.length ? <li className="faint small">No conversations yet.</li> : null}
          </ul>
        </aside>
        <section className="chat">
          <header className="chat__head">
            <div>
              <p className="eyebrow">ROUGE AI</p>
              <h1 className="display chat__title">{messages.length ? "Conversation" : "Ask anything about ROUGE"}</h1>
            </div>
            <div className="row-gap">
              <Btn kind="quiet" icon="clock" className="only-mobile" onClick={() => setHistory(true)} aria-label="History" />
              {messages.length ? <Btn kind="quiet" icon="plus" onClick={() => navigate("ai")} aria-label="New chat" /> : null}
            </div>
          </header>
          {!app.boot.config.ai ? <NotConfigured /> : null}
          <div className="chat__thread">
            {!messages.length ? (
              <div className="chat__intro">
                <p className="muted">It reads HQ live — events, tasks, venues (with their confidence marks), money, ideas and the notes you've marked for it — so answers are about your ROUGE, not a generic one. It won't invent prices or figures.</p>
                <div className="prompt-grid">
                  {CHAT_PROMPTS.map((p) => <button key={p} type="button" className="prompt" onClick={() => send(p)}>{p}</button>)}
                </div>
              </div>
            ) : (
              messages.map((m, i) => <Message key={i} m={m} onSave={() => saveToKnowledge(m, i)} onTasks={() => setTasksFrom(m.content)} />)
            )}
            <div ref={endRef} />
          </div>
          <form className="composer" onSubmit={(e) => { e.preventDefault(); send() }}>
            {focusEvent || focusVenue ? (
              <div className="composer__focus">
                <Chip tone="red" icon={focusEvent ? "events" : "venue"}>About {focusEvent ? focusEvent.name : focusVenue.name}</Chip>
                <button type="button" className="x" aria-label="Remove focus" onClick={() => setFocus({ event: null, venue: null })}><Icon name="close" size={14} /></button>
              </div>
            ) : null}
            <textarea
              className="composer__input"
              rows={2}
              value={input}
              placeholder="Ask ROUGE AI…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault()
                  send()
                }
              }}
              aria-label="Message"
            />
            <div className="composer__bar">
              <Toggle checked={web} onChange={(v) => setWeb(!!v)} label="Search the web" />
              {busy ? <Btn kind="ghost" icon="stop" onClick={() => ctl.current && ctl.current.abort()}>Stop</Btn> : <Btn kind="primary" icon="send" onClick={() => send()} disabled={!input.trim()}>Send</Btn>}
            </div>
          </form>
        </section>
      </div>
      {history ? (
        <Sheet open onClose={() => setHistory(false)} title="Conversations">
          <ul className="history-list">
            {list.map((c) => <li key={c.id}><A to={`ai/chat/${c.id}`} onClick={() => setHistory(false)}>{c.title}<span className="faint small">{timeAgo(c.updated_at)}</span></A></li>)}
            {!list.length ? <li className="faint">No conversations yet.</li> : null}
          </ul>
        </Sheet>
      ) : null}
      {tasksFrom ? <TasksFromText text={tasksFrom} onClose={() => setTasksFrom(null)} /> : null}
    </div>
  )
}

// ---------- deep research ----------
const DEPTH = { quick: "Quick scan", standard: "Standard", deep: "Deep dive" }
const DEPTH_HINT = { quick: "Up to 5 searches · about a minute", standard: "Up to 10 searches · 1–3 minutes", deep: "Up to 20 searches · 3–6 minutes" }
const SUGGEST = [
  "Verify Arch 535: legal capacity, booth kit, promoter hire terms and bar minimum",
  "Find London venues for 110–150 people with a rooftop or terrace that allow ticketed club nights",
  "What do comparable London R&B / soul club nights charge for tickets in 2026?",
  "Verify the five venue leads in my Knowledge note and say which are worth contacting",
  "How do small London promoters structure DJ fees, bar deals and settlements?",
]

export function Research({ query }) {
  const app = useApp()
  const [q, setQ] = useState(query.get("q") || "")
  const [depth, setDepth] = useState("standard")
  const [eventId, setEventId] = useState(query.get("event") || "")
  const venueId = query.get("venue") || ""
  const [busy, setBusy] = useState(false)
  const jobs = useApi("t/research?limit=50")
  const start = async () => {
    if (q.trim().length < 8) return toast("Write a fuller question", "bad")
    setBusy(true)
    try {
      const r = await post("research", { question: q.trim(), depth, event_id: eventId ? Number(eventId) : null, venue_id: venueId ? Number(venueId) : null })
      navigate(`ai/research/${r.item.id}?run=1`)
    } catch (e) {
      toast(e.message, "bad")
      setBusy(false)
    }
  }
  const list = (jobs.data && jobs.data.items) || []
  return (
    <div className="page">
      <PageHead eyebrow="ROUGE AI" title="Deep research" sub="Sends Claude out to search the web and read the sources, then writes a cited report into Knowledge." />
      {!app.boot.config.ai ? <NotConfigured /> : null}
      <Card className="research-form">
        <textarea className="input textarea research-form__q" rows={4} value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to know? Be specific: which venues, what dates, what you'll decide with it." aria-label="Research question" />
        <div className="chips-row">
          {SUGGEST.map((s) => <button key={s} type="button" className="chip chip--soft chip--btn" onClick={() => setQ(s)}>{s}</button>)}
        </div>
        <div className="research-form__opts">
          <div>
            <Segmented options={DEPTH} value={depth} onChange={setDepth} />
            <p className="faint small">{DEPTH_HINT[depth]}. Web search is billed by Anthropic at $10 per 1,000 searches, plus normal usage.</p>
          </div>
          <div className="field">
            <div className="field__label"><label htmlFor="rev">Link to event</label></div>
            <Select id="rev" value={eventId} onChange={(v) => setEventId(v || "")} options={app.boot.events.map((e) => [String(e.id), e.name])} placeholder="None" />
          </div>
        </div>
        <div className="row-gap">
          {venueId ? <Chip tone="red" icon="venue">Linked to a venue</Chip> : null}
          <Btn kind="primary" icon="globe" busy={busy} onClick={start} disabled={!app.boot.config.ai}>Start research</Btn>
        </div>
      </Card>
      <Card eyebrow="Past research">
        {jobs.error ? <ErrorBox error={jobs.error} /> : !jobs.data ? <Loading /> : list.length ? (
          <ul className="ledger">
            {list.map((j) => (
              <li key={j.id}>
                <A to={`ai/research/${j.id}`} className="ledger__row">
                  <Icon name="globe" size={18} />
                  <span className="ledger__text"><strong>{j.question}</strong><span className="faint small">{DEPTH[j.depth] || j.depth} · {timeAgo(j.created_at)}{j.searches ? ` · ${plural(j.searches, "search", "searches")}` : ""}</span></span>
                  <Status value={stale(j) ? "failed" : j.status} labels={{ failed: stale(j) ? "Interrupted" : "Failed", done: "Done", running: "Running", queued: "Queued" }} />
                </A>
              </li>
            ))}
          </ul>
        ) : (
          <Empty compact icon="globe">No research yet.</Empty>
        )}
      </Card>
    </div>
  )
}

const stale = (j) => (j.status === "running" || j.status === "queued") && Date.now() - Date.parse(String(j.updated_at).replace(" ", "T") + "Z") > 15 * 60 * 1000

async function runJob(jobId, onProgress, signal) {
  const all = []
  const sources = new Map()
  const queries = []
  const steps = []
  let stop = null
  for (let round = 0; round < 5; round++) {
    const res = await api("POST", `research/${jobId}/run`, round ? { continuation: all } : {}, { raw: true, signal })
    const col = blockCollector()
    await readSSE(
      res,
      (ev) => {
        col.handle(ev, {
          onStart: (b) => {
            if (b.type === "web_search_tool_result") {
              const results = Array.isArray(b.content) ? b.content.filter((r) => r.url) : []
              for (const r of results) if (!sources.has(r.url)) sources.set(r.url, { url: r.url, title: r.title, cited: false })
              const step = [...steps].reverse().find((s) => s.kind === "search" && s.id === b.tool_use_id)
              if (step) step.found = Array.isArray(b.content) ? results.length : 0
              if (step && !Array.isArray(b.content)) step.error = true
            }
            if (b.type === "web_fetch_tool_result") {
              const c = b.content || {}
              const url = c.url
              if (url && !sources.has(url)) sources.set(url, { url, title: (c.content && c.content.title) || hostOf(url), cited: false })
              const step = [...steps].reverse().find((s) => s.kind === "fetch" && s.id === b.tool_use_id)
              if (step) step.done = c.type === "web_fetch_result"
              if (step && c.type !== "web_fetch_result") step.error = true
            }
            onProgress({ steps: [...steps], sources: sources.size })
          },
          onStop: (b) => {
            if (b && b.type === "server_tool_use") {
              if (b.name === "web_search") {
                queries.push(b.input.query)
                steps.push({ kind: "search", id: b.id, text: b.input.query })
              } else if (b.name === "web_fetch") steps.push({ kind: "fetch", id: b.id, text: b.input.url })
              onProgress({ steps: [...steps], sources: sources.size })
            }
          },
          onText: () => {
            const blocks = [...all, ...col.blocks.filter(Boolean)]
            onProgress({ preview: reportOf(blocks, new Map(sources)).text, steps: [...steps], sources: sources.size })
          },
        })
      },
      signal,
    )
    if (col.error) throw new Error(col.error)
    all.push(...col.blocks.filter(Boolean))
    stop = col.stop
    if (stop !== "pause_turn") break
    steps.push({ kind: "pause", text: "Continuing…" })
  }
  const rep = reportOf(all, sources)
  return { report: rep.text + (stop === "max_tokens" ? "\n\n*(The report reached its length limit; ask a narrower follow-up for more.)*" : ""), sources: rep.sources, queries }
}

function reportOf(blocks, sources) {
  let last = -1
  blocks.forEach((b, i) => {
    if (b && b.type !== "text") last = i
  })
  let tail = blocks.slice(last + 1).filter((b) => b && b.type === "text")
  if (!tail.some((b) => b.text.trim())) tail = blocks.filter((b) => b && b.type === "text")
  const text = citedMarkdown(tail, sources).trim()
  const list = [...sources.values()].sort((a, b) => (a.n || 999) - (b.n || 999))
  return { text, sources: list }
}

export function ResearchJob({ id }) {
  const app = useApp()
  const [job, setJob] = useState(null)
  const [err, setErr] = useState(null)
  const [live, setLive] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const ctl = useRef(null)
  const started = useRef(false)
  const preview = useRef("")

  const load = () => get(`t/research/${id}`).then((r) => setJob(r.item)).catch(setErr)
  useEffect(() => {
    load()
    return () => ctl.current && ctl.current.abort()
  }, [id])

  const run = async () => {
    if (started.current) return
    started.current = true
    window.history.replaceState(null, "", `/admin/hq/ai/research/${id}`)
    const controller = new AbortController()
    ctl.current = controller
    setLive({ steps: [], sources: 0, preview: "" })
    const t0 = Date.now()
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000)
    try {
      const out = await runJob(job.id, (p) => {
        if (p.preview) preview.current = p.preview
        setLive((l) => ({ ...l, ...p }))
      }, controller.signal)
      const r = await post(`research/${job.id}/finish`, { status: "done", report: out.report, sources: out.sources, queries: out.queries })
      setJob(r.item)
      emitChanged("notes")
      toast("Research saved to Knowledge")
    } catch (e) {
      const msg = controller.signal.aborted ? "Stopped" : e.code === "not_configured" ? "Add the ANTHROPIC_API_KEY secret in Cloudflare." : e.message
      try {
        const r = await post(`research/${job.id}/finish`, { status: "failed", error: msg, report: preview.current || "" })
        setJob(r.item)
      } catch {}
      if (!controller.signal.aborted) toast(msg, "bad")
    } finally {
      clearInterval(tick)
      setLive(null)
      ctl.current = null
      started.current = false
    }
  }

  useEffect(() => {
    if (job && new URLSearchParams(window.location.search).get("run") === "1" && (job.status === "queued" || job.status === "running")) run()
  }, [job && job.id])

  if (err) return <div className="page"><ErrorBox error={err} /></div>
  if (!job) return <div className="page"><Loading rows={5} /></div>
  const sources = parseJson(job.sources, []) || []
  const queries = parseJson(job.queries, []) || []
  const isStale = stale(job) && !live
  return (
    <div className="page page--research">
      <A to="ai/research" className="back"><Icon name="left" size={16} />Deep research</A>
      <header className="pagehead">
        <div className="pagehead__text">
          <p className="eyebrow">{DEPTH[job.depth] || "Research"} · {fmtDay(job.created_at.slice(0, 10))}</p>
          <h1 className="research-q">{job.question}</h1>
        </div>
        <div className="pagehead__actions">
          {live ? <Btn icon="stop" onClick={() => ctl.current && ctl.current.abort()}>Stop</Btn> : null}
          {!live && (job.status === "failed" || isStale || job.status === "queued") ? <Btn kind="primary" icon="refresh" onClick={run}>Run{job.status === "queued" ? "" : " again"}</Btn> : null}
          {job.note_id ? <Btn kind="primary" icon="note" onClick={() => navigate(`knowledge/${job.note_id}`)}>Open in Knowledge</Btn> : null}
        </div>
      </header>

      {live ? (
        <div className="research-live">
          <Card eyebrow="Working" title={`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`}>
            <p className="muted small">Keep this page open until it finishes. {live.sources ? `${plural(live.sources, "source")} found so far.` : "Starting…"}</p>
            <ol className="steps">
              {live.steps.map((s, i) => (
                <li key={i} className={s.error ? "is-error" : ""}>
                  <Icon name={s.kind === "search" ? "search" : s.kind === "fetch" ? "globe" : "refresh"} size={15} />
                  <span>{s.kind === "search" ? `Searched “${s.text}”` : s.kind === "fetch" ? `Read ${hostOf(s.text)}` : s.text}</span>
                  {s.kind === "search" && s.found !== undefined ? <span className="faint small">{s.error ? "failed" : `${s.found} results`}</span> : null}
                  {s.kind === "fetch" && s.error ? <span className="faint small">couldn't open</span> : null}
                </li>
              ))}
              <li className="is-now"><span className="spinner" /><span>{live.preview ? "Writing the report…" : "Researching…"}</span></li>
            </ol>
          </Card>
          {live.preview ? (
            <Card eyebrow="Draft">
              <div className="prose" dangerouslySetInnerHTML={{ __html: md(live.preview) }} />
            </Card>
          ) : null}
        </div>
      ) : job.status === "done" && job.report ? (
        <div className="research-done">
          <article className="prose prose--report" dangerouslySetInnerHTML={{ __html: md(job.report) }} />
          <aside className="stack">
            <Card eyebrow={`Sources · ${sources.length}`}>
              <ol className="sources">
                {sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">{s.n ? <span className="cite-n">{s.n}</span> : null}{s.title || hostOf(s.url)}</a>
                    <span className="faint small">{hostOf(s.url)}{s.cited ? "" : " · consulted"}</span>
                  </li>
                ))}
              </ol>
            </Card>
            {queries.length ? (
              <Card eyebrow={`Searches · ${queries.length}`}>
                <ul className="queries">{queries.map((q, i) => <li key={i}><Icon name="search" size={13} />{q}</li>)}</ul>
              </Card>
            ) : null}
            <Btn icon="ai" onClick={() => navigate("ai?prompt=" + encodeURIComponent(`Based on my research note “${(job.report.match(/^#\s+(.+)$/m) || [])[1] || job.question}”, what should I do next?`))}>Discuss with ROUGE AI</Btn>
          </aside>
        </div>
      ) : (
        <Card>
          {job.status === "failed" ? <Notice tone="bad" icon="warn">{job.error || "This research didn't finish."}</Notice> : isStale ? <Notice tone="warn" icon="warn">This research was interrupted (the page was closed before it finished).</Notice> : <Notice tone="info" icon="clock">Ready to run.</Notice>}
          {job.report ? <div className="prose" dangerouslySetInnerHTML={{ __html: md(job.report) }} /> : null}
        </Card>
      )}
    </div>
  )
}
