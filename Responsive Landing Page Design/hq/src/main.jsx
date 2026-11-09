// ROUGE HQ — the private operating system behind ROUGE. Served at /admin/hq behind the admin sign-in.
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { createRoot } from "react-dom/client"
import { AppCtx, useRoute, navigate, linkProps, get, api, bus, toast, pref, setPref, emitChanged, useApp, QUICK } from "./lib.js"
import { Icon, Btn, Sheet, Field, Input, Select, Loading, ErrorBox, Notice, ThemeSwitch } from "./ui.jsx"
import { RecordSheet } from "./forms.jsx"
import Home from "./pages/home.jsx"
import { EventsList, EventWorkspace } from "./pages/events.jsx"
import { Venues, VenueDetail, VenueCompare } from "./pages/venues.jsx"
import { CalendarPage, People } from "./pages/calendar.jsx"
import { Studio, Radio, Audience } from "./pages/studio.jsx"
import Finance from "./pages/finance.jsx"
import { Knowledge, NotePage, Docs } from "./pages/knowledge.jsx"
import { AiChat, Research, ResearchJob } from "./pages/ai.jsx"
import Settings from "./pages/settings.jsx"
import { Enquiries } from "./pages/enquiries.jsx"
import { Applications, ApplicationDetail, ApplicationCompare, Members, MemberProfile } from "./pages/community.jsx"

const NAV = [
  { key: "home", label: "Home", icon: "home", to: "" },
  { key: "events", label: "Events", icon: "events", to: "events", children: [["Events", "events"], ["Venues", "venues"], ["Enquiries", "enquiries"], ["Calendar", "calendar"], ["People", "people"]] },
  { key: "studio", label: "Studio", icon: "studio", to: "studio", children: [["Ideas", "studio"], ["Campaigns", "studio/campaigns"], ["Content", "studio/content"]] },
  { key: "audience", label: "Audience", icon: "audience", to: "audience", children: [["Overview", "audience"], ["Members", "audience/members"]] },
  { key: "radio", label: "Radio", icon: "radio", to: "radio", children: [["Episodes", "radio"], ["Applications", "radio/applications"]] },
  { key: "finance", label: "Finance", icon: "finance", to: "finance" },
  { key: "knowledge", label: "Knowledge", icon: "knowledge", to: "knowledge", children: [["Notes", "knowledge"], ["Documents", "knowledge/docs"]] },
  { key: "ai", label: "AI", icon: "ai", to: "ai", children: [["Chat", "ai"], ["Deep research", "ai/research"]] },
  { key: "settings", label: "Settings", icon: "settings", to: "settings" },
]
const SECTION_OF = { venues: "events", calendar: "events", people: "events", enquiries: "events" }
const TABBAR = ["home", "events", "studio", "ai"]


function useTheme() {
  const [theme, setTheme] = useState(() => pref("theme", "system"))
  useEffect(() => {
    const root = document.documentElement
    if (theme === "system") root.removeAttribute("data-theme")
    else root.setAttribute("data-theme", theme)
    setPref("theme", theme)
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute("content", dark ? "#0c0809" : "#f4ede2")
  }, [theme])
  return [theme, setTheme]
}

function Toasts() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const on = (e) => {
      const id = Math.random()
      setItems((s) => [...s.slice(-2), { id, ...e.detail }])
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 2600)
    }
    bus.addEventListener("toast", on)
    return () => bus.removeEventListener("toast", on)
  }, [])
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          <Icon name={t.tone === "bad" ? "warn" : "check"} size={16} />
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ---------- command search ----------
function Command({ open, onClose, actions }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState([])
  const [sel, setSel] = useState(0)
  const app = useApp()
  const inputRef = useRef(null)
  useEffect(() => {
    if (open) {
      setQ("")
      setResults([])
      setSel(0)
      setTimeout(() => inputRef.current && inputRef.current.focus(), 30)
    }
  }, [open])
  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setResults([])
      return
    }
    const ctl = new AbortController()
    const t = setTimeout(() => {
      get(`search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal })
        .then((r) => setResults(r.results || []))
        .catch(() => {})
    }, 160)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [q, open])

  const commands = useMemo(() => {
    const list = [
      ...NAV.map((n) => ({ id: "nav-" + n.key, label: `Go to ${n.label}`, icon: n.icon, run: () => navigate(n.to || "/admin/hq") })),
      { id: "nav-venues", label: "Go to Venues", icon: "venue", run: () => navigate("venues") },
      { id: "nav-cal", label: "Open the calendar", icon: "calendar", run: () => navigate("calendar") },
      { id: "nav-enq", label: "Venue enquiries", icon: "mail", run: () => navigate("enquiries") },
      { id: "nav-research", label: "Start deep research", icon: "globe", run: () => navigate("ai/research") },
      ...app.boot.events.map((e) => ({ id: "ev-" + e.id, label: `Open ${e.name}`, icon: "events", run: () => navigate(`events/${e.id}`) })),
      ...QUICK.map(([k, label, icon]) => ({ id: "q-" + k, label, icon, run: () => actions(k) })),
    ]
    const s = q.trim().toLowerCase()
    return s ? list.filter((c) => c.label.toLowerCase().includes(s)) : list.slice(0, 12)
  }, [q, app.boot.events])

  const TYPE_LABEL = { events: "Event", tasks: "Task", venues: "Venue", ideas: "Idea", notes: "Note", people: "Person", campaigns: "Campaign", content: "Content", radio: "Radio", docs: "Document", research: "Research", ledger: "Money" }
  const TYPE_ICON = { events: "events", tasks: "check", venues: "venue", ideas: "bulb", notes: "note", people: "people", campaigns: "campaign", content: "photo", radio: "radio", docs: "file", research: "globe", ledger: "money" }
  const openResult = (r) => {
    if (r.type === "events") navigate(`events/${r.id}`)
    else if (r.type === "venues") navigate(`venues/${r.id}`)
    else if (r.type === "notes") navigate(`knowledge/${r.id}`)
    else if (r.type === "research") navigate(`ai/research/${r.id}`)
    else if (r.type === "tasks" && r.event_id) navigate(`events/${r.event_id}/checklist`)
    else if (r.type === "ledger") navigate("finance")
    else if (r.type === "people") navigate("people")
    else if (r.type === "radio") navigate("radio")
    else if (r.type === "docs") navigate("knowledge/docs")
    else if (r.type === "campaigns") navigate("studio/campaigns")
    else if (r.type === "content") navigate("studio/content")
    else if (r.type === "ideas") navigate("studio")
    else app.openRecord(r.type, { id: r.id })
  }
  const all = [...results.map((r) => ({ id: r.type + r.id, label: r.title, sub: `${TYPE_LABEL[r.type] || r.type}${r.sub ? ` · ${String(r.sub).replace(/_/g, " ")}` : ""}`, icon: TYPE_ICON[r.type], run: () => openResult(r) })), ...commands]
  const pick = (c) => {
    onClose()
    c.run()
  }
  if (!open) return null
  return (
    <div className="cmd-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmd" role="dialog" aria-modal="true" aria-label="Search ROUGE HQ">
        <div className="cmd__input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={q}
            placeholder="Search events, venues, notes… or type a command"
            onChange={(e) => {
              setQ(e.target.value)
              setSel(0)
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(s + 1, all.length - 1)))
              if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)))
              if (e.key === "Enter" && all[sel]) pick(all[sel])
              if (e.key === "Escape") onClose()
            }}
            aria-label="Search"
          />
          <kbd>esc</kbd>
        </div>
        <ul className="cmd__list">
          {all.map((c, i) => (
            <li key={c.id}>
              <button type="button" className={i === sel ? "is-sel" : ""} onMouseEnter={() => setSel(i)} onClick={() => pick(c)}>
                <Icon name={c.icon || "right"} size={16} />
                <span className="cmd__label">{c.label}</span>
                {c.sub ? <span className="cmd__sub">{c.sub}</span> : null}
              </button>
            </li>
          ))}
          {!all.length ? <li className="cmd__empty">Nothing matches “{q}”.</li> : null}
        </ul>
      </div>
    </div>
  )
}

// ---------- quick capture ----------
function CaptureSheet({ onClose }) {
  const app = useApp()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  async function go() {
    if (!title.trim()) return
    setBusy(true)
    try {
      await api("POST", "t/ideas", { title: title.trim(), body: body.trim() || null, status: "spark" })
      emitChanged("ideas")
      toast("Idea captured")
      onClose()
    } catch (e) {
      toast(e.message, "bad")
      setBusy(false)
    }
  }
  return (
    <Sheet open onClose={onClose} eyebrow="Creative spark" title="Capture an idea" footer={<><span /><div className="row-gap"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={go} busy={busy}>Capture</Btn></div></>}>
      <div className="form">
        <Field label="The idea">{(id) => <Input id={id} value={title} onChange={setTitle} placeholder="A red-lit listening hour before doors…" onKeyDown={(e) => e.key === "Enter" && go()} />}</Field>
        <Field label="More (optional)">{(id) => <textarea id={id} className="input textarea" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
        <p className="muted small">Ideas land in Studio. From there you can turn one into an event, task, campaign or Radio episode.</p>
      </div>
    </Sheet>
  )
}

function UploadSheet({ defaults = {}, onClose }) {
  const app = useApp()
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState(defaults.kind || "")
  const [eventId, setEventId] = useState(defaults.event_id ? String(defaults.event_id) : "")
  const [busy, setBusy] = useState(false)
  const [linkMode, setLinkMode] = useState(!app.boot.config.files)
  if (linkMode) {
    return (
      <>
        {!app.boot.config.files ? null : null}
        <RecordSheet type="docs" defaults={{ kind: defaults.kind || "other", event_id: defaults.event_id || null, venue_id: defaults.venue_id || null, ...defaults }} onClose={onClose} title={app.boot.config.files ? "Save a link" : "Save a document link"} />
      </>
    )
  }
  async function go() {
    if (!file) return
    setBusy(true)
    const q = new URLSearchParams({ name: file.name, title: title || file.name })
    if (kind) q.set("kind", kind)
    if (eventId) q.set("event_id", eventId)
    if (defaults.venue_id) q.set("venue_id", defaults.venue_id)
    if (defaults.ledger_id) q.set("ledger_id", defaults.ledger_id)
    try {
      await api("POST", `files?${q}`, file)
      emitChanged("docs")
      toast("Uploaded")
      onClose()
    } catch (e) {
      toast(e.message, "bad")
      setBusy(false)
    }
  }
  return (
    <Sheet open onClose={onClose} eyebrow="Documents" title="Upload a file" footer={<><Btn kind="quiet" icon="link" onClick={() => setLinkMode(true)}>Save a link instead</Btn><div className="row-gap"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={go} busy={busy} disabled={!file}>Upload</Btn></div></>}>
      <div className="form">
        <label className="dropzone">
          <Icon name="upload" size={22} />
          <span>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "Choose a photo, PDF or document (up to 25 MB)"}</span>
          <input type="file" onChange={(e) => { const f = e.target.files[0]; setFile(f || null); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "")) }} />
        </label>
        <Field label="Title">{(id) => <Input id={id} value={title} onChange={setTitle} />}</Field>
        <div className="form__grid">
          <Field label="Kind">{(id) => <Select id={id} value={kind} onChange={(v) => setKind(v || "")} options={{ contract: "Contract", invoice: "Invoice", receipt: "Receipt", quote: "Quote", photo: "Photo", rider: "Rider", artwork: "Artwork", email: "Email", other: "Other" }} placeholder="Auto" />}</Field>
          <Field label="Event">{(id) => <Select id={id} value={eventId} onChange={(v) => setEventId(v || "")} options={app.boot.events.map((e) => [String(e.id), e.name])} placeholder="None" />}</Field>
        </div>
      </div>
    </Sheet>
  )
}

function MoreSheet({ onClose, theme, setTheme }) {
  return (
    <Sheet open onClose={onClose} title="ROUGE HQ">
      <nav className="more-grid">
        {NAV.filter((n) => !TABBAR.includes(n.key)).map((n) => (
          <a key={n.key} {...linkProps(n.to)} onClick={(e) => { e.preventDefault(); onClose(); navigate(n.to) }}>
            <Icon name={n.icon} size={22} />
            {n.label}
          </a>
        ))}
        <a {...linkProps("venues")} onClick={(e) => { e.preventDefault(); onClose(); navigate("venues") }}><Icon name="venue" size={22} />Venues</a>
        <a {...linkProps("calendar")} onClick={(e) => { e.preventDefault(); onClose(); navigate("calendar") }}><Icon name="calendar" size={22} />Calendar</a>
        <a {...linkProps("enquiries")} onClick={(e) => { e.preventDefault(); onClose(); navigate("enquiries") }}><Icon name="mail" size={22} />Enquiries</a>
      </nav>
      <div className="more-foot">
        <ThemeSwitch theme={theme} setTheme={setTheme} />
        <a className="btn btn--ghost" href="/admin/invites"><Icon name="mail" size={18} /><span>Invites</span></a>
        <a className="btn btn--ghost" href="/admin/logout"><Icon name="signout" size={18} /><span>Sign out</span></a>
      </div>
    </Sheet>
  )
}

// ---------- shell ----------
function Shell({ boot, reloadBoot }) {
  const route = useRoute()
  const [theme, setTheme] = useTheme()
  const [cmd, setCmd] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [more, setMore] = useState(false)
  const section = SECTION_OF[route.parts[0]] || route.parts[0] || "home"

  const openRecord = useCallback((type, opts = {}) => setSheet({ kind: "record", type, ...opts }), [])
  const actions = useCallback(
    (k, extra = {}) => {
      if (k === "event") openRecord("events", { defaults: { status: "idea" }, onSaved: (e) => navigate(`events/${e.id}`) })
      else if (k === "idea") setSheet({ kind: "capture" })
      else if (k === "expense") openRecord("ledger", { defaults: { kind: "expense", status: "actual", confidence: "verified", ...extra } })
      else if (k === "task") openRecord("tasks", { defaults: { priority: "normal", status: "todo", ...extra } })
      else if (k === "email") navigate("ai?draft=email")
      else if (k === "upload") setSheet({ kind: "upload", defaults: extra })
      else if (k === "campaign") openRecord("campaigns", { defaults: { status: "planning", ...extra } })
      else if (k === "venue") openRecord("venues", { defaults: { status: "prospect" }, onSaved: (v) => navigate(`venues/${v.id}`) })
      else if (k === "ai") navigate("ai")
    },
    [openRecord],
  )

  useEffect(() => {
    const on = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setCmd((o) => !o)
      } else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.body.classList.contains("has-sheet")) {
        e.preventDefault()
        setCmd(true)
      }
    }
    document.addEventListener("keydown", on)
    return () => document.removeEventListener("keydown", on)
  }, [])

  useEffect(() => {
    const on = (e) => {
      if (["events", "people", "templates"].includes(e.detail.type)) reloadBoot()
    }
    bus.addEventListener("changed", on)
    return () => bus.removeEventListener("changed", on)
  }, [reloadBoot])

  const ctx = useMemo(() => ({ boot, today: boot.today, openRecord, actions, theme, setTheme, openUpload: (d) => setSheet({ kind: "upload", defaults: d }) }), [boot, openRecord, actions, theme])

  const [p0, p1, p2] = route.parts
  let page
  if (!p0) page = <Home />
  else if (p0 === "events" && !p1) page = <EventsList />
  else if (p0 === "events") page = <EventWorkspace id={p1} tab={p2 || "overview"} />
  else if (p0 === "venues" && p1 === "compare") page = <VenueCompare ids={route.query.get("ids") || ""} />
  else if (p0 === "venues" && p1) page = <VenueDetail id={p1} />
  else if (p0 === "venues") page = <Venues view={route.query.get("view") || "all"} />
  else if (p0 === "enquiries") page = <Enquiries tab={p1 || "review"} />
  else if (p0 === "calendar") page = <CalendarPage />
  else if (p0 === "people") page = <People />
  else if (p0 === "studio") page = <Studio tab={p1 || "ideas"} />
  else if (p0 === "audience" && p1 === "members" && p2) page = <MemberProfile id={p2} />
  else if (p0 === "audience" && p1 === "members") page = <Members />
  else if (p0 === "audience") page = <Audience />
  else if (p0 === "radio" && p1 === "applications" && p2 === "compare") page = <ApplicationCompare ids={route.query.get("ids") || ""} />
  else if (p0 === "radio" && p1 === "applications" && p2) page = <ApplicationDetail id={p2} />
  else if (p0 === "radio" && p1 === "applications") page = <Applications query={route.query} />
  else if (p0 === "radio") page = <Radio />
  else if (p0 === "finance") page = <Finance />
  else if (p0 === "knowledge" && p1 === "docs") page = <Docs />
  else if (p0 === "knowledge" && p1) page = <NotePage id={p1} />
  else if (p0 === "knowledge") page = <Knowledge kind={route.query.get("kind") || "all"} />
  else if (p0 === "ai" && p1 === "research" && p2) page = <ResearchJob id={p2} />
  else if (p0 === "ai" && p1 === "research") page = <Research query={route.query} />
  else if (p0 === "ai") page = <AiChat chatId={p1 === "chat" ? p2 : null} query={route.query} />
  else if (p0 === "settings") page = <Settings />
  else page = <div className="page"><Notice tone="info">That page doesn't exist. <a {...linkProps("")}>Go home</a></Notice></div>

  const subActive = (to) => {
    const here = route.parts.join("/")
    return here === to || (!["studio", "knowledge", "ai", "events", "radio", "audience"].includes(to) && here.startsWith(to + "/")) || (to === "events" && route.parts[0] === "events")
  }

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <aside className="side">
          <a className="brand" {...linkProps("")}>
            <span className="brand__word">ROUGE</span>
            <span className="brand__hq">HQ</span>
          </a>
          <p className="brand__tag">The world behind ROUGE.</p>
          <button type="button" className="side__search" onClick={() => setCmd(true)}>
            <Icon name="search" size={16} />
            <span>Search or jump to…</span>
            <kbd>⌘K</kbd>
          </button>
          <nav className="side__nav" aria-label="Sections">
            {NAV.map((n) => (
              <div key={n.key} className={`navgroup${section === n.key ? " is-open" : ""}`}>
                <a className={`navlink${section === n.key ? " is-on" : ""}`} {...linkProps(n.to)} aria-current={section === n.key ? "page" : undefined}>
                  <Icon name={n.icon} size={18} />
                  <span>{n.label}</span>
                </a>
                {n.children && section === n.key ? (
                  <div className="navsub">
                    {n.children.map(([label, to]) => (
                      <a key={to} className={subActive(to) ? "is-on" : ""} {...linkProps(to)}>
                        {label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
          <div className="side__foot">
            <ThemeSwitch theme={theme} setTheme={setTheme} />
            <div className="side__links">
              <a href="/" target="_blank" rel="noopener">Public site</a>
              <a href="/admin/invites">Invites</a>
              <a href="/admin/logout">Sign out</a>
            </div>
          </div>
        </aside>

        <header className="topbar">
          <a className="brand brand--sm" {...linkProps("")}>
            <span className="brand__word">ROUGE</span>
            <span className="brand__hq">HQ</span>
          </a>
          <div className="topbar__actions">
            <Btn icon="search" kind="quiet" aria-label="Search" onClick={() => setCmd(true)} />
            <Btn icon="plus" kind="primary" aria-label="Quick add" onClick={() => setSheet({ kind: "quick" })} />
          </div>
        </header>

        <main className="main" id="main">
          {page}
        </main>

        <nav className="tabbar" aria-label="Sections">
          {NAV.filter((n) => TABBAR.includes(n.key)).map((n) => (
            <a key={n.key} className={section === n.key ? "is-on" : ""} {...linkProps(n.to)}>
              <Icon name={n.icon} size={22} />
              <span>{n.label}</span>
            </a>
          ))}
          <button type="button" className={!TABBAR.includes(section) ? "is-on" : ""} onClick={() => setMore(true)}>
            <Icon name="more" size={22} />
            <span>More</span>
          </button>
        </nav>
      </div>

      <Command open={cmd} onClose={() => setCmd(false)} actions={actions} />
      {more ? <MoreSheet onClose={() => setMore(false)} theme={theme} setTheme={setTheme} /> : null}
      {sheet && sheet.kind === "record" ? <RecordSheet key={sheet.type + (sheet.id || "")} type={sheet.type} id={sheet.id} item={sheet.item} defaults={sheet.defaults} title={sheet.title} onSaved={sheet.onSaved} onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.kind === "capture" ? <CaptureSheet onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.kind === "upload" ? <UploadSheet defaults={sheet.defaults} onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.kind === "quick" ? (
        <Sheet open onClose={() => setSheet(null)} title="Quick actions">
          <div className="quick-grid">
            {QUICK.map(([k, label, icon]) => (
              <button key={k} type="button" className="quick" onClick={() => { setSheet(null); setTimeout(() => actions(k), 10) }}>
                <Icon name={icon} size={22} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
      <Toasts />
    </AppCtx.Provider>
  )
}

function App() {
  const [boot, setBoot] = useState(null)
  const [error, setError] = useState(null)
  const load = useCallback(() => {
    get("boot")
      .then((b) => {
        setBoot(b)
        setError(null)
      })
      .catch(setError)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  if (error)
    return (
      <div className="boot-error">
        <p className="brand"><span className="brand__word">ROUGE</span><span className="brand__hq">HQ</span></p>
        <ErrorBox error={error} onRetry={load} />
      </div>
    )
  if (!boot)
    return (
      <div className="boot">
        <p className="brand"><span className="brand__word">ROUGE</span><span className="brand__hq">HQ</span></p>
        <p className="boot__tag">The world behind ROUGE.</p>
      </div>
    )
  return <Shell boot={boot} reloadBoot={load} />
}

createRoot(document.getElementById("hq")).render(<App />)
