// ROUGE HQ interface primitives: icons, buttons, cards, sheets, fields and small data marks.
import { useEffect, useRef, useState, useId } from "react"
import { createPortal } from "react-dom"
import { linkProps, parseMoney, money, CONF, initials } from "./lib.js"

// ---------- icons (1.6px strokes on a 24px grid) ----------
const P = {
  home: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z",
  events: "M7 3v3M17 3v3M4 8.5h16M5 5.5h14a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1ZM12 11.2l1.1 2.2 2.4.35-1.75 1.7.42 2.4L12 16.7l-2.17 1.15.42-2.4-1.75-1.7 2.4-.35z",
  studio: "M12 3c.6 3.9 2.1 5.4 6 6-3.9.6-5.4 2.1-6 6-.6-3.9-2.1-5.4-6-6 3.9-.6 5.4-2.1 6-6ZM18.5 15.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z",
  audience: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.6-3.6 3.1-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.6 3.1 2.3 3.5 5.2",
  radio: "M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8",
  finance: "M15.5 6.5A4 4 0 0 0 8.8 9.4c0 3.8 1.2 5.6-1.8 9.6h11M6.5 13h7",
  knowledge: "M4 5.5c2.7-1 5.3-1 8 .5 2.7-1.5 5.3-1.5 8-.5v13c-2.7-1-5.3-1-8 .5-2.7-1.5-5.3-1.5-8-.5zM12 6v13.5",
  ai: "M9.5 4.5c.5 3.4 1.6 4.5 5 5-3.4.5-4.5 1.6-5 5-.5-3.4-1.6-4.5-5-5 3.4-.5 4.5-1.6 5-5ZM17 13.5c.35 2.1 1 2.65 3 3-2 .35-2.65.9-3 3-.35-2.1-1-2.65-3-3 2-.35 2.65-.9 3-3ZM17.5 3.5c.2 1.2.6 1.6 1.8 1.8-1.2.2-1.6.6-1.8 1.8-.2-1.2-.6-1.6-1.8-1.8 1.2-.2 1.6-.6 1.8-1.8Z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.4 7.4 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4z",
  search: "M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20.5 20.5l-5-5",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6 6 18",
  right: "M9.5 5.5 16 12l-6.5 6.5",
  left: "M14.5 5.5 8 12l6.5 6.5",
  down: "M5.5 9.5 12 16l6.5-6.5",
  up: "M5.5 14.5 12 8l6.5 6.5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  calendar: "M7 3v3M17 3v3M4 9h16M5 5.5h14a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2",
  pin: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  ticket: "M4 7.5V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v1.5a2.5 2.5 0 0 0 0 5V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.5a2.5 2.5 0 0 0 0-5ZM14.5 5v14",
  file: "M14 3H6.5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V7.5zM14 3v4.5h4.5M9 13h6M9 16.5h6",
  upload: "M12 15.5V4M7.5 8.5 12 4l4.5 4.5M4.5 15v4a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4",
  link: "M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1",
  trash: "M4.5 7h15M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  edit: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  sun: "M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z",
  mail: "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM3.5 7l8.5 6.5L20.5 7",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z",
  venue: "M3.5 21h17M5 21V9.5L12 4l7 5.5V21M9.5 21v-6h5v6M9 11h.01M15 11h.01",
  columns: "M4 5h16v14H4zM9.5 5v14M14.5 5v14",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 9h17M3.5 15h17M12 3c-2.5 2.6-3.6 5.6-3.6 9s1.1 6.4 3.6 9c2.5-2.6 3.6-5.6 3.6-9S14.5 5.6 12 3Z",
  send: "M4.5 12 20 4.5 15.5 20l-3.2-6.3zM12.3 13.7 20 4.5",
  stop: "M7 7h10v10H7z",
  copy: "M9 9h10.5v10.5H9zM15 9V4.5H4.5V15H9",
  star: "m12 3.5 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z",
  flag: "M5 21V4M5 4.5h11.5l-2 4 2 4H5",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  timeline: "M4 6h9M8 12h12M6 18h8",
  refresh: "M19.5 8.5A8 8 0 0 0 5 7.5M4.5 4v3.5H8M4.5 15.5A8 8 0 0 0 19 16.5M19.5 20v-3.5H16",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  lock: "M6 10.5h12a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1ZM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3",
  signout: "M14 4h4.5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H14M10 8l-4 4 4 4M6 12h10",
  note: "M5 4h14a1 1 0 0 1 1 1v9.5L14.5 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM20 14.5h-5.5V20M8 9h8M8 12.5h5",
  money: "M3.5 7h17v10h-17zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6.5 7a3 3 0 0 1-3 3M17.5 7a3 3 0 0 0 3 3M6.5 17a3 3 0 0 0-3-3M17.5 17a3 3 0 0 1 3-3",
  people: "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20.5c.7-4 3.3-6 7-6s6.3 2 7 6",
  spark: "M12 3c.6 3.9 2.1 5.4 6 6-3.9.6-5.4 2.1-6 6-.6-3.9-2.1-5.4-6-6 3.9-.6 5.4-2.1 6-6Z",
  campaign: "M4 10v4l3 .5V9.5zM7 9.5l10-4.5v14l-10-4.5M17 9.5a2.5 2.5 0 0 1 0 5M8 15l1.2 5h2.3L10.5 15.6",
  warn: "M12 4 2.5 20h19zM12 10v4.5M12 17.5h.01",
  shuffle: "M4 7h3.5c2.4 0 3.6 1.1 5 3.5l1 1.5c1.4 2.4 2.6 3.5 5 3.5H20M17.5 13l2.5 2.5-2.5 2.5M4 17h3.5c1.3 0 2.2-.3 3-1M17.5 6 20 8.5 17.5 11M13.5 8c.9-.7 1.9-1 3-1H20",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  download: "M12 4v11.5M7.5 11 12 15.5 16.5 11M4.5 15v4a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4",
  photo: "M4 5.5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1ZM3.5 16l5-5 4 4 2.5-2.5 5.5 5M15.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
}

export function Icon({ name, size = 20, className = "", title }) {
  const d = P[name] || P.spark
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <path d={d} />
    </svg>
  )
}

// ---------- buttons & links ----------
export function Btn({ kind = "ghost", size, icon, iconRight, children, className = "", busy, ...rest }) {
  return (
    <button type="button" className={`btn btn--${kind}${size ? ` btn--${size}` : ""}${children ? "" : " btn--icon"} ${className}`} disabled={busy || rest.disabled} {...rest}>
      {busy ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} /> : null}
      {children ? <span>{children}</span> : null}
      {iconRight ? <Icon name={iconRight} size={16} /> : null}
    </button>
  )
}

export function A({ to, children, className = "", ...rest }) {
  return (
    <a className={className} {...linkProps(to)} {...rest}>
      {children}
    </a>
  )
}

// ---------- layout ----------
export function Card({ title, eyebrow, action, children, className = "", pad = true, id }) {
  return (
    <section className={`card ${pad ? "card--pad" : ""} ${className}`} id={id}>
      {title || eyebrow || action ? (
        <header className="card__head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h3 className="card__title">{title}</h3> : null}
          </div>
          {action ? <div className="card__action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

export function PageHead({ eyebrow, title, sub, actions, children }) {
  return (
    <header className="pagehead">
      <div className="pagehead__text">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="display">{title}</h1>
        {sub ? <p className="pagehead__sub">{sub}</p> : null}
      </div>
      {actions ? <div className="pagehead__actions">{actions}</div> : null}
      {children}
    </header>
  )
}

export function Empty({ icon = "spark", title, children, action, compact }) {
  return (
    <div className={`empty${compact ? " empty--compact" : ""}`}>
      <Icon name={icon} size={compact ? 18 : 24} />
      <div>
        {title ? <p className="empty__title">{title}</p> : null}
        {children ? <p className="empty__text">{children}</p> : null}
      </div>
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  )
}

export function Loading({ rows = 3 }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton__row" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="notice notice--bad" role="alert">
      <Icon name="warn" size={18} />
      <span>{(error && error.message) || "Something went wrong."}</span>
      {onRetry ? (
        <Btn size="sm" onClick={onRetry}>
          Retry
        </Btn>
      ) : null}
    </div>
  )
}

export function Notice({ tone = "info", icon = "spark", children, action }) {
  return (
    <div className={`notice notice--${tone}`}>
      <Icon name={icon} size={18} />
      <div className="notice__body">{children}</div>
      {action}
    </div>
  )
}

// ---------- chips ----------
export function Chip({ tone = "neutral", children, icon, className = "", title }) {
  return (
    <span className={`chip chip--${tone} ${className}`} title={title}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  )
}

const STATUS_TONE = {
  completed: "muted", cancelled: "muted", idea: "soft", planning: "brass", confirmed: "red", on_sale: "red",
  prospect: "soft", researching: "brass", enquired: "brass", awaiting: "brass", negotiating: "red", visited: "red", booked: "ok", rejected: "muted", past: "ok",
  todo: "soft", doing: "brass", done: "ok", spark: "red", developing: "brass", converted: "muted", parked: "muted",
  live: "red", drafting: "brass", ready: "ok", scheduled: "brass", published: "ok", recorded: "brass", editing: "brass",
  running: "brass", queued: "soft", failed: "bad", actual: "ok", planned: "soft",
}
export function Status({ value, labels }) {
  if (!value) return null
  return <Chip tone={STATUS_TONE[value] || "soft"}>{(labels && labels[value]) || String(value).replace(/_/g, " ")}</Chip>
}

const CONF_ICON = { verified: "check", estimate: "timeline", confirm: "warn" }
export function Conf({ value, onChange, source, compact }) {
  const v = value || "confirm"
  const order = ["confirm", "estimate", "verified"]
  const next = () => onChange && onChange(order[(order.indexOf(v) + 1) % order.length])
  const body = (
    <>
      <Icon name={CONF_ICON[v]} size={12} />
      {compact ? null : <span>{CONF[v]}</span>}
    </>
  )
  const title = `${CONF[v]}${source ? ` — ${source}` : ""}${onChange ? " (tap to change)" : ""}`
  return onChange ? (
    <button type="button" className={`conf conf--${v}`} onClick={next} title={title} aria-label={title}>
      {body}
    </button>
  ) : (
    <span className={`conf conf--${v}`} title={title}>
      {body}
    </span>
  )
}

export function Avatar({ name, size = 28 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} title={name}>
      {initials(name)}
    </span>
  )
}

// ---------- progress ----------
export function Bar({ value, max = 100, tone = "red", label }) {
  const w = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={`bar bar--${tone}`} role="progressbar" aria-valuenow={Math.round(w)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${w}%` }} />
    </div>
  )
}

export function Ring({ value, size = 76, stroke = 5, label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.min(100, Math.max(0, value || 0))
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label || `${v}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ring__track" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ring__fill" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="ring__label">
        {v}
        <small>%</small>
      </span>
    </div>
  )
}

// ---------- tabs ----------
export function Tabs({ tabs, value, onChange, className = "" }) {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map((t) => {
        const [key, label, count] = Array.isArray(t) ? t : [t.key, t.label, t.count]
        return (
          <button key={key} role="tab" type="button" aria-selected={value === key} className={`tab${value === key ? " is-on" : ""}`} onClick={() => onChange(key)}>
            {label}
            {count !== undefined && count !== null ? <span className="tab__count">{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented({ options, value, onChange, small }) {
  return (
    <div className={`seg${small ? " seg--sm" : ""}`} role="radiogroup">
      {Object.entries(options).map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? "is-on" : ""} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ---------- sheet (bottom sheet on phones, side panel on desktop) ----------
export function Sheet({ open, onClose, title, eyebrow, children, footer, wide }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const onKey = (e) => {
      if (e.key === "Escape") onClose && onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.classList.add("has-sheet")
    const t = setTimeout(() => {
      const el = ref.current && ref.current.querySelector("input:not([type=checkbox]):not([type=hidden]), textarea, select")
      if (el && window.matchMedia("(pointer: fine)").matches) el.focus()
    }, 60)
    return () => {
      clearTimeout(t)
      document.removeEventListener("keydown", onKey)
      document.body.classList.remove("has-sheet")
      if (prev && prev.focus) prev.focus()
    }
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="sheet-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className={`sheet${wide ? " sheet--wide" : ""}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} ref={ref}>
        <div className="sheet__grab" aria-hidden="true" />
        <header className="sheet__head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 className="sheet__title">{title}</h2>
          </div>
          <Btn icon="close" kind="quiet" onClick={onClose} aria-label="Close" />
        </header>
        <div className="sheet__body">{children}</div>
        {footer ? <footer className="sheet__foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}

export function useSheet() {
  const [state, setState] = useState(null)
  return [state, (v) => setState(v), () => setState(null)]
}

// ---------- popover menu ----------
export function Menu({ label = "More", icon = "more", items, align = "right", kind = "quiet", size }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const on = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener("pointerdown", on)
    return () => document.removeEventListener("pointerdown", on)
  }, [open])
  return (
    <div className="menu" ref={ref}>
      <Btn icon={icon} kind={kind} size={size} aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon === "more" ? null : label}
      </Btn>
      {open ? (
        <div className={`menu__pop menu__pop--${align}`} role="menu">
          {items.filter(Boolean).map((it, i) =>
            it === "-" ? (
              <hr key={i} />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={it.danger ? "is-danger" : ""}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
              >
                {it.icon ? <Icon name={it.icon} size={16} /> : null}
                {it.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  )
}

// ---------- fields ----------
export function Field({ label, hint, children, wide, conf, error }) {
  const id = useId()
  return (
    <div className={`field${wide ? " field--wide" : ""}`}>
      {label ? (
        <div className="field__label">
          <label htmlFor={id}>{label}</label>
          {conf}
        </div>
      ) : null}
      {typeof children === "function" ? children(id) : children}
      {error ? <p className="field__error">{error}</p> : hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  )
}

export function Input({ value, onChange, type = "text", ...rest }) {
  return <input className="input" type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />
}

export function TextArea({ value, onChange, rows = 4, ...rest }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight + 2, 640) + "px"
  }, [value])
  return <textarea ref={ref} className="input textarea" rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />
}

export function Select({ value, onChange, options, placeholder = "—", ...rest }) {
  const list = Array.isArray(options) ? options : Object.entries(options)
  return (
    <div className="select">
      <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)} {...rest}>
        <option value="">{placeholder}</option>
        {list.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <Icon name="down" size={16} />
    </div>
  )
}

export function MoneyInput({ value, onChange, ...rest }) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value / 100))
  useEffect(() => {
    const parsed = parseMoney(text)
    if (parsed !== value && !(Number.isNaN(parsed) && value === undefined)) setText(value === null || value === undefined ? "" : String(value / 100))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className="money-input">
      <span>£</span>
      <input
        className="input"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const p = parseMoney(e.target.value)
          if (!Number.isNaN(p)) onChange(p)
        }}
        {...rest}
      />
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked ? 1 : 0)} />
      <span className="toggle__track" aria-hidden="true">
        <i />
      </span>
      <span>{label}</span>
    </label>
  )
}

export function Tick({ checked, onChange, label, size = 22 }) {
  return (
    <button type="button" className={`tick${checked ? " is-on" : ""}`} style={{ width: size, height: size }} aria-pressed={!!checked} aria-label={label || (checked ? "Mark as not done" : "Mark as done")} onClick={(e) => { e.stopPropagation(); onChange(!checked) }}>
      <Icon name="check" size={size * 0.62} />
    </button>
  )
}

// ---------- copy ----------
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function Stat({ label, value, sub, empty, tone, icon, onClick }) {
  const Tag = onClick ? "button" : "div"
  return (
    <Tag className={`stat${empty ? " stat--empty" : ""}${tone ? ` stat--${tone}` : ""}`} onClick={onClick} type={onClick ? "button" : undefined}>
      <span className="stat__label">
        {icon ? <Icon name={icon} size={14} /> : null}
        {label}
      </span>
      <span className="stat__value">{empty ? "—" : value}</span>
      {sub ? <span className="stat__sub">{sub}</span> : null}
    </Tag>
  )
}

export function ThemeSwitch({ theme, setTheme }) {
  return (
    <div className="seg seg--sm theme-switch" role="radiogroup" aria-label="Appearance">
      {[["dark", "moon", "Dark"], ["light", "sun", "Light"], ["system", "settings", "Auto"]].map(([k, icon, label]) => (
        <button key={k} type="button" role="radio" aria-checked={theme === k} className={theme === k ? "is-on" : ""} onClick={() => setTheme(k)} title={label}>
          <Icon name={icon} size={14} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

export { money }
