import { FormEvent, ReactNode, useCallback, useEffect, useId, useRef, useState } from "react"
import { Photo, photoSrc, photoSrcSet, siteConfig } from "./config"

const { links } = siteConfig

// ---------- small pieces ----------

export function Arrow({ direction = "right" }: { direction?: "right" | "left" | "down" | "up-right" }) {
  return (
    <svg aria-hidden="true" className={`arrow arrow--${direction}`} viewBox="0 0 24 24">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`label ${className}`}>{children}</p>
}

// Adds .is-in to [data-reveal] elements as they scroll into view. Without IntersectionObserver,
// or with reduced motion, everything is shown straight away.
export function useReveal(dep?: unknown) {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)"))
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in")
            io.unobserve(entry.target)
          }
        })
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [dep])
}

export function Picture({
  photo,
  sizes,
  eager = false,
  className = "",
}: {
  photo: Photo
  sizes: string
  eager?: boolean
  className?: string
}) {
  return (
    <img
      alt={photo.alt}
      className={className}
      decoding="async"
      height={photo.height}
      loading={eager ? "eager" : "lazy"}
      sizes={sizes}
      src={photoSrc(photo)}
      srcSet={photoSrcSet(photo)}
      width={photo.width}
    />
  )
}

// ---------- header ----------

export function SiteHeader({ current }: { current: "home" | "archive" | "radio" | "other" }) {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const item = (href: string, label: string, key: string) => (
    <a aria-current={current === key ? "page" : undefined} href={href}>
      {label}
    </a>
  )

  return (
    <header className={`site-header ${solid ? "site-header--solid" : ""}`}>
      <a aria-label="ROUGE, home" className="site-header__mark" href="/">
        ROUGE
      </a>
      <nav aria-label="Main" className="site-header__nav">
        {item("/archive", "Archive", "archive")}
        {item("/radio", "Radio", "radio")}
        <a className="site-header__close" href="/#stay-close">
          Stay close
        </a>
      </nav>
    </header>
  )
}

// ---------- signup (same fields, consent wording and endpoint as the original form) ----------

type SignupStatus = "idle" | "submitting" | "success" | "error"

export function Signup({
  source = siteConfig.email.source,
  button = "Be first to know",
  successTitle = "You’re on the list.",
  successText = "When the next room opens, you’ll hear before anyone else.",
}: {
  source?: string
  button?: string
  successTitle?: string
  successText?: string
}) {
  const emailId = useId()
  const nameId = useId()
  const consentId = useId()
  const errorId = useId()
  const [status, setStatus] = useState<SignupStatus>("idle")
  const [message, setMessage] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === "submitting") return
    setMessage("")
    const form = event.currentTarget
    const data = new FormData(form)
    setStatus("submitting")
    try {
      const response = await fetch(siteConfig.email.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          firstName: data.get("firstName"),
          marketingConsent: data.get("consent") === "on",
          source,
        }),
      })
      if (!response.ok) {
        let reason = ""
        try {
          reason = (await response.json()).error || ""
        } catch {}
        throw new Error(reason)
      }
      form.reset()
      setStatus("success")
    } catch (error) {
      setStatus("error")
      const reason = error instanceof Error ? error.message : ""
      setMessage(
        reason && reason.length < 120
          ? reason
          : navigator.onLine === false
            ? "You seem to be offline. Check your connection and try again."
            : "That didn’t go through. Please try again in a moment.",
      )
    }
  }

  if (status === "success") {
    return (
      <div className="signup-done" role="status">
        <span aria-hidden="true" className="signup-done__mark" />
        <p className="signup-done__title">{successTitle}</p>
        <p className="signup-done__text">{successText}</p>
      </div>
    )
  }

  return (
    <form aria-busy={status === "submitting"} className="signup" noValidate={false} onSubmit={handleSubmit}>
      <div className="signup__row">
        <div className="field">
          <label htmlFor={nameId}>
            First name <span>optional</span>
          </label>
          <input autoComplete="given-name" id={nameId} maxLength={100} name="firstName" type="text" />
        </div>
        <div className="field field--email">
          <label htmlFor={emailId}>Email</label>
          <input
            aria-describedby={status === "error" ? errorId : undefined}
            autoComplete="email"
            id={emailId}
            inputMode="email"
            maxLength={254}
            name="email"
            required
            type="email"
          />
        </div>
      </div>
      <div className="signup__consent">
        <input id={consentId} name="consent" required type="checkbox" />
        <label htmlFor={consentId}>
          I agree to receive event news and marketing from ROUGE. Unsubscribe anytime.{" "}
          <a href="#privacy">Privacy policy</a>.
        </label>
      </div>
      <button className="button" disabled={status === "submitting"} type="submit">
        <span>{status === "submitting" ? "Adding you…" : button}</span>
        <Arrow />
      </button>
      {status === "error" && (
        <p className="signup__error" id={errorId} role="alert">
          {message}
        </p>
      )}
    </form>
  )
}

// ---------- photo viewer ----------

export function Lightbox({
  photos,
  index,
  onClose,
  onMove,
  caption,
}: {
  photos: readonly Photo[]
  index: number
  onClose: () => void
  onMove: (step: number) => void
  caption: string
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const touchX = useRef<number | null>(null)
  const photo = photos[index]

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") onMove(1)
      if (e.key === "ArrowLeft") onMove(-1)
    }
    document.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [onClose, onMove])

  // Preload the neighbours so swiping feels instant.
  useEffect(() => {
    ;[1, -1].forEach((step) => {
      const img = new Image()
      img.src = photoSrc(photos[(index + step + photos.length) % photos.length])
    })
  }, [index, photos])

  return (
    <div
      aria-label={`Photograph ${index + 1} of ${photos.length}`}
      aria-modal="true"
      className="lightbox"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 50) onMove(dx < 0 ? 1 : -1)
        touchX.current = null
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      role="dialog"
    >
      <div className="lightbox__top">
        <span>{caption}</span>
        <button className="lightbox__close" onClick={onClose} ref={closeRef} type="button">
          Close
        </button>
      </div>
      <figure className="lightbox__figure" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img alt={photo.alt} height={photo.height} key={photo.file} src={photoSrc(photo)} width={photo.width} />
        <figcaption>
          <span className="lightbox__count">
            {String(index + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
          </span>
          <span>{photo.alt}</span>
        </figcaption>
      </figure>
      <button aria-label="Previous photograph" className="lightbox__nav lightbox__nav--prev" onClick={() => onMove(-1)} type="button">
        <Arrow direction="left" />
      </button>
      <button aria-label="Next photograph" className="lightbox__nav lightbox__nav--next" onClick={() => onMove(1)} type="button">
        <Arrow />
      </button>
    </div>
  )
}

export function useLightbox(count: number) {
  const [open, setOpen] = useState<number | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const show = useCallback((index: number, from?: HTMLElement | null) => {
    opener.current = from ?? null
    setOpen(index)
  }, [])
  const close = useCallback(() => {
    setOpen(null)
    opener.current?.focus()
  }, [])
  const move = useCallback(
    (step: number) => setOpen((current) => (current === null ? current : (current + step + count) % count)),
    [count],
  )
  return { open, show, close, move }
}

// ---------- the radio dial (visual only: nothing is broadcasting yet) ----------

const STATIONS = [
  { f: 88.8, name: "Deep cuts" },
  { f: 91.6, name: "Neo-soul, slow" },
  { f: 94.4, name: "Soulful house" },
  { f: 97.2, name: "Garage after dark" },
  { f: 100.4, name: "Amapiano" },
  { f: 103.2, name: "Hip-hop, sampled" },
  { f: 106.4, name: "Late-night R&B" },
]
const MIN = 87.5
const MAX = 108

export function RadioDial({ large = false }: { large?: boolean }) {
  const id = useId()
  const [freq, setFreq] = useState(97.2)
  const pct = ((freq - MIN) / (MAX - MIN)) * 100
  const nearest = STATIONS.reduce((a, b) => (Math.abs(b.f - freq) < Math.abs(a.f - freq) ? b : a))
  const tuned = Math.abs(nearest.f - freq) <= 0.4

  const ticks = []
  for (let f = 88; f <= 108; f += 0.5) ticks.push(f)

  return (
    <div className={`dial ${large ? "dial--large" : ""} ${tuned ? "dial--tuned" : ""}`}>
      <div className="dial__window">
        <div className="dial__readout">
          <span className="dial__freq">{freq.toFixed(1)}</span>
          <span className="dial__unit">MHz</span>
        </div>
        <div aria-live="polite" className="dial__station">
          <span className="dial__band">{tuned ? nearest.name : "Between stations"}</span>
          <span className="dial__status">
            <span aria-hidden="true" className="dial__lamp" /> Off air · coming soon
          </span>
        </div>
        <svg aria-hidden="true" className="dial__wave" preserveAspectRatio="none" viewBox="0 0 400 40">
          <path className="dial__wave-line" d={wavePath(tuned)} />
        </svg>
      </div>

      <div className="dial__band-scale" style={{ ["--needle" as string]: `${pct}%` }}>
        <div aria-hidden="true" className="dial__ticks">
          {ticks.map((f) => (
            <span
              className={Number.isInteger(f) && f % 4 === 0 ? "major" : Number.isInteger(f) ? "minor" : ""}
              key={f}
              style={{ left: `${((f - MIN) / (MAX - MIN)) * 100}%` }}
            >
              {Number.isInteger(f) && f % 4 === 0 ? <i>{f}</i> : null}
            </span>
          ))}
        </div>
        <div aria-hidden="true" className="dial__stations">
          {STATIONS.map((s) => (
            <span key={s.f} style={{ left: `${((s.f - MIN) / (MAX - MIN)) * 100}%` }} />
          ))}
        </div>
        <span aria-hidden="true" className="dial__needle" />
        <label className="visually-hidden" htmlFor={id}>
          Tune the ROUGE Radio dial
        </label>
        <input
          aria-valuetext={`${freq.toFixed(1)} megahertz, ${tuned ? nearest.name : "between stations"}, not broadcasting yet`}
          className="dial__input"
          id={id}
          max={MAX}
          min={MIN}
          onChange={(e) => setFreq(Number(e.target.value))}
          step={0.1}
          type="range"
          value={freq}
        />
      </div>
      <p className="dial__hint">Drag to tune. Nothing is on air yet; these are the frequencies we’re building.</p>
    </div>
  )
}

// A near-flat line with a little static. Tuned to a "station" it settles into a slower, wider shape.
function wavePath(tuned: boolean) {
  let d = "M0 20"
  for (let x = 4; x <= 400; x += 4) {
    const noise = Math.sin(x * 12.9898) * 43758.5453
    const n = (noise - Math.floor(noise) - 0.5) * (tuned ? 3 : 9)
    const shape = tuned ? Math.sin(x / 18) * 5 * Math.sin(x / 140) : 0
    d += ` L${x} ${(20 + n + shape).toFixed(1)}`
  }
  return d
}

// ---------- footer ----------

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <a aria-label="ROUGE, home" className="site-footer__mark" href="/">
          ROUGE
        </a>
        <p className="site-footer__line">For the love of the sound.</p>
      </div>

      <div className="site-footer__grid">
        <div>
          <Label>Explore</Label>
          <ul>
            <li>
              <a href="/archive">The Archive — 001</a>
            </li>
            <li>
              <a href="/radio">ROUGE Radio</a>
            </li>
            <li>
              <a href="/#stay-close">Mailing list</a>
            </li>
          </ul>
        </div>
        <div>
          <Label>Follow</Label>
          <ul>
            <li>
              <a href={links.instagram} rel="noreferrer" target="_blank">
                Instagram {links.instagramHandle}
              </a>
            </li>
            <li>
              <a href={links.dj} rel="noreferrer" target="_blank">
                DJ Dev {links.djHandle}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <Label>Contact</Label>
          <ul>
            <li>
              <a href={`mailto:${links.contact}`}>{links.contact}</a>
            </li>
            <li>
              <a href="/">{links.website}</a>
            </li>
          </ul>
        </div>
      </div>

      <section aria-labelledby="privacy-title" className="privacy" id="privacy">
        <h2 id="privacy-title">Privacy</h2>
        <p>
          If you join our list we keep your email address, your first name if you give it, and a record of when you agreed to
          hear from us. We use these only to send ROUGE news and invitations, delivered through our email provider, Resend. We
          never sell or share your details.
        </p>
        <p>
          Every email has an unsubscribe link. To see or delete what we hold about you, or to ask for a photo of you to be
          taken down, email <a href={`mailto:${links.contact}`}>{links.contact}</a>. We keep your details until you
          unsubscribe or ask us to delete them.
        </p>
      </section>

      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} ROUGE London</p>
        <a href="#privacy">Privacy</a>
        <a className="site-footer__admin" href={links.admin} rel="nofollow">
          Admin sign in
        </a>
      </div>
    </footer>
  )
}
