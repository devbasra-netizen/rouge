// SETTINGS — appearance, connections, templates, data and security.
import { useState } from "react"
import { useApi, useApp, remove, toast, parseJson, plural, API } from "../lib.js"
import { Card, Icon, Btn, Chip, Empty, Loading, PageHead, Notice, ThemeSwitch, Sheet } from "../ui.jsx"
import { CommunitySettings } from "./community.jsx"

function Row({ ok, title, children, action }) {
  return (
    <li className="conn">
      <span className={`conn__dot${ok ? " is-ok" : ""}`} aria-hidden="true" />
      <div className="conn__text">
        <strong>{title}</strong>
        <div className="muted small">{children}</div>
      </div>
      {action}
    </li>
  )
}

export default function Settings() {
  const app = useApp()
  const c = app.boot.config
  const templates = useApi("t/templates")
  const [view, setView] = useState(null)
  const counts = app.boot.counts
  return (
    <div className="page">
      <PageHead eyebrow="ROUGE HQ" title="Settings" />
      <div className="two-col">
        <div className="stack">
          <Card eyebrow="Appearance">
            <ThemeSwitch theme={app.theme} setTheme={app.setTheme} />
            <p className="fineprint">Saved on this device. “Auto” follows your phone or computer.</p>
          </Card>

          <Card eyebrow="Connections">
            <ul className="conns">
              <Row ok title="Database" >Cloudflare D1 (the same database as your signups). HQ creates and updates its own tables; your signup and invite tables are only read.</Row>
              <Row ok={c.ai} title="ROUGE AI & deep research">
                {c.ai ? <>Connected. Chat uses <code>{c.model}</code>; research uses <code>{c.research_model}</code>.</> : <>Add <code>ANTHROPIC_API_KEY</code> as a Secret in Cloudflare.</>} Web search must be allowed for your organisation in the Anthropic Console. Optional: set <code>ANTHROPIC_RESEARCH_MODEL</code> to use a different model for research.
              </Row>
              <Row ok={c.files} title="File storage">
                {c.files ? "Connected (R2 bucket bound as HQ_FILES). Uploads are private to HQ." : (
                  <>
                    Not connected — you can save links for now. To upload files: Cloudflare → R2 → create a bucket (e.g. <code>rouge-hq-files</code>), then Workers &amp; Pages → rouge-london → Settings → Bindings → add an <strong>R2 bucket</strong> binding named <code>HQ_FILES</code>, and redeploy.
                  </>
                )}
              </Row>
              <Row ok={c.email} title="Email sending">{c.email ? "Resend is connected. Send to your list from the invites dashboard." : "Resend isn't configured."} </Row>
            </ul>
            <div className="row-gap wrap">
              <a className="btn btn--ghost btn--sm" href="/admin/invites"><Icon name="mail" size={16} /><span>Invites dashboard</span></a>
              <a className="btn btn--ghost btn--sm" href="/admin/study"><Icon name="knowledge" size={16} /><span>Study guide</span></a>
            </div>
          </Card>

          <Card eyebrow="Access & security">
            <ul className="bullets">
              <li>Signed in as <strong>{app.boot.me.email}</strong> ({app.boot.me.method === "access" ? "Cloudflare Access" : "password"}). Sessions last 12 hours.</li>
              <li>Everything under /admin is private: pages, data, files and AI. Search engines are told not to index it.</li>
              <li>Collaborators don't get accounts. Give them a crew link from an event's Team tab: read-only, limited to the areas you pick, expiring, and revocable.</li>
              <li>Uploaded files are served only to you, with scripts disabled.</li>
            </ul>
          </Card>
        </div>

        <div className="stack">
          <Card eyebrow="Checklist templates">
            {!templates.data ? <Loading /> : templates.data.items.length ? (
              <ul className="ledger">
                {templates.data.items.map((t) => {
                  const items = parseJson(t.items, []) || []
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => setView(t)}>
                        <Icon name="list" size={18} />
                        <span className="ledger__text"><strong>{t.name}</strong><span className="faint small">{plural(items.length, "task")}{t.notes ? ` · ${t.notes}` : ""}</span></span>
                        <Icon name="right" size={16} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty compact icon="list">No templates. Save one from any event's checklist.</Empty>
            )}
            <p className="fineprint">Apply a template from an event's Checklist (⋯ menu). Save any event's checklist as a new template the same way.</p>
          </Card>

          <CommunitySettings />

          <Card eyebrow="Your data">
            <div className="mini-stats mini-stats--wrap">
              {[["events", "events"], ["tasks", "tasks"], ["venues", "venues"], ["notes", "notes"], ["ideas", "ideas"], ["ledger", "money entries"]].map(([k, l]) => (
                <div key={k}><strong>{counts[k] || 0}</strong><span>{l}</span></div>
              ))}
            </div>
            <a className="btn btn--ghost" href={`${API}export`} download><Icon name="download" size={18} /><span>Download everything (JSON)</span></a>
            <p className="fineprint">A full copy of HQ's data, for backups. Download one before big changes.</p>
          </Card>
        </div>
      </div>

      {view ? (
        <Sheet open onClose={() => setView(null)} eyebrow="Template" title={view.name} footer={<><Btn kind="quiet" icon="trash" className="danger-text" onClick={async () => { if (!window.confirm("Delete this template?")) return; await remove("templates", view.id); toast("Template deleted"); setView(null) }}>Delete</Btn><Btn kind="primary" onClick={() => setView(null)}>Done</Btn></>}>
          <ol className="tpl">
            {(parseJson(view.items, []) || []).map((it, i) => (
              <li key={i}>
                <strong>{it.title}</strong>
                <span className="faint small">{[it.section, it.offset !== null && it.offset !== undefined ? (it.offset === 0 ? "on the night" : it.offset < 0 ? `${-it.offset} days before` : `${it.offset} days after`) : null, it.priority !== "normal" ? it.priority : null].filter(Boolean).join(" · ")}</span>
                {it.subtasks && it.subtasks.length ? <span className="small muted">{it.subtasks.join(" · ")}</span> : null}
              </li>
            ))}
          </ol>
        </Sheet>
      ) : null}
    </div>
  )
}
