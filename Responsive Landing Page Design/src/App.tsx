import { FormEvent, useEffect, useId, useState } from "react"
import { siteConfig } from "./config"

type SignupStatus = "idle" | "submitting" | "success" | "error"
type EventPhase = "upcoming" | "live" | "past"

const event = siteConfig.event
const START = Date.parse(event.startsAt)
const END = Date.parse(event.endsAt)

function phaseAt(now: number): EventPhase {
  if (now < START) return "upcoming"
  if (now < END) return "live"
  return "past"
}

// Ticks once a second while the countdown is showing; settles once the event is over.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (now >= END) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [now >= END])
  return now
}

function Wordmark({ as = "span", stop = false }: { as?: "h1" | "span"; stop?: boolean }) {
  const Tag = as
  return (
    <Tag className="wordmark">
      ROUGE{stop && <span className="wordmark__stop">.</span>}
    </Tag>
  )
}

function Arrow({ direction = "right" }: { direction?: "right" | "down" | "up-right" }) {
  return (
    <svg aria-hidden="true" className={`arrow arrow--${direction}`} viewBox="0 0 24 24">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

function TicketLink({ className = "button", label = "GET TICKETS" }: { className?: string; label?: string }) {
  return (
    <a className={className} href={event.ticketUrl} rel="noopener" target="_blank">
      <span>{label}</span>
      <Arrow />
    </a>
  )
}

// ---------- header ----------

function SiteHeader({ phase }: { phase: EventPhase }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header className={`site-header ${scrolled ? "site-header--solid" : ""}`}>
      <a aria-label="ROUGE home" className="site-header__mark" href="#top">
        <Wordmark />
      </a>
      <nav aria-label="Main" className="site-header__nav">
        <a href="#the-night">THE NIGHT</a>
        <a href="#the-collective">THE COLLECTIVE</a>
        <a href="#faq">FAQ</a>
        <a href="#join">JOIN</a>
      </nav>
      {phase !== "past" ? (
        <TicketLink className="site-header__cta" label="TICKETS" />
      ) : (
        <a className="site-header__cta" href="#join">
          <span>JOIN THE LIST</span>
          <Arrow />
        </a>
      )}
    </header>
  )
}

// ---------- countdown ----------

function Countdown({ now }: { now: number }) {
  const left = Math.max(0, START - now)
  const parts = [
    { label: "DAYS", value: Math.floor(left / 86_400_000) },
    { label: "HOURS", value: Math.floor(left / 3_600_000) % 24 },
    { label: "MINUTES", value: Math.floor(left / 60_000) % 60 },
    { label: "SECONDS", value: Math.floor(left / 1000) % 60 },
  ]
  return (
    <div className="countdown">
      <p className="countdown__label">
        DOORS IN <span aria-hidden="true">—</span> LONDON TIME
      </p>
      <ol aria-label="Time until doors open" className="countdown__units">
        {parts.map((part) => (
          <li key={part.label}>
            <span className="countdown__value">{String(part.value).padStart(2, "0")}</span>
            <span className="countdown__unit">{part.label}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---------- hero ----------

function Hero({ phase, now }: { phase: EventPhase; now: number }) {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero__media" aria-hidden="true">
        {siteConfig.media.heroVideo && (
          <video autoPlay loop muted playsInline poster={siteConfig.media.heroImage}>
            <source src={siteConfig.media.heroVideo} />
          </video>
        )}
      </div>
      <div className="hero__veil" />

      <div className="hero__content">
        <div className="hero__identity">
          <p className="eyebrow">{siteConfig.brand.tagline}</p>
          <h1 className="hero__wordmark" id="hero-title">
            <Wordmark stop />
          </h1>
          <p className="hero__philosophy">{siteConfig.brand.philosophy}</p>
        </div>

        <div className="hero__event">
          <p className="eyebrow eyebrow--accent">
            {phase === "upcoming" && "NEXT GATHERING"}
            {phase === "live" && "TONIGHT"}
            {phase === "past" && "OUR FIRST NIGHT"}
          </p>
          <p className="hero__event-name">{event.name}</p>
          <p className="hero__event-genres">{event.genres}</p>
          <dl className="hero__facts">
            <div>
              <dt>Date</dt>
              <dd>{event.shortDate}</dd>
            </div>
            <div>
              <dt>Venue</dt>
              <dd>
                {event.venue}, Brixton
              </dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{event.timeLabel}</dd>
            </div>
          </dl>

          {phase === "upcoming" && <Countdown now={now} />}
          {phase === "live" && <p className="hero__status">Doors are open. See you inside.</p>}
          {phase === "past" && (
            <p className="hero__status">Thank you to everyone who came to our first night.</p>
          )}

          <div className="hero__actions">
            {phase !== "past" ? (
              <TicketLink />
            ) : (
              <a className="button" href="#join">
                <span>HEAR ABOUT THE NEXT ONE</span>
                <Arrow />
              </a>
            )}
            <a className="button button--ghost" href="#the-collective">
              <span>EXPLORE ROUGE</span>
            </a>
          </div>
        </div>
      </div>

      <a aria-label="Read about the night" className="scroll-cue" href="#the-night">
        <Arrow direction="down" />
      </a>
    </section>
  )
}

// ---------- the night ----------

function TheNight({ phase }: { phase: EventPhase }) {
  return (
    <section className="night" id="the-night" aria-labelledby="night-title">
      <div className="night__intro">
        <p className="section-number">01 / THE NIGHT</p>
        <h2 id="night-title">
          {event.name}
          <span>{event.genres}</span>
        </h2>
        <p className="night__lede">
          Something new is beginning in Brixton. Our first gathering is a small room, good records and the feeling that comes
          from hearing something you love played properly.
        </p>
      </div>

      <div className="night__grid">
        <dl className="night__details">
          <div>
            <dt>Date</dt>
            <dd>{event.dateLabel}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>9 PM until late</dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>
              {event.venue}, {event.area}
              <a className="text-link" href={event.directionsUrl} rel="noopener" target="_blank">
                Directions <Arrow />
              </a>
            </dd>
          </div>
          <div>
            <dt>Music</dt>
            <dd>R&amp;B and house through the eras</dd>
          </div>
          <div>
            <dt>Room</dt>
            <dd>Intimate, {event.capacity} people</dd>
          </div>
          <div>
            <dt>Tickets</dt>
            <dd>
              {phase === "past" ? (
                "This event has finished"
              ) : (
                <a className="text-link" href={event.ticketUrl} rel="noopener" target="_blank">
                  Via DICE <Arrow />
                </a>
              )}
            </dd>
          </div>
        </dl>

        <div className="night__expect">
          <h3>What to expect</h3>
          <ol>
            <li>
              <span>i.</span>
              <p>
                <strong>The sound.</strong> R&amp;B and house across the 90s, 00s, 10s and now. Classics, deep cuts and the
                soulful records in between.
              </p>
            </li>
            <li>
              <span>ii.</span>
              <p>
                <strong>The room.</strong> A low-lit bar, not a big club. Space to dance, space to talk, music at the centre.
              </p>
            </li>
            <li>
              <span>iii.</span>
              <p>
                <strong>The people.</strong> The first faces on the ROUGE list, and the friends they bring.
              </p>
            </li>
          </ol>
        </div>
      </div>

      <div className="selector">
        <p className="section-number">ON THE DECKS</p>
        <div className="selector__body">
          <p className="selector__name">{event.selector}</p>
          <p className="selector__role">Founder &amp; curator, ROUGE</p>
          <p className="selector__bio">
            Dev started ROUGE to build a home for selectors and people who listen beyond genre. For #001 he’s tracing R&amp;B
            and house through the eras: the records that shaped the sound, and the ones you forgot you loved.
          </p>
        </div>
        {phase !== "past" && <TicketLink className="button button--wide" label={`GET TICKETS FOR ${event.name}`} />}
      </div>
    </section>
  )
}

// ---------- the sound ----------

const SOUNDS = [
  "R&B",
  "Neo-soul",
  "Soul",
  "Jazz",
  "House",
  "Soulful house",
  "UK garage",
  "Broken beat",
  "Hip-hop",
  "Amapiano",
  "Electronic",
  "Global sounds",
]

function TheSound() {
  return (
    <section className="sound" aria-labelledby="sound-title">
      <div className="sound__copy">
        <p className="section-number">02 / THE SOUND</p>
        <h2 id="sound-title">
          DIFFERENT SOUNDS.
          <br />
          SAME FEELING.
        </h2>
        <p className="sound__body">
          Rooted in soul, rhythm and discovery. Genres are where we start, never where we stop.
        </p>
        <ul aria-label="Our musical universe" className="sound__tags">
          {SOUNDS.map((sound) => (
            <li key={sound}>{sound}</li>
          ))}
        </ul>
      </div>

      <figure className="sound__image">
        <img
          alt="A translucent red vinyl record spinning on a turntable"
          decoding="async"
          loading="lazy"
          src={siteConfig.media.vinylImage}
        />
        <figcaption>
          <span>SELECTED WITH INTENTION</span>
          <a href="https://unsplash.com/@wasdrew" rel="noreferrer" target="_blank">
            PHOTO — ANDRAS VAS
          </a>
        </figcaption>
      </figure>
    </section>
  )
}

// ---------- the collective ----------

function TheCollective() {
  return (
    <section className="collective" id="the-collective" aria-labelledby="collective-title">
      <p className="section-number">03 / THE COLLECTIVE</p>
      <h2 className="visually-hidden" id="collective-title">
        About ROUGE
      </h2>
      <div className="collective__manifesto">
        <p className="collective__lead">ROUGE is a London-born music collective built around the feeling music creates.</p>
        <p>A home for selectors, artists and people who listen beyond genre.</p>
        <p>
          From R&amp;B and soul to house, broken beat, jazz, garage and everything in between, the best musical journeys rarely
          fit a single category.
        </p>
        <p>We exist to discover, connect and share.</p>
        <p className="collective__sign">Different sounds. Same feeling.</p>
      </div>
      <p className="collective__note">
        We’re just getting started. Mixes, selectors and new gatherings will follow. Join the list to hear first.
      </p>
    </section>
  )
}

// ---------- FAQ ----------

function Faq() {
  const items = [
    {
      q: "Where do I get tickets?",
      a: (
        <>
          Only through our official DICE page.{" "}
          <a className="text-link" href={event.ticketUrl} rel="noopener" target="_blank">
            Get tickets <Arrow />
          </a>
        </>
      ),
    },
    {
      q: "What music will be played?",
      a: <>R&amp;B and house through the eras: 90s, 00s, 10s and now. Classics, deep cuts, soulful house and timeless R&amp;B.</>,
    },
    {
      q: "Where is it?",
      a: (
        <>
          {event.venue}, {event.area}.{" "}
          <a className="text-link" href={event.directionsUrl} rel="noopener" target="_blank">
            Open in Maps <Arrow />
          </a>
        </>
      ),
    },
    {
      q: "What time does it start and finish?",
      a: <>Doors are at 9 PM on {event.dateLabel}, and we play until late.</>,
    },
    {
      q: "Is there an age limit, dress code or entry policy?",
      a: (
        <>
          Entry details for this event are shown on the DICE event page. If anything isn’t clear, email{" "}
          <a className="text-link" href={`mailto:${siteConfig.links.contact}`}>
            {siteConfig.links.contact}
          </a>{" "}
          before you buy.
        </>
      ),
    },
    {
      q: "Can I get a refund or transfer my ticket?",
      a: <>Tickets are sold and managed by DICE, so refunds and transfers follow DICE’s terms for this event.</>,
    },
    {
      q: "How do I hear about future nights?",
      a: (
        <>
          Join the list below or follow{" "}
          <a className="text-link" href={siteConfig.links.instagram} rel="noreferrer" target="_blank">
            {siteConfig.links.instagramHandle}
          </a>
          . We only email when there’s something worth sharing.
        </>
      ),
    },
  ]

  return (
    <section className="faq" id="faq" aria-labelledby="faq-title">
      <div className="faq__heading">
        <p className="section-number">04 / QUESTIONS</p>
        <h2 id="faq-title">Good to know.</h2>
      </div>
      <div className="faq__list">
        {items.map((item) => (
          <details key={item.q}>
            <summary>
              <span>{item.q}</span>
              <span aria-hidden="true" className="faq__icon" />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

// ---------- signup (same fields, consent wording and endpoint as before) ----------

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
        <span className="eyebrow">YOU’RE ON THE LIST</span>
        <p>Thank you. We’ll be in touch when there’s something worth sharing.</p>
      </div>
    )
  }

  return (
    <form className="signup" onSubmit={handleSubmit}>
      <div className="signup__fields">
        <div className="field field--name">
          <label htmlFor={nameId}>
            First name <span>(optional)</span>
          </label>
          <input autoComplete="given-name" id={nameId} maxLength={100} name="firstName" placeholder="First name" type="text" />
        </div>
        <div className="field field--email">
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
        <button className="button" disabled={status === "submitting"} type="submit">
          <span>{status === "submitting" ? "JOINING…" : "JOIN THE LIST"}</span>
          <Arrow />
        </button>
      </div>

      <div className="signup__legal">
        <input id={consentId} name="consent" required type="checkbox" />
        <label htmlFor={consentId}>
          I agree to receive event news and marketing from ROUGE. Unsubscribe anytime.{" "}
          <a href="#privacy-policy">Privacy policy</a>.
        </label>
      </div>

      {status === "error" && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}

function Join() {
  return (
    <section className="join" id="join" aria-labelledby="join-title">
      <div className="join__heading">
        <p className="section-number">05 / JOIN THE FREQUENCY</p>
        <h2 id="join-title">Good music travels.</h2>
        <p>Occasional notes from ROUGE: new sounds, intimate gatherings and things worth sharing.</p>
      </div>
      <div className="join__form">
        <EmailSignup />
      </div>
    </section>
  )
}

// ---------- footer ----------

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div>
          <Wordmark />
          <p className="site-footer__tagline">{siteConfig.brand.tagline}</p>
        </div>
        <p className="site-footer__philosophy">{siteConfig.brand.philosophy}</p>
        <ul className="site-footer__links">
          <li>
            <a href={siteConfig.links.instagram} rel="noreferrer" target="_blank">
              Instagram <Arrow />
            </a>
          </li>
          <li>
            <a href={`mailto:${siteConfig.links.contact}`}>Contact</a>
          </li>
          <li>
            <a href={event.ticketUrl} rel="noopener" target="_blank">
              Tickets
            </a>
          </li>
        </ul>
      </div>

      <section className="privacy" id="privacy-policy" aria-labelledby="privacy-title">
        <h2 id="privacy-title">Privacy policy</h2>
        <p>
          If you join our list we keep your email address, your first name if you give it, and a record of when you agreed to
          hear from us. We use these only to send ROUGE event news and marketing. Emails are delivered through our email
          provider, Resend. We do not sell or share your details with anyone else.
        </p>
        <p>
          You can unsubscribe at any time using the link in any of our emails. To see or delete the information we hold about
          you, email <a href={`mailto:${siteConfig.links.contact}`}>{siteConfig.links.contact}</a>. We keep your details until
          you unsubscribe or ask us to delete them.
        </p>
        <p>Tickets are sold by DICE, which handles your purchase under its own privacy policy.</p>
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

// ---------- mobile ticket bar ----------

function MobileTicketBar({ phase }: { phase: EventPhase }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const onScroll = () => {
      const pastHero = window.scrollY > window.innerHeight * 0.75
      const nearEnd = window.innerHeight + window.scrollY > document.body.scrollHeight - 420
      setVisible(pastHero && !nearEnd)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  if (phase === "past") return null
  return (
    <div aria-hidden={!visible} className={`ticket-bar ${visible ? "ticket-bar--visible" : ""}`}>
      <div>
        <p className="ticket-bar__name">{event.name}</p>
        <p className="ticket-bar__meta">Sat 24 Oct · BRICKS, Brixton</p>
      </div>
      <a className="button" href={event.ticketUrl} rel="noopener" tabIndex={visible ? 0 : -1} target="_blank">
        <span>TICKETS</span>
        <Arrow />
      </a>
    </div>
  )
}

export default function App() {
  const now = useNow()
  const phase = phaseAt(now)
  return (
    <>
      <a className="skip-link" href="#the-night">
        Skip to event details
      </a>
      <SiteHeader phase={phase} />
      <main>
        <Hero now={now} phase={phase} />
        <TheNight phase={phase} />
        <TheSound />
        <TheCollective />
        <Faq />
        <Join />
      </main>
      <Footer />
      <MobileTicketBar phase={phase} />
    </>
  )
}
