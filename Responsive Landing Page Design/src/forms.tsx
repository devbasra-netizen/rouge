import { ReactNode, useId } from "react"

// Small, accessible form pieces shared by the Members and Radio application pages.

export type Errors = Record<string, string>

export function postJson(url: string, body: unknown) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (res) => {
    let data: { error?: string; field?: string; [k: string]: unknown } = {}
    try {
      data = await res.json()
    } catch {}
    if (!res.ok) {
      const err = new Error(data.error || (res.status === 429 ? "Too many attempts. Please try again later." : "That didn’t go through. Please try again.")) as Error & { field?: string }
      err.field = data.field
      throw err
    }
    return data
  })
}

export function offlineMessage(error: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "You seem to be offline. Check your connection and try again."
  return error instanceof Error && error.message ? error.message : "That didn’t go through. Please try again in a moment."
}

type FieldProps = {
  name: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  hint?: ReactNode
  optional?: boolean
  type?: "text" | "email" | "url"
  inputMode?: "text" | "email" | "url"
  autoComplete?: string
  maxLength?: number
  placeholder?: string
  multiline?: boolean
  rows?: number
  wordLimit?: number
  prefix?: string
  onBlur?: () => void
}

export function countWords(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0
}

export function FormField(p: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const words = p.wordLimit ? countWords(p.value) : 0
  const describedBy = [p.hint || p.wordLimit ? hintId : "", p.error ? errId : ""].filter(Boolean).join(" ") || undefined
  const common = {
    id,
    name: p.name,
    value: p.value,
    maxLength: p.maxLength,
    placeholder: p.placeholder,
    "aria-invalid": p.error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": p.optional ? undefined : true,
    onBlur: p.onBlur,
  }
  return (
    <div className={`pfield ${p.error ? "pfield--error" : ""} ${p.multiline ? "pfield--multi" : ""}`} data-field={p.name}>
      <label className="pfield__label" htmlFor={id}>
        {p.label}
        {p.optional ? <span className="pfield__opt">optional</span> : null}
      </label>
      <div className="pfield__box">
        {p.prefix ? <span aria-hidden="true" className="pfield__prefix">{p.prefix}</span> : null}
        {p.multiline ? (
          <textarea {...common} onChange={(e) => p.onChange(e.target.value)} rows={p.rows || 4} />
        ) : (
          <input
            {...common}
            autoCapitalize={p.type === "email" || p.type === "url" ? "none" : undefined}
            autoComplete={p.autoComplete}
            autoCorrect={p.type === "email" || p.type === "url" ? "off" : undefined}
            inputMode={p.inputMode}
            onChange={(e) => p.onChange(e.target.value)}
            spellCheck={p.type === "email" || p.type === "url" ? false : undefined}
            type={p.type || "text"}
          />
        )}
      </div>
      {p.hint || p.wordLimit ? (
        <p className="pfield__hint" id={hintId}>
          {p.hint}
          {p.wordLimit ? (
            <span className={`pfield__count ${words > p.wordLimit ? "is-over" : ""}`}>
              {words} / {p.wordLimit} words
            </span>
          ) : null}
        </p>
      ) : null}
      {p.error ? (
        <p className="pfield__error" id={errId} role="alert">
          {p.error}
        </p>
      ) : null}
    </div>
  )
}

export function Chips({
  legend,
  options,
  value,
  onChange,
  error,
  hint,
  optional,
  name,
}: {
  legend: string
  options: Record<string, string>
  value: string[]
  onChange: (v: string[]) => void
  error?: string
  hint?: string
  optional?: boolean
  name: string
}) {
  const id = useId()
  return (
    <fieldset aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} className={`pchips ${error ? "pfield--error" : ""}`} data-field={name}>
      <legend className="pfield__label">
        {legend}
        {optional ? <span className="pfield__opt">optional</span> : <span className="pfield__opt">pick any</span>}
      </legend>
      {hint ? (
        <p className="pfield__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      <div className="pchips__row">
        {Object.entries(options).map(([k, label]) => {
          const on = value.includes(k)
          return (
            <label className={`pchip ${on ? "is-on" : ""}`} key={k}>
              <input checked={on} name={name} onChange={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])} type="checkbox" value={k} />
              <span>{label}</span>
            </label>
          )
        })}
      </div>
      {error ? (
        <p className="pfield__error" id={`${id}-err`} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

export function Check({ name, checked, onChange, children, error }: { name: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: string }) {
  const id = useId()
  return (
    <div className={`pcheck ${error ? "pfield--error" : ""}`} data-field={name}>
      <input aria-describedby={error ? `${id}-err` : undefined} aria-invalid={error ? true : undefined} checked={checked} id={id} name={name} onChange={(e) => onChange(e.target.checked)} type="checkbox" />
      <label htmlFor={id}>{children}</label>
      {error ? (
        <p className="pfield__error" id={`${id}-err`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function Choice({ legend, options, value, onChange, name, optional }: { legend: string; options: Record<string, string>; value: string; onChange: (v: string) => void; name: string; optional?: boolean }) {
  return (
    <fieldset className="pchips" data-field={name}>
      <legend className="pfield__label">
        {legend}
        {optional ? <span className="pfield__opt">optional</span> : null}
      </legend>
      <div className="pchips__row">
        {Object.entries(options).map(([k, label]) => (
          <label className={`pchip ${value === k ? "is-on" : ""}`} key={k}>
            <input checked={value === k} name={name} onChange={() => onChange(value === k ? "" : k)} type="radio" value={k} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// Scrolls to and focuses the first field with an error.
export function focusFirstError(errors: Errors) {
  const first = Object.keys(errors)[0]
  if (!first) return
  requestAnimationFrame(() => {
    const box = document.querySelector<HTMLElement>(`[data-field="${first}"]`)
    if (!box) return
    box.scrollIntoView({ behavior: "smooth", block: "center" })
    const input = box.querySelector<HTMLElement>("input, textarea")
    input?.focus({ preventScroll: true })
  })
}
