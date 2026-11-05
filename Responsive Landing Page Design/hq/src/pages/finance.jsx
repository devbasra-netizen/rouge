// FINANCE — only what's recorded. Estimates and unconfirmed entries are always labelled.
import { useState } from "react"
import { useApi, useApp, navigate, money, plural, fmtDate } from "../lib.js"
import { Card, Icon, Btn, A, Stat, Empty, Loading, ErrorBox, PageHead, Segmented, Notice, Conf } from "../ui.jsx"
import { LedgerList } from "./events.jsx"

function MonthlyChart({ monthly }) {
  const [hover, setHover] = useState(null)
  const months = [...new Set(monthly.map((m) => m.month))].sort()
  if (!months.length) return <Empty compact icon="finance">No paid or received entries yet.</Empty>
  const val = (m, kind) => (monthly.find((x) => x.month === m && x.kind === kind) || {}).total || 0
  const max = Math.max(1, ...months.flatMap((m) => [val(m, "income"), val(m, "expense")]))
  const W = 100 / months.length
  const label = (m) => fmtDate(m + "-01", { month: "short", year: "2-digit" })
  return (
    <figure className="chart">
      <div className="chart__legend">
        <span><i className="swatch swatch--income" />Income</span>
        <span><i className="swatch swatch--cost" />Costs</span>
      </div>
      <div className="chart__plot" role="img" aria-label="Income and costs by month">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          {[0.5, 1].map((g) => <line key={g} x1="0" x2="100" y1={40 - g * 36} y2={40 - g * 36} className="chart__grid" />)}
          {months.map((m, i) => {
            const bw = Math.min(W * 0.3, 7)
            const cx = i * W + W / 2
            const hi = (val(m, "income") / max) * 36
            const he = (val(m, "expense") / max) * 36
            return (
              <g key={m} className={hover === i ? "is-hover" : ""}>
                <rect x={cx - bw - 0.4} width={bw} y={40 - Math.max(hi, 0.4)} height={Math.max(hi, 0.4)} rx="0.8" className="chart__bar chart__bar--income" />
                <rect x={cx + 0.4} width={bw} y={40 - Math.max(he, 0.4)} height={Math.max(he, 0.4)} rx="0.8" className="chart__bar chart__bar--cost" />
              </g>
            )
          })}
        </svg>
        <div className="chart__hits">
          {months.map((m, i) => (
            <button key={m} type="button" style={{ width: `${W}%` }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={`${label(m)}: income ${money(val(m, "income"))}, costs ${money(val(m, "expense"))}`} />
          ))}
        </div>
        {hover !== null ? (
          <div className="chart__tip" style={{ left: `${(hover + 0.5) * W}%` }}>
            <strong>{label(months[hover])}</strong><br />Income {money(val(months[hover], "income"))}<br />Costs {money(val(months[hover], "expense"))}
          </div>
        ) : null}
      </div>
      <figcaption className="chart__axis">{months.map((m) => <span key={m}>{label(m)}</span>)}</figcaption>
    </figure>
  )
}

export default function Finance() {
  const app = useApp()
  const { data, error } = useApi("finance")
  const ledger = useApi("t/ledger?limit=1000")
  const [filter, setFilter] = useState("all")
  if (error) return <div className="page"><ErrorBox error={error} /></div>
  if (!data) return <div className="page"><Loading rows={5} /></div>
  const t = data.totals
  const names = Object.fromEntries(app.boot.events.map((e) => [e.id, e.name]))
  const entries = ((ledger.data && ledger.data.items) || []).map((l) => ({ ...l, event_name: l.event_id ? names[l.event_id] : "Brand" }))
  const shown = entries.filter((l) => (filter === "income" ? l.kind === "income" : filter === "expense" ? l.kind === "expense" && l.status === "actual" : filter === "planned" ? l.status === "planned" : filter === "confirm" ? l.confidence !== "verified" : true))
  const events = data.events.filter((e) => e.money || e.budget)
  return (
    <div className="page">
      <PageHead
        eyebrow="Money"
        title="Finance"
        sub="Every number here comes from an entry you've recorded. Nothing is filled in for you."
        actions={<><Btn icon="plus" onClick={() => app.openRecord("ledger", { defaults: { kind: "income", status: "actual", confidence: "verified" } })}>Income</Btn><Btn kind="primary" icon="plus" onClick={() => app.actions("expense")}>Expense</Btn></>}
      />
      {t.unconfirmed ? (
        <Notice tone="warn" icon="warn" action={<Btn size="sm" onClick={() => setFilter("confirm")}>Review</Btn>}>
          {plural(t.unconfirmed, "entry", "entries")} still marked estimate or to confirm, so totals are provisional.
        </Notice>
      ) : null}
      <div className="pulse pulse--4">
        <Stat label="Income" value={money(t.income)} sub="Received" empty={!t.entries} />
        <Stat label="Costs" value={money(t.expense)} sub="Paid" empty={!t.entries} />
        <Stat label="Net" value={money(t.income - t.expense)} sub={t.unconfirmed ? "Provisional" : "From recorded entries"} empty={!t.entries} tone={t.income - t.expense < 0 ? "bad" : undefined} />
        <Stat label="Planned costs" value={money(t.planned_expense)} sub="Not yet paid" empty={!t.planned_expense} />
      </div>

      <Card eyebrow="By event">
        {events.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Event</th><th className="num">Income</th><th className="num">Costs</th><th className="num">Profit</th><th className="num">Budget</th><th className="num">Left</th></tr></thead>
              <tbody>
                {events.map((e) => {
                  const m = e.money || { income: 0, expense: 0, planned_expense: 0, unconfirmed: 0 }
                  const b = e.budget ? e.budget.total : null
                  return (
                    <tr key={e.id} className="is-clickable" onClick={() => navigate(`events/${e.id}/money`)}>
                      <td><strong>{e.name}</strong>{m.unconfirmed ? <span className="faint small block">provisional</span> : null}</td>
                      <td className="num">{e.money ? money(m.income) : "—"}</td>
                      <td className="num">{e.money ? money(m.expense) : "—"}</td>
                      <td className={`num${m.income - m.expense < 0 ? " danger-text" : ""}`}>{e.money ? money(m.income - m.expense) : "—"}</td>
                      <td className="num">{b !== null ? <>{money(b)}{e.budget.estimates ? <Conf value="estimate" compact /> : null}</> : "—"}</td>
                      <td className="num">{b !== null ? money(b - m.expense - m.planned_expense) : "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty compact icon="events">No event money or budgets yet.</Empty>
        )}
      </Card>

      <div className="two-col">
        <Card eyebrow="Month by month" title="Received and paid">
          <MonthlyChart monthly={data.monthly} />
        </Card>
        <Card eyebrow="Where it goes">
          {data.categories.filter((c) => c.kind === "expense").length ? (
            <ul className="sources-list">
              {data.categories.filter((c) => c.kind === "expense").map((c) => (
                <li key={c.category}>
                  <span>{c.category}</span>
                  <span className="bar bar--red"><i style={{ width: `${(c.total / Math.max(1, t.expense)) * 100}%` }} /></span>
                  <span className="num">{money(c.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty compact icon="money">No costs recorded.</Empty>
          )}
        </Card>
      </div>

      <Card eyebrow="Entries" pad>
        <div className="toolbar">
          <Segmented small options={{ all: "All", income: "Income", expense: "Costs", planned: "Planned", confirm: "To confirm" }} value={filter} onChange={setFilter} />
        </div>
        {ledger.error ? <ErrorBox error={ledger.error} /> : !ledger.data ? <Loading /> : <LedgerList items={shown} showEvent />}
      </Card>
      <p className="fineprint">Venue bar takings are recorded on each event as venue revenue and are never counted as ROUGE income. Attach receipts from an entry's event under Files & notes.</p>
    </div>
  )
}
