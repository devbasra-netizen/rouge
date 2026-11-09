import { FormEvent, useEffect, useRef, useState } from "react"
import { Arrow, Label, useReveal } from "../components"
import { Check, Chips, Choice, Errors, FormField, countWords, focusFirstError, offlineMessage, postJson } from "../forms"

const GENRES = {
  rnb: "R&B", soul: "Soul / neo-soul", soulful_house: "Soulful house", deep_house: "Deep house", classic_house: "Classic house",
  garage: "UK garage", amapiano: "Amapiano", hiphop: "Hip-hop", disco_funk: "Disco / funk", electronic: "Electronic", other: "Other",
}
const PERFORMANCE = { vinyl: "Vinyl", digital: "Digital", hybrid: "Hybrid" }
const CAN_RECORD = { yes: "Yes", no: "No", not_sure: "Not sure yet" }
const ACKS: [string, string][] = [
  ["no_guarantee", "I understand that applying doesn’t guarantee selection."],
  ["no_schedule", "I understand ROUGE Radio hasn’t announced a confirmed broadcast schedule."],
  ["rights", "I’m entitled to submit and share the material I’ve provided."],
  ["permissions", "If I’m selected, recording, promotion and distribution permissions will be agreed with me separately."],
  ["licensing", "Music licensing and distribution requirements must be reviewed before any mix is publicly released."],
]
const IDEAS = ["Late-night R&B selections", "Deep house and soulful grooves", "Forgotten 2000s classics", "UK garage through the eras", "Amapiano selections", "Genre-fluid journeys", "Vinyl-focused mixes", "A personal collection of favourite records"]

const STEPS = [
  { side: "A1", title: "About you" },
  { side: "A2", title: "Your sound" },
  { side: "B1", title: "Your music" },
  { side: "B2", title: "Your Radio idea" },
  { side: "B3", title: "Final details" },
]

const DRAFT_KEY = "rouge:radio-apply:v1"

type Form = {
  artistName: string; email: string; location: string; profileUrl: string; bio: string; fullName: string; pronouns: string; website: string; otherSocials: string
  genres: string[]; genreOther: string; selectionStyle: string
  mixUrl: string; mixUrl2: string; mixWhy: string
  sessionConcept: string; sessionDifferent: string; sessionTitle: string; mixLength: string; performance: string; canRecord: string; technicalNotes: string
  discovery: string; extra: string; contactOk: boolean; acknowledgements: string[]; joinMembers: boolean
  submissionKey: string
}

const EMPTY: Form = {
  artistName: "", email: "", location: "", profileUrl: "", bio: "", fullName: "", pronouns: "", website: "", otherSocials: "",
  genres: [], genreOther: "", selectionStyle: "", mixUrl: "", mixUrl2: "", mixWhy: "",
  sessionConcept: "", sessionDifferent: "", sessionTitle: "", mixLength: "", performance: "", canRecord: "", technicalNotes: "",
  discovery: "", extra: "", contactOk: false, acknowledgements: [], joinMembers: false, submissionKey: "",
}

function newKey() {
  try {
    return crypto.randomUUID()
  } catch {
    return `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  }
}

function loadDraft(): Form {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return { ...EMPTY, ...JSON.parse(raw) }
  } catch {}
  return { ...EMPTY, submissionKey: newKey() }
}

const looksLikeUrl = (s: string) => /^(https?:\/\/)?[^\s/$.?#]+\.[^\s]{2,}$/i.test(s.trim())

function validate(step: number, f: Form): Errors {
  const e: Errors = {}
  if (step === 0) {
    if (!f.artistName.trim()) e.artistName = "Please add your DJ or artist name."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Please enter a valid email address."
    if (!f.location.trim()) e.location = "Where are you based?"
    if (!f.profileUrl.trim()) e.profileUrl = "Add your Instagram (@name) or a public profile link."
    else if (!f.profileUrl.trim().startsWith("@") && !looksLikeUrl(f.profileUrl)) e.profileUrl = "Use @yourname or a full link."
    if (countWords(f.bio) < 5) e.bio = "A few sentences about you, please."
    else if (countWords(f.bio) > 200) e.bio = "Please keep it under 200 words."
    if (f.website.trim() && !looksLikeUrl(f.website)) e.website = "That link doesn’t look right."
  }
  if (step === 1) {
    if (!f.genres.length) e.genres = "Pick at least one."
    if (countWords(f.selectionStyle) < 5) e.selectionStyle = "Tell us a little about how you select."
    else if (countWords(f.selectionStyle) > 200) e.selectionStyle = "Please keep it under 200 words."
  }
  if (step === 2) {
    if (!looksLikeUrl(f.mixUrl)) e.mixUrl = "Paste a link to a mix or recorded set."
    if (f.mixUrl2.trim() && !looksLikeUrl(f.mixUrl2)) e.mixUrl2 = "That link doesn’t look right."
  }
  if (step === 3) {
    if (countWords(f.sessionConcept) < 3) e.sessionConcept = "Tell us the session you’d like to create."
    else if (countWords(f.sessionConcept) > 150) e.sessionConcept = "Please keep it under 150 words."
  }
  if (step === 4) {
    if (!f.contactOk) e.contactOk = "We need your OK to contact you about this application."
    if (f.acknowledgements.length !== ACKS.length) e.acknowledgements = "Please confirm each point."
  }
  return e
}

const STEP_OF: Record<string, number> = {
  artistName: 0, email: 0, location: 0, profileUrl: 0, bio: 0, website: 0, genres: 1, selectionStyle: 1, mixUrl: 2, mixUrl2: 2, sessionConcept: 3, contactOk: 4, acknowledgements: 4,
}

function ApplyForm() {
  const [f, setF] = useState<Form>(loadDraft)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle")
  const [ref, setRef] = useState("")
  const [message, setMessage] = useState("")
  const [company, setCompany] = useState("")
  const [restored] = useState(() => {
    try {
      return !!localStorage.getItem(DRAFT_KEY)
    } catch {
      return false
    }
  })
  const started = useRef(Date.now())
  const topRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === "done") return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(f))
    } catch {}
  }, [f, status])

  const set = <K extends keyof Form>(k: K) => (x: Form[K]) => {
    setF((s) => ({ ...s, [k]: x }))
    if (errors[k as string]) setErrors((e) => ({ ...e, [k]: "" }))
  }
  const go = (n: number) => {
    setStep(n)
    setMessage("")
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }
  const next = () => {
    const e = validate(step, f)
    setErrors(e)
    if (Object.keys(e).length) return focusFirstError(e)
    go(step + 1)
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (step < STEPS.length - 1) return next()
    if (status === "sending") return
    for (let s = 0; s < STEPS.length; s++) {
      const e = validate(s, f)
      if (Object.keys(e).length) {
        setErrors(e)
        if (s !== step) go(s)
        return focusFirstError(e)
      }
    }
    setStatus("sending")
    setMessage("")
    try {
      const r = await postJson("/api/radio/apply", { ...f, company, elapsed: Date.now() - started.current })
      setRef(String(r.ref || ""))
      setStatus("done")
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {}
      requestAnimationFrame(() => {
        doneRef.current?.scrollIntoView({ block: "start" })
        doneRef.current?.focus({ preventScroll: true })
      })
    } catch (err) {
      const field = (err as { field?: string }).field
      if (field) {
        setErrors({ [field]: (err as Error).message })
        if (STEP_OF[field] !== undefined && STEP_OF[field] !== step) go(STEP_OF[field])
        focusFirstError({ [field]: "x" })
      } else setMessage(offlineMessage(err))
      setStatus("idle")
    }
  }

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {}
    setF({ ...EMPTY, submissionKey: newKey() })
    setErrors({})
    go(0)
  }

  if (status === "done") {
    return (
      <div className="received" ref={doneRef} role="status" tabIndex={-1}>
        <div aria-hidden="true" className="received__label">
          <span>ROUGE</span>
          <span>RADIO</span>
        </div>
        <Label>Application {ref && ref !== "RR-RECEIVED" ? ref : "received"}</Label>
        <h2 className="received__title">Sound received.</h2>
        <p className="received__lede">Thank you for sharing your sound with ROUGE.</p>
        <p>We’ll listen through applications and reach out if there’s a fit for an upcoming session.</p>
        <p className="received__sign">Until then, keep selecting.</p>
        <p className="received__small">A confirmation is on its way to {f.email.trim()}.</p>
        <div className="welcome__links">
          <a className="text-link" href="/radio">
            Back to ROUGE Radio <Arrow />
          </a>
          <a className="text-link" href="/members">
            Become a member <Arrow />
          </a>
        </div>
      </div>
    )
  }

  const pct = ((step + 1) / STEPS.length) * 100
  return (
    <form aria-busy={status === "sending"} className="apply" noValidate onSubmit={submit}>
      <div className="apply__top" ref={topRef}>
        <ol aria-label="Application progress" className="tracklist">
          {STEPS.map((s, i) => (
            <li aria-current={i === step ? "step" : undefined} className={i < step ? "is-done" : i === step ? "is-now" : ""} key={s.side}>
              <button disabled={i > step} onClick={() => i < step && go(i)} type="button">
                <span className="tracklist__side">{s.side}</span>
                <span className="tracklist__title">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <div aria-hidden="true" className="apply__bar">
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="apply__meta">
          <span>
            Step {step + 1} of {STEPS.length} · about 3–5 minutes
          </span>
          <span>{restored ? "Draft restored from this device · " : ""}Saved as you go on this device</span>
        </p>
      </div>

      <div className="apply__step" key={step}>
        <p className="apply__side">Side {STEPS[step].side}</p>
        <h3 className="apply__title">{STEPS[step].title}</h3>

        {step === 0 ? (
          <>
            <div className="invite-form__grid">
              <FormField error={errors.artistName} label="DJ / artist name" maxLength={80} name="artistName" onChange={set("artistName")} value={f.artistName} />
              <FormField autoComplete="email" error={errors.email} hint="For your application only." inputMode="email" label="Contact email" maxLength={254} name="email" onChange={set("email")} type="email" value={f.email} />
              <FormField autoComplete="address-level2" error={errors.location} label="City / location" maxLength={80} name="location" onChange={set("location")} value={f.location} />
              <FormField error={errors.profileUrl} hint="@yourname, or a link to SoundCloud, Mixcloud or similar." inputMode="url" label="Instagram or public profile" maxLength={200} name="profileUrl" onChange={set("profileUrl")} type="url" value={f.profileUrl} />
            </div>
            <FormField error={errors.bio} hint="Who you are and where you play. We won’t publish anything without your permission." label="Short artist bio" maxLength={1500} multiline name="bio" onChange={set("bio")} rows={5} value={f.bio} wordLimit={200} />
            <details className="apply__more" open={!!(f.fullName || f.pronouns || f.website || f.otherSocials)}>
              <summary>Optional details</summary>
              <div className="invite-form__grid">
                <FormField autoComplete="name" label="Full name, if different" maxLength={100} name="fullName" onChange={set("fullName")} optional value={f.fullName} />
                <FormField label="Pronouns" maxLength={40} name="pronouns" onChange={set("pronouns")} optional value={f.pronouns} />
                <FormField error={errors.website} inputMode="url" label="Website" maxLength={200} name="website" onChange={set("website")} optional type="url" value={f.website} />
                <FormField label="Other social platforms" maxLength={300} name="otherSocials" onChange={set("otherSocials")} optional value={f.otherSocials} />
              </div>
            </details>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Chips error={errors.genres} legend="What best describes your sound?" name="genres" onChange={set("genres")} options={GENRES} value={f.genres} />
            {f.genres.includes("other") ? <FormField label="Other — tell us" maxLength={80} name="genreOther" onChange={set("genreOther")} optional value={f.genreOther} /> : null}
            <FormField
              error={errors.selectionStyle}
              hint="Tell us about the records you love, the moods you create and what makes your selections yours."
              label="Tell us about your selection style"
              maxLength={1500}
              multiline
              name="selectionStyle"
              onChange={set("selectionStyle")}
              rows={6}
              value={f.selectionStyle}
              wordLimit={200}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="apply__note">Share links only. Please don’t send audio files: SoundCloud, Mixcloud, YouTube or any public link is perfect.</p>
            <FormField error={errors.mixUrl} hint="A DJ mix or recorded set we can listen to." inputMode="url" label="Link to a mix or recorded set" maxLength={500} name="mixUrl" onChange={set("mixUrl")} placeholder="https://" type="url" value={f.mixUrl} />
            <FormField error={errors.mixUrl2} inputMode="url" label="Another mix" maxLength={500} name="mixUrl2" onChange={set("mixUrl2")} optional placeholder="https://" type="url" value={f.mixUrl2} />
            <FormField label="Which mix best represents your sound, and why?" maxLength={800} multiline name="mixWhy" onChange={set("mixWhy")} optional rows={4} value={f.mixWhy} />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="apply__note">Some starting points, not formats you have to follow:</p>
            <ul className="apply__ideas">
              {IDEAS.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <FormField error={errors.sessionConcept} label="What kind of ROUGE Radio session would you like to create?" maxLength={1200} multiline name="sessionConcept" onChange={set("sessionConcept")} rows={5} value={f.sessionConcept} wordLimit={150} />
            <FormField label="What would make your session different?" maxLength={800} multiline name="sessionDifferent" onChange={set("sessionDifferent")} optional rows={3} value={f.sessionDifferent} />
            <div className="invite-form__grid">
              <FormField label="Proposed session title" maxLength={100} name="sessionTitle" onChange={set("sessionTitle")} optional value={f.sessionTitle} />
              <FormField hint="We’ll confirm lengths with selected applicants." label="Preferred mix length" maxLength={40} name="mixLength" onChange={set("mixLength")} optional placeholder="e.g. 60 minutes" value={f.mixLength} />
            </div>
            <Choice legend="How do you play?" name="performance" onChange={set("performance")} optional options={PERFORMANCE} value={f.performance} />
            <Choice legend="Can you record a clean audio set?" name="canRecord" onChange={set("canRecord")} optional options={CAN_RECORD} value={f.canRecord} />
            <FormField label="Any technical considerations?" maxLength={600} multiline name="technicalNotes" onChange={set("technicalNotes")} optional rows={3} value={f.technicalNotes} />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div className="invite-form__grid">
              <FormField label="How did you discover ROUGE?" maxLength={200} name="discovery" onChange={set("discovery")} optional value={f.discovery} />
            </div>
            <FormField label="Any links or anything else we should know?" maxLength={800} multiline name="extra" onChange={set("extra")} optional rows={3} value={f.extra} />
            <div className="apply__acks">
              <Check checked={f.contactOk} error={errors.contactOk} name="contactOk" onChange={set("contactOk")}>
                I’m happy for ROUGE to contact me about my application.
              </Check>
              <fieldset className={`apply__ack-list ${errors.acknowledgements ? "pfield--error" : ""}`} data-field="acknowledgements">
                <legend className="pfield__label">Please confirm</legend>
                {ACKS.map(([k, label]) => (
                  <Check checked={f.acknowledgements.includes(k)} key={k} name={`ack-${k}`} onChange={(on) => set("acknowledgements")(on ? [...f.acknowledgements, k] : f.acknowledgements.filter((x) => x !== k))}>
                    {label}
                  </Check>
                ))}
                {errors.acknowledgements ? (
                  <p className="pfield__error" role="alert">
                    {errors.acknowledgements}
                  </p>
                ) : null}
              </fieldset>
              <div className="apply__optin">
                <Check checked={f.joinMembers} name="joinMembers" onChange={set("joinMembers")}>
                  Optional: also add me to ROUGE Members for news about gatherings and Radio. (Separate from your application. We’ll email you to confirm.)
                </Check>
              </div>
              <p className="apply__privacy">
                We use your details only to review your application and contact you about it. Read the <a href="/privacy">privacy notice</a>.
              </p>
            </div>
          </>
        ) : null}
      </div>

      <div aria-hidden="true" className="hp">
        <label>
          Company <input autoComplete="off" onChange={(e) => setCompany(e.target.value)} tabIndex={-1} value={company} />
        </label>
      </div>

      {message ? (
        <p className="signup__error" role="alert">
          {message}
        </p>
      ) : null}

      <div className="apply__nav">
        {step > 0 ? (
          <button className="button button--ghost" onClick={() => go(step - 1)} type="button">
            <Arrow direction="left" />
            <span>Back</span>
          </button>
        ) : (
          <button className="apply__reset" onClick={clearDraft} type="button">
            Start again
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button className="button" onClick={next} type="button">
            <span>Next: {STEPS[step + 1].title}</span>
            <Arrow />
          </button>
        ) : (
          <button className="button" disabled={status === "sending"} type="submit">
            <span>{status === "sending" ? "Sending…" : "Submit your sound"}</span>
            <Arrow />
          </button>
        )}
      </div>
    </form>
  )
}

export default function RadioApply() {
  useReveal()
  return (
    <>
      <section aria-labelledby="apply-title" className="apply-hero">
        <p className="apply-hero__cat" aria-hidden="true">
          RGE — RADIO · GUEST SELECTORS
        </p>
        <Label>ROUGE Radio — guest selector applications</Label>
        <h1 className="apply-hero__title" id="apply-title">
          Your sound. <em>Our frequency.</em>
        </h1>
        <div className="apply-hero__copy">
          <p className="apply-hero__lede">ROUGE Radio is building a home for carefully selected sounds and the people behind them.</p>
          <p>From R&amp;B and soul to house, garage, amapiano and everything in between, we’re looking for selectors with something to say through music.</p>
          <p>Think your sound belongs here? We’d love to hear it.</p>
        </div>
        <div className="apply-hero__actions">
          <a className="button" href="#apply">
            <span>Submit your sound</span>
            <Arrow direction="down" />
          </a>
        </div>
        <p className="apply-hero__note">
          <strong>For ROUGE Radio only.</strong> This is for guest mixes and Radio sessions. It isn’t an application to DJ at ROUGE 002 or any other event.
        </p>
      </section>

      <section aria-label="How it works" className="apply-how">
        <ol>
          <li data-reveal>
            <span>01</span>
            <h2>Share your sound</h2>
            <p>A few details, a mix link and the session you’d create. Around 3–5 minutes.</p>
          </li>
          <li data-reveal>
            <span>02</span>
            <h2>We listen</h2>
            <p>Every application is heard by a person. ROUGE Radio hasn’t announced a schedule yet, so there’s no fixed timeline.</p>
          </li>
          <li data-reveal>
            <span>03</span>
            <h2>If there’s a fit</h2>
            <p>We’ll get in touch to shape a session together. Applying doesn’t guarantee selection.</p>
          </li>
        </ol>
      </section>

      <section aria-label="Application form" className="apply-wrap" id="apply">
        <ApplyForm />
      </section>
    </>
  )
}
