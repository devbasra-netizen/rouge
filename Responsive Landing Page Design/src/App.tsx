import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react"
import { siteConfig } from "./config"

type SignupStatus = "idle" | "submitting" | "success" | "error"

const past = siteConfig.pastEvent
const next = siteConfig.nextEvent
const photos = past.photos
const photoSrc = (file: string, small = false) => `/assets/001/${file}${small ? "-sm" : ""}.jpg`

function Arrow({ direction = "right" }: { direction?: "right" | "left" | "down" }) {
  return (
    <svg aria-hidden="true" className={`arrow arrow--${direction}`} viewBox="0 0 24 24">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

function Stamp({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`stamp ${className}`}>
      {past.stamp}
    </span>
  )
}

// ---------- header ----------

function SiteHeader() {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return (
    <header className={`site-header ${solid ? "site-header--solid" : ""}`}>
      <a aria-label="ROUGE home" className="site-header__mark" href="#top">
        ROUGE
      </a>
      <nav aria-label="Main" className="site-header__nav">
        <a href="#roll">ROLL {past.number}</a>
        <a href="#about">ABOUT</a>
      </nav>
      <a className="site-header__cta" href="#next">
        <span className="rec-dot" aria-hidden="true" /> HEAR FIRST
      </a>
    </header>
  )
}

// ---------- hero ----------

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="hero" id="top">
      <picture className="hero__photo">
        <source media="(max-width: 700px)" srcSet="/assets/001/hero-tall.jpg" />
        <img alt="" fetchPriority="high" src="/assets/001/hero-wide.jpg" />
      </picture>
      <div aria-hidden="true" className="hero__wash" />

      <div className="hero__meta">
        <span>ROLL {past.number}</span>
        <span>{past.date}</span>
        <span>
          {past.venue}, {past.area.split(",")[0].toUpperCase()}
        </span>
      </div>

      <div className="hero__content">
        <h1 className="hero__title" id="hero-title">
          ROUGE<span className="hero__dot">.</span>
        </h1>
        <p className="hero__tagline">{siteConfig.brand.tagline}.</p>
        <p className="hero__status">
          <span className="hero__status-past">#{past.number} happened.</span>{" "}
          <span className="hero__status-next">#{next.number} is coming.</span>
        </p>
        <div className="hero__actions">
          <a className="button" href="#next">
            <span>HEAR FIRST ABOUT #{next.number}</span>
            <Arrow />
          </a>
          <a className="button button--ghost" href="#roll">
            <span>SEE ROLL {past.number}</span>
          </a>
        </div>
      </div>

      <Stamp className="hero__stamp" />
    </section>
  )
}

// ---------- marquee ----------

function Marquee() {
  const words = [
    `ROUGE #${past.number}`,
    "THANK YOU BRIXTON",
    "DIFFERENT SOUNDS",
    "SAME FEELING",
    "R&B",
    "HOUSE",
    "SOUL",
    "DEEP CUTS",
    "ONE ROOM",
    `#${next.number} SOON`,
  ]
  const line = words.map((word) => (
    <span key={word}>
      {word}
      <i aria-hidden="true">✶</i>
    </span>
  ))
  return (
    <div aria-label={words.join(", ")} className="marquee" role="marquee">
      <div aria-hidden="true" className="marquee__track">
        <div>{line}</div>
        <div>{line}</div>
      </div>
    </div>
  )
}

// ---------- roll 001 (film strip + lightbox) ----------

function Lightbox({ index, onClose, onMove }: { index: number; onClose: () => void; onMove: (step: number) => void }) {
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
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose, onMove])

  return (
    <div
      aria-label={`Photo ${index + 1} of ${photos.length}`}
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
      <figure className="lightbox__frame">
        <img alt={photo.alt} key={photo.file} src={photoSrc(photo.file)} />
        <Stamp className="lightbox__stamp" />
        <figcaption>
          <span>
            {String(index + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
          </span>
          <span className="lightbox__alt">{photo.alt}</span>
        </figcaption>
      </figure>
      <button aria-label="Previous photo" className="lightbox__nav lightbox__nav--prev" onClick={() => onMove(-1)} type="button">
        <Arrow direction="left" />
      </button>
      <button aria-label="Next photo" className="lightbox__nav lightbox__nav--next" onClick={() => onMove(1)} type="button">
        <Arrow />
      </button>
      <button className="lightbox__close" onClick={onClose} ref={closeRef} type="button">
        CLOSE
      </button>
    </div>
  )
}

function Roll() {
  const stripRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<number | null>(null)
  const lastFocus = useRef<HTMLElement | null>(null)

  const close = useCallback(() => {
    setOpen(null)
    lastFocus.current?.focus()
  }, [])
  const move = useCallback((step: number) => {
    setOpen((current) => (current === null ? current : (current + step + photos.length) % photos.length))
  }, [])

  const scrollStrip = (direction: number) => {
    const strip = stripRef.current
    if (strip) strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: "smooth" })
  }

  return (
    <section aria-labelledby="roll-title" className="roll" id="roll">
      <div className="roll__head">
        <p className="kicker">
          <span>{past.name}</span>
          <span>
            {past.date} — {past.venue}, {past.area}
          </span>
        </p>
        <h2 id="roll-title">
          Roll <em>{past.number}</em>
        </h2>
        <p className="roll__lede">
          One room, one night, {past.sound}. Thank you to everyone who came and made it feel like this.
        </p>
      </div>

      <div className="film">
        <div className="film__edge film__edge--top" aria-hidden="true">
          <span>ROUGE 400</span>
          <span>▸ {past.number}</span>
          <span>BRIXTON</span>
          <span>{past.date}</span>
        </div>
        <div className="film__strip" ref={stripRef} tabIndex={0} aria-label="Photos from ROUGE #001, scroll sideways">
          {photos.map((photo, index) => (
            <button
              aria-label={`Open photo ${index + 1}: ${photo.alt}`}
              className={`frame ${photo.wide ? "frame--wide" : "frame--tall"}`}
              key={photo.file}
              onClick={(e) => {
                lastFocus.current = e.currentTarget
                setOpen(index)
              }}
              type="button"
            >
              <img alt="" decoding="async" loading={index < 3 ? "eager" : "lazy"} src={photoSrc(photo.file, true)} />
              <Stamp className="frame__stamp" />
              <span aria-hidden="true" className="frame__no">
                {index + 1}
                <i>A</i>
              </span>
            </button>
          ))}
          <a className="frame frame--end" href="#next">
            <span className="frame--end__num">#{next.number}</span>
            <span className="frame--end__text">Next roll loading. Hear first</span>
            <Arrow />
          </a>
        </div>
        <div className="film__edge film__edge--bottom" aria-hidden="true">
          <span>KEEP IN A COOL DARK PLACE</span>
          <span>{photos.length} EXP</span>
          <span>DIFFERENT SOUNDS · SAME FEELING</span>
        </div>
      </div>

      <div className="roll__controls">
        <p aria-hidden="true">Swipe the roll — tap a frame to open it</p>
        <div>
          <button aria-label="Scroll photos left" onClick={() => scrollStrip(-1)} type="button">
            <Arrow direction="left" />
          </button>
          <button aria-label="Scroll photos right" onClick={() => scrollStrip(1)} type="button">
            <Arrow />
          </button>
        </div>
      </div>

      {open !== null && <Lightbox index={open} onClose={close} onMove={move} />}
    </section>
  )
}

// ---------- about ----------

function About() {
  return (
    <section aria-labelledby="about-title" className="about" id="about">
      <figure className="about__photo">
        <img alt={photos[5].alt} decoding="async" loading="lazy" src={photoSrc(photos[5].file)} />
        <Stamp className="frame__stamp" />
      </figure>
      <div className="about__copy">
        <p className="kicker">
          <span>WHAT IS ROUGE</span>
        </p>
        <h2 id="about-title">
          An intimate music gathering <em>in London.</em>
        </h2>
        <p>
          ROUGE is a London-born music collective built around the feeling music creates. Small rooms, low light and records
          chosen with intention.
        </p>
        <p>
          A home for selectors, artists and people who listen beyond genre. R&amp;B and soul, house and garage, broken beat,
          jazz and everything in between.
        </p>
        <p className="about__sign">Different sounds. Same feeling.</p>
      </div>
    </section>
  )
}

// ---------- next / signup (same fields, consent wording and endpoint as before) ----------

function EmailSignup() {
  const emailId = useId()
  const nameId = useId()
  const consentId = useId()
  const [status, setStatus] = useState<SignupStatus>("idle")
  const [message, setMessage] = useState("")

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    setMessage("")
    const form = formEvent.currentTarget
    const formData = new FormData(form)
    setStatus("submitting")
    try {
      const response = await fetch(siteConfig.email.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          firstName: formData.get("firstName"),
          marketingConsent: formData.get("consent") === "on",
          source: siteConfig.email.source,
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
      setMessage(reason && reason.length < 120 ? reason : "We couldn’t add you just now. Please try again in a moment.")
    }
  }

  if (status === "success") {
    return (
      <div className="signup-success" role="status">
        <span className="kicker">
          <span>
            <span className="rec-dot" aria-hidden="true" /> YOU’RE ON THE LIST
          </span>
        </span>
        <p>You’ll hear about #{next.number} before anyone else.</p>
      </div>
    )
  }

  return (
    <form className="signup" onSubmit={handleSubmit}>
      <div className="signup__fields">
        <div className="field">
          <label htmlFor={nameId}>
            First name <span>(optional)</span>
          </label>
          <input autoComplete="given-name" id={nameId} maxLength={100} name="firstName" placeholder="First name" type="text" />
        </div>
        <div className="field">
          <label htmlFor={emailId}>Email address</label>
          <input
            autoComplete="email"
            id={emailId}
            inputMode="email"
            maxLength={254}
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </div>
      </div>
      <div className="signup__legal">
        <input id={consentId} name="consent" required type="checkbox" />
        <label htmlFor={consentId}>
          I agree to receive event news and marketing from ROUGE. Unsubscribe anytime.{" "}
          <a href="#privacy-policy">Privacy policy</a>.
        </label>
      </div>
      <button className="button button--block" disabled={status === "submitting"} type="submit">
        <span>{status === "submitting" ? "JOINING…" : `HEAR FIRST ABOUT #${next.number}`}</span>
        <Arrow />
      </button>
      {status === "error" && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}

function Next() {
  const confirmed = Boolean(next.date && next.venue)
  return (
    <section aria-labelledby="next-title" className="next" id="next">
      <div className="next__signal">
        <p className="kicker">
          <span>
            <span className="rec-dot" aria-hidden="true" /> NEXT TRANSMISSION
          </span>
        </p>
        <h2 className="next__number" id="next-title">
          <span className="visually-hidden">ROUGE </span>#{next.number}
        </h2>
        <dl className="next__facts">
          <div>
            <dt>Date</dt>
            <dd>{next.date || "Soon"}</dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>{next.venue || "Somewhere in London"}</dd>
          </div>
          <div>
            <dt>First to know</dt>
            <dd>The list</dd>
          </div>
        </dl>
      </div>
      <div className="next__form">
        <p className="next__lede">
          {confirmed ? "Join the list for first access and the occasional note from ROUGE." : "The date and the room are still under wraps. Join the list and you’ll be first to know when and where."}
        </p>
        <EmailSignup />
      </div>
    </section>
  )
}

// ---------- footer ----------

function Footer() {
  return (
    <footer className="site-footer">
      <p aria-hidden="true" className="site-footer__mark">
        ROUGE<span>.</span>
      </p>
      <div className="site-footer__row">
        <p>{siteConfig.brand.philosophy}</p>
        <ul>
          <li>
            <a href={siteConfig.links.instagram} rel="noreferrer" target="_blank">
              Instagram {siteConfig.links.instagramHandle}
            </a>
          </li>
          <li>
            <a href={`mailto:${siteConfig.links.contact}`}>{siteConfig.links.contact}</a>
          </li>
        </ul>
      </div>

      <section aria-labelledby="privacy-title" className="privacy" id="privacy-policy">
        <h2 id="privacy-title">Privacy policy</h2>
        <p>
          If you join our list we keep your email address, your first name if you give it, and a record of when you agreed to
          hear from us. We use these only to send ROUGE event news and marketing. Emails are delivered through our email
          provider, Resend. We do not sell or share your details with anyone else.
        </p>
        <p>
          You can unsubscribe at any time using the link in any of our emails. To see or delete the information we hold about
          you, email <a href={`mailto:${siteConfig.links.contact}`}>{siteConfig.links.contact}</a>. We keep your details until
          you unsubscribe or ask us to delete them. If you’re in one of our photos and would like it taken down, email us and
          we’ll remove it.
        </p>
      </section>

      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} ROUGE London</p>
        <a href="#privacy-policy">Privacy</a>
        <a className="site-footer__admin" href={siteConfig.links.admin} rel="nofollow">
          Admin sign in
        </a>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#roll">
        Skip to photos
      </a>
      <div aria-hidden="true" className="grain" />
      <SiteHeader />
      <main>
        <Hero />
        <Marquee />
        <Roll />
        <About />
        <Next />
      </main>
      <Footer />
    </>
  )
}
