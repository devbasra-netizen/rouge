// KNOWLEDGE — notes, briefs, how-tos, research reports and documents.
import { useEffect, useRef, useState } from "react"
import { useApi, useApp, save, remove, navigate, toast, md, timeAgo, parseJson, hostOf, NOTE_KIND, DOC_KIND, fmtDay } from "../lib.js"
import { Card, Icon, Btn, A, Chip, Empty, Loading, ErrorBox, PageHead, Segmented, Select, Toggle, Notice } from "../ui.jsx"
import { DocLink } from "./events.jsx"

const KINDS = { all: "All", brand: "Brand", brief: "Briefs", sop: "How-tos", meeting: "Meetings", research: "Research", email: "Emails", debrief: "Debriefs", note: "Notes" }

export function Knowledge({ kind }) {
  const app = useApp()
  const [q, setQ] = useState("")
  const [term, setTerm] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 200)
    return () => clearTimeout(t)
  }, [q])
  const path = `t/notes?${kind !== "all" ? `kind=${kind}&` : ""}${term ? `q=${encodeURIComponent(term)}` : ""}`
  const { data, error } = useApi(path)
  const items = (data && data.items) || []
  const create = async () => {
    try {
      const n = await save("notes", { title: "Untitled note", kind: kind !== "all" ? kind : "note", body: "" })
      navigate(`knowledge/${n.id}?edit=1`)
    } catch (e) {
      toast(e.message, "bad")
    }
  }
  return (
    <div className="page">
      <PageHead eyebrow="The ROUGE library" title="Knowledge" sub="Brand, briefs, how-tos, meeting notes and research. Mark a note “ROUGE AI reads this” to put it in the AI's context." actions={<><Btn icon="globe" onClick={() => navigate("ai/research")}>Deep research</Btn><Btn kind="primary" icon="plus" onClick={create}>Note</Btn></>} />
      <div className="chips-scroll">
        {Object.entries(KINDS).map(([k, l]) => (
          <button key={k} type="button" className={`chip chip--btn${kind === k ? " chip--on" : " chip--soft"}`} onClick={() => navigate(`knowledge${k === "all" ? "" : `?kind=${k}`}`, { replace: true })}>{l}</button>
        ))}
      </div>
      <div className="toolbar">
        <div className="searchbox">
          <Icon name="search" size={16} />
          <input className="input input--bare" placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search notes" />
        </div>
        <A to="knowledge/docs" className="link-sm">Documents <Icon name="right" size={14} /></A>
      </div>
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : items.length ? (
        <div className="note-grid">
          {items.map((n) => (
            <A key={n.id} to={`knowledge/${n.id}`} className="note-card">
              <span className="note-card__top">
                <Chip tone={n.kind === "research" ? "brass" : n.kind === "brand" ? "red" : "soft"}>{NOTE_KIND[n.kind] || n.kind}</Chip>
                <span className="row-gap">
                  {n.ai_context ? <Icon name="ai" size={14} title="ROUGE AI reads this" /> : null}
                  {n.pinned ? <Icon name="star" size={14} title="Pinned" /> : null}
                </span>
              </span>
              <strong className="note-card__title">{n.title}</strong>
              <span className="note-card__body">{String(n.body || "").replace(/[#*_>|`-]+/g, " ").slice(0, 180)}</span>
              <span className="faint small">{timeAgo(n.updated_at)}{n.tags ? ` · ${n.tags}` : ""}</span>
            </A>
          ))}
        </div>
      ) : (
        <Empty icon="knowledge" title={term ? "No matches" : "Nothing here yet"} action={<Btn icon="plus" onClick={create}>New note</Btn>}>{term ? "Try another word." : "Write the first one."}</Empty>
      )}
    </div>
  )
}

export function NotePage({ id }) {
  const app = useApp()
  const { data, error, reload } = useApi(`t/notes/${id}`, { live: false })
  const [note, setNote] = useState(null)
  const [edit, setEdit] = useState(() => new URLSearchParams(window.location.search).get("edit") === "1")
  const [state, setState] = useState("saved")
  const timer = useRef(null)
  const pending = useRef({})
  useEffect(() => {
    if (data) setNote(data.item)
  }, [data])
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (Object.keys(pending.current).length) save("notes", pending.current, id).catch(() => {})
    },
    [id],
  )
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>
  if (!note) return <div className="page"><Loading rows={6} /></div>
  const sources = parseJson(note.sources, []) || []
  const persist = async () => {
    const values = pending.current
    pending.current = {}
    if (!Object.keys(values).length) return
    setState("saving")
    try {
      await save("notes", values, note.id)
      setState(Object.keys(pending.current).length ? "dirty" : "saved")
    } catch (e) {
      pending.current = { ...values, ...pending.current }
      setState("error")
      toast(e.message, "bad")
    }
  }
  const change = (k, v, immediate) => {
    setNote((n) => ({ ...n, [k]: v }))
    pending.current[k] = v
    setState("dirty")
    clearTimeout(timer.current)
    if (immediate) persist()
    else timer.current = setTimeout(persist, 900)
  }
  const flushBody = () => {
    clearTimeout(timer.current)
    persist()
  }
  const del = async () => {
    if (!window.confirm("Delete this note?")) return
    await remove("notes", note.id)
    toast("Deleted")
    navigate("knowledge")
  }
  return (
    <div className="page page--note">
      <A to="knowledge" className="back"><Icon name="left" size={16} />Knowledge</A>
      <div className="note-layout">
        <article className="note">
          <input className="note__title display" value={note.title} onChange={(e) => change("title", e.target.value)} onBlur={flushBody} aria-label="Title" />
          <div className="note__bar">
            <Segmented small options={{ read: "Read", edit: "Edit" }} value={edit ? "edit" : "read"} onChange={(v) => { if (v === "read") flushBody(); setEdit(v === "edit") }} />
            <span className={`save-state save-state--${state}`}>{state === "saving" ? "Saving…" : state === "dirty" ? "Editing" : state === "error" ? "Not saved" : "Saved"}</span>
          </div>
          {edit ? (
            <textarea className="note__editor" value={note.body || ""} onChange={(e) => change("body", e.target.value)} onBlur={flushBody} placeholder="Write in Markdown: # heading, **bold**, - lists, | tables |" aria-label="Note body" />
          ) : note.body ? (
            <div className="prose" dangerouslySetInnerHTML={{ __html: md(note.body) }} />
          ) : (
            <Empty compact icon="edit" action={<Btn size="sm" onClick={() => setEdit(true)}>Write</Btn>}>Empty note.</Empty>
          )}
          {sources.length ? (
            <section className="note__sources">
              <h3 className="subhead">Sources</h3>
              <ol className="sources">
                {sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">{s.n ? <span className="cite-n">{s.n}</span> : null}{s.title || hostOf(s.url)}</a>
                    <span className="faint small">{hostOf(s.url)}{s.cited ? "" : " · consulted"}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </article>
        <aside className="note-side stack">
          <Card eyebrow="Details">
            <div className="form">
              <div className="field"><div className="field__label"><label htmlFor="nk">Kind</label></div><Select id="nk" value={note.kind} onChange={(v) => change("kind", v || "note", true)} options={NOTE_KIND} placeholder="Note" /></div>
              <div className="field"><div className="field__label"><label htmlFor="ne">Event</label></div><Select id="ne" value={note.event_id ? String(note.event_id) : ""} onChange={(v) => change("event_id", v ? Number(v) : null, true)} options={app.boot.events.map((e) => [String(e.id), e.name])} placeholder="None" /></div>
              <div className="field"><div className="field__label"><label htmlFor="nt">Tags</label></div><input id="nt" className="input" value={note.tags || ""} onChange={(e) => change("tags", e.target.value)} onBlur={flushBody} /></div>
              <Toggle checked={note.pinned} onChange={(v) => change("pinned", v, true)} label="Pinned" />
              <Toggle checked={note.ai_context} onChange={(v) => change("ai_context", v, true)} label="ROUGE AI reads this" />
            </div>
          </Card>
          <Card eyebrow="Use it">
            <div className="stack stack--tight">
              <Btn icon="ai" onClick={() => navigate("ai?prompt=" + encodeURIComponent(`Using my note “${note.title}”, `))}>Ask ROUGE AI</Btn>
              <Btn icon="check" onClick={() => app.openRecord("tasks", { defaults: { title: note.title, event_id: note.event_id, notes: `From the note “${note.title}”.`, priority: "normal" } })}>Make a task</Btn>
              <Btn kind="quiet" icon="trash" className="danger-text" onClick={del}>Delete note</Btn>
            </div>
            <p className="fineprint">Updated {timeAgo(note.updated_at)} · created {fmtDay(note.created_at.slice(0, 10))}</p>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export function Docs() {
  const app = useApp()
  const { data, error } = useApi("t/docs")
  const [kind, setKind] = useState("all")
  const items = ((data && data.items) || []).filter((d) => kind === "all" || d.kind === kind)
  const names = Object.fromEntries(app.boot.events.map((e) => [e.id, e.name]))
  return (
    <div className="page">
      <A to="knowledge" className="back"><Icon name="left" size={16} />Knowledge</A>
      <PageHead eyebrow="Knowledge" title="Documents" sub="Contracts, invoices, receipts, riders, artwork and photos." actions={<Btn kind="primary" icon="upload" onClick={() => app.openUpload({})}>Add</Btn>} />
      {!app.boot.config.files ? <Notice tone="info" icon="lock" action={<Btn size="sm" onClick={() => navigate("settings")}>How</Btn>}>File storage isn't connected yet, so you can save links (Drive, Dropbox, email) for now. Connect storage in Settings to upload files directly.</Notice> : null}
      <div className="chips-scroll">
        {[["all", "All"], ...Object.entries(DOC_KIND)].map(([k, l]) => (
          <button key={k} type="button" className={`chip chip--btn${kind === k ? " chip--on" : " chip--soft"}`} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : items.length ? (
        <Card pad={false}>
          <ul className="docs docs--list">
            {items.map((x) => (
              <li key={x.id}>
                <DocLink doc={x} />
                <span className="faint small">{x.event_id ? names[x.event_id] : ""}</span>
                <Btn kind="quiet" size="sm" icon="edit" aria-label="Edit" onClick={() => app.openRecord("docs", { item: x })} />
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Empty icon="file" title="No documents yet">Upload a contract or attach a receipt to an expense.</Empty>
      )}
    </div>
  )
}
