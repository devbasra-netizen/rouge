import { FormEvent, useEffect, useRef, useState } from "react"
import { Arrow, Label, useReveal } from "../components"
import { siteConfig } from "../config"
import { Check, Chips, Errors, FormField, focusFirstError, offlineMessage, postJson } from "../forms"

export const MUSIC = { rnb: "R&B", soul: "Soul / neo-soul", house: "House", garage: "UK garage", amapiano: "Amapiano", hiphop: "Hip-hop", other: "Other" }
export const TOPICS = { events: "ROUGE events", radio: "ROUGE Radio" }
export const CONSENT_TEXT = "Yes, email me about ROUGE gatherings, ROUGE Radio and what’s taking shape. I can unsubscribe at any time."

const NOW = [
  ["First to hear about ROUGE 002", "Date, room and tickets reach members before anyone else."],
  ["Gathering announcements", "Every ROUGE night, told to you first."],
  ["ROUGE Radio updates", "When the first session goes on air, you’ll know."],
]
const LATER = [
  ["Selected music and mixes", "Sounds from the ROUGE booth, once Radio is live."],
  ["Community opportunities", "Ways to be part of what we build next."],
  ["Early-access invitations", "Only when we explicitly offer them."],
]

function JoinForm() {
  const [v, setV] = useState({ firstName: "", email: "", instagram: "", location: "" })
  const [interests, setInterests] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [consent, setConsent] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle")
  const [message, setMessage] = useState("")
  const [company, setCompany] = useState("")
  const started = useRef(Date.now())
  const doneRef = useRef<HTMLDivElement>(null)
  const set = (k: keyof typeof v) => (x: string) => {
    setV((s) => ({ ...s, [k]: x }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }))
  }

  function check(): Errors {
    const e: Errors = {}
    if (!v.firstName.trim()) e.firstName = "Please tell us your first name."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = "Please enter a valid email address."
    if (v.instagram.trim() && !/^@?[A-Za-z0-9._]{1,30}$/.test(v.instagram.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, ""))) e.instagram = "That doesn’t look like an Instagram username."
    if (!privacy) e.privacy = "Please confirm you’ve read the privacy notice."
    return Object.fromEntries(Object.entries(e).filter(([, x]) => x))
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (status === "sending") return
    setMessage("")
    const e = check()
    setErrors(e)
    if (Object.keys(e).length) return focusFirstError(e)
    setStatus("sending")
    try {
      await postJson("/api/members", { ...v, interests, topics, marketingConsent: consent, privacyAccepted: privacy, source: "rouge-london.com/members", company, elapsed: Date.now() - started.current })
      setStatus("done")
      requestAnimationFrame(() => {
        doneRef.current?.scrollIntoView({ block: "start" })
        doneRef.current?.focus({ preventScroll: true })
      })
    } catch (err) {
      const field = (err as { field?: string }).field
      if (field) {
        setErrors({ [field]: (err as Error).message })
        focusFirstError({ [field]: "x" })
      } else setMessage(offlineMessage(err))
      setStatus("idle")
    }
  }

  if (status === "done") {
    return (
      <div className="welcome" ref={doneRef} role="status" tabIndex={-1}>
        <span aria-hidden="true" className="welcome__seal">
          R
        </span>
        <Label>Membership · free</Label>
        <h2 className="welcome__title">Welcome to ROUGE.</h2>
        <p className="welcome__lede">You’re part of the world now.</p>
        <p>We’ll be in touch when there’s something worth sharing.</p>
        <div className="welcome__next">
          <p className="welcome__step">One last step</p>
          <p>
            We’ve sent a link to <strong>{v.email.trim()}</strong>. Tap it to confirm your email and complete your membership. If it isn’t there in a few minutes,
            check spam or promotions.
          </p>
        </div>
        <div className="welcome__links">
          <a className="text-link" href="/archive">
            See the Archive <Arrow />
          </a>
          <a className="text-link" href="/radio">
            ROUGE Radio <Arrow />
          </a>
        </div>
      </div>
    )
  }

  return (
    <form aria-busy={status === "sending"} className="invite-form" noValidate onSubmit={submit}>
      <div className="invite-form__grid">
        <FormField autoComplete="given-name" error={errors.firstName} label="First name" maxLength={60} name="firstName" onChange={set("firstName")} value={v.firstName} />
        <FormField autoComplete="email" error={errors.email} inputMode="email" label="Email" maxLength={254} name="email" onChange={set("email")} type="email" value={v.email} />
        <FormField autoComplete="off" error={errors.instagram} label="Instagram" maxLength={60} name="instagram" onChange={set("instagram")} optional placeholder="yourname" prefix="@" value={v.instagram} />
        <FormField autoComplete="address-level2" label="Area or city" maxLength={80} name="location" onChange={set("location")} optional placeholder="e.g. Peckham, Manchester" value={v.location} />
      </div>
      <Chips legend="Music you love" name="interests" onChange={setInterests} optional options={MUSIC} value={interests} />
      <Chips legend="Tell me about" name="topics" onChange={setTopics} optional options={TOPICS} value={topics} />
      <div className="invite-form__consents">
        <Check checked={consent} name="consent" onChange={setConsent}>
          {CONSENT_TEXT}
        </Check>
        <Check checked={privacy} error={errors.privacy} name="privacy" onChange={(x) => { setPrivacy(x); if (x) setErrors((e) => ({ ...e, privacy: "" })) }}>
          I’ve read the <a href="/privacy">privacy notice</a>.
        </Check>
      </div>
      <div aria-hidden="true" className="hp">
        <label>
          Company <input autoComplete="off" onChange={(e) => setCompany(e.target.value)} tabIndex={-1} value={company} />
        </label>
      </div>
      <button className="button invite-form__submit" disabled={status === "sending"} type="submit">
        <span>{status === "sending" ? "Joining…" : "Join ROUGE"}</span>
        <Arrow />
      </button>
      {message ? (
        <p className="signup__error" role="alert">
          {message}
        </p>
      ) : null}
      <p className="invite-form__note">Free, always. We’ll email you a link to confirm. Without the first tick we won’t send you news, only that confirmation.</p>
    </form>
  )
}

export default function Members() {
  useReveal()
  return (
    <>
      <section aria-labelledby="members-title" className="members-hero">
        <picture className="members-hero__photo">
          <img alt="" fetchPriority="high" src="/assets/001/10-sm.jpg" />
        </picture>
        <div aria-hidden="true" className="members-hero__shade" />
        <div className="members-hero__body">
          <Label>ROUGE Members · free to join</Label>
          <h1 className="members-hero__title" id="members-title">
            Become part of <em>ROUGE.</em>
          </h1>
          <p className="members-hero__lede">Good music. Good people. More to come.</p>
          <p className="members-hero__text">
            Join our community and be first to hear about upcoming gatherings, selected sounds, ROUGE Radio and everything taking shape behind the scenes.
          </p>
          <a className="button" href="#join">
            <span>Join the community</span>
            <Arrow direction="down" />
          </a>
        </div>
      </section>

      <section aria-labelledby="benefits-title" className="benefits">
        <div className="benefits__head">
          <Label>What membership means</Label>
          <h2 data-reveal id="benefits-title">
            An invitation, not a subscription.
          </h2>
          <p data-reveal>No fees, no tiers. Here’s what members get today, and what we’re building towards.</p>
        </div>
        <div className="benefits__cols">
          <div data-reveal>
            <p className="benefits__tag benefits__tag--now">Now</p>
            <ul>
              {NOW.map(([t, d]) => (
                <li key={t}>
                  <strong>{t}</strong>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal>
            <p className="benefits__tag">Coming soon</p>
            <ul>
              {LATER.map(([t, d]) => (
                <li key={t}>
                  <strong>{t}</strong>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="join-title" className="join" id="join">
        <div className="join__card">
          <div className="join__head">
            <p className="join__cat" aria-hidden="true">
              RGE — MEMBERS
            </p>
            <h2 className="join__title" id="join-title">
              Join ROUGE
            </h2>
            <p>Two fields to start. The rest only if you’d like to tell us more.</p>
          </div>
          <JoinForm />
        </div>
      </section>
    </>
  )
}

// ---------- /members/confirm ----------

export function MembersConfirm() {
  const [state, setState] = useState<"working" | "done" | "error">("working")
  const [info, setInfo] = useState<{ firstName?: string; consented?: boolean; prefs?: string; error?: string }>({})
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    postJson("/api/members/confirm", { u: q.get("u"), n: q.get("n"), t: q.get("t") })
      .then((r) => {
        setInfo(r as typeof info)
        setState("done")
        window.history.replaceState(null, "", "/members/confirm")
      })
      .catch((e) => {
        setInfo({ error: offlineMessage(e) })
        setState("error")
      })
  }, [])
  return (
    <section aria-live="polite" className="members-status">
      {state === "working" ? (
        <>
          <Label>ROUGE Members</Label>
          <h1>Confirming…</h1>
        </>
      ) : state === "done" ? (
        <div className="welcome welcome--page">
          <span aria-hidden="true" className="welcome__seal">
            R
          </span>
          <Label>Email confirmed</Label>
          <h1 className="welcome__title">Welcome to ROUGE{info.firstName ? `, ${info.firstName}` : ""}.</h1>
          <p className="welcome__lede">You’re part of the world now.</p>
          <p>{info.consented ? "We’ll be in touch when there’s something worth sharing. A welcome note is on its way." : "You’ve chosen not to receive news by email. You can change that any time from your preferences."}</p>
          <div className="welcome__links">
            {info.prefs ? (
              <a className="text-link" href={info.prefs.replace(/^https?:\/\/[^/]+/, "")}>
                Your preferences <Arrow />
              </a>
            ) : null}
            <a className="text-link" href="/archive">
              See the Archive <Arrow />
            </a>
          </div>
        </div>
      ) : (
        <>
          <Label>ROUGE Members</Label>
          <h1>That link didn’t work.</h1>
          <p>{info.error}</p>
          <a className="text-link" href="/members#join">
            Join again <Arrow />
          </a>
        </>
      )}
    </section>
  )
}

// ---------- /members/preferences ----------

type Prefs = { firstName: string; email: string; instagram: string | null; location: string | null; interests: string[]; topics: string[]; marketing: boolean; memberId?: string }

export function MembersPreferences() {
  const q = new URLSearchParams(window.location.search)
  const auth = { u: q.get("u"), t: q.get("t") }
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState("")
  const [busy, setBusy] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [deleted, setDeleted] = useState(false)
  useEffect(() => {
    fetch(`/api/members/preferences?u=${encodeURIComponent(auth.u || "")}&t=${encodeURIComponent(auth.t || "")}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "This link isn’t valid.")
        setPrefs({ ...d.prefs, instagram: d.prefs.instagram ? d.prefs.instagram.replace(/^@/, "") : "" })
      })
      .catch((e) => setError(e.message))
  }, [])
  if (deleted)
    return (
      <section className="members-status">
        <Label>ROUGE Members</Label>
        <h1>Deleted.</h1>
        <p>Your membership and everything we held about it have been removed. Thank you for being here.</p>
        <a className="text-link" href="/">
          Back to ROUGE <Arrow />
        </a>
      </section>
    )
  if (error)
    return (
      <section className="members-status">
        <Label>ROUGE Members</Label>
        <h1>That link didn’t work.</h1>
        <p>{error} Use the link in your most recent ROUGE email, or email {siteConfig.links.contact}.</p>
      </section>
    )
  if (!prefs)
    return (
      <section className="members-status">
        <Label>ROUGE Members</Label>
        <h1>Loading…</h1>
      </section>
    )
  const set = (k: keyof Prefs) => (x: unknown) => {
    setSaved("")
    setPrefs((p) => (p ? { ...p, [k]: x } : p))
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!prefs) return
    setBusy(true)
    try {
      await postJson("/api/members/preferences", { ...auth, ...prefs })
      setSaved(prefs.marketing ? "Saved. You’ll hear from us when there’s something worth sharing." : "Saved. You won’t receive ROUGE news by email.")
    } catch (err) {
      setSaved(offlineMessage(err))
    }
    setBusy(false)
  }
  async function erase() {
    setBusy(true)
    try {
      await postJson("/api/members/delete", { ...auth, confirm: confirmText.trim().toUpperCase() })
      setDeleted(true)
    } catch (err) {
      setSaved(offlineMessage(err))
      setBusy(false)
    }
  }
  return (
    <section className="prefs">
      <Label>ROUGE Members{prefs.memberId ? ` · ${prefs.memberId}` : ""}</Label>
      <h1 className="prefs__title">Your preferences</h1>
      <p className="prefs__who">For {prefs.email}</p>
      <form className="invite-form" onSubmit={save}>
        <div className="invite-form__grid">
          <FormField autoComplete="given-name" label="First name" name="firstName" onChange={set("firstName")} value={prefs.firstName || ""} />
          <FormField label="Instagram" name="instagram" onChange={set("instagram")} optional prefix="@" value={prefs.instagram || ""} />
          <FormField label="Area or city" name="location" onChange={set("location")} optional value={prefs.location || ""} />
        </div>
        <Chips legend="Music you love" name="interests" onChange={set("interests")} optional options={MUSIC} value={prefs.interests} />
        <Chips legend="Tell me about" name="topics" onChange={set("topics")} optional options={TOPICS} value={prefs.topics} />
        <div className="invite-form__consents">
          <Check checked={prefs.marketing} name="marketing" onChange={set("marketing")}>
            {CONSENT_TEXT}
          </Check>
        </div>
        <button className="button" disabled={busy} type="submit">
          <span>{busy ? "Saving…" : "Save preferences"}</span>
          <Arrow />
        </button>
        {saved ? (
          <p className="prefs__saved" role="status">
            {saved}
          </p>
        ) : null}
      </form>
      <div className="prefs__danger">
        <h2>Delete my membership</h2>
        <p>This removes your details, preferences and consent history from ROUGE for good. Type DELETE to confirm.</p>
        <div className="prefs__delete">
          <input aria-label="Type DELETE to confirm" className="prefs__delete-input" onChange={(e) => setConfirmText(e.target.value)} value={confirmText} />
          <button className="button button--ghost" disabled={busy || confirmText.trim().toUpperCase() !== "DELETE"} onClick={erase} type="button">
            <span>Delete</span>
          </button>
        </div>
      </div>
    </section>
  )
}
