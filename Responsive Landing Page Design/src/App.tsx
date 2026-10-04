import { FormEvent, useId, useState } from "react"
import { siteConfig } from "./config"

type SignupStatus = "idle" | "submitting" | "success" | "error"

function Wordmark({ as = "span" }: { as?: "h1" | "span" }) {
  const Tag = as

  return <Tag className="wordmark">ROUGE</Tag>
}

function Arrow({ direction = "right" }: { direction?: "right" | "down" }) {
  return (
    <svg
      aria-hidden="true"
      className={`arrow arrow--${direction}`}
      viewBox="0 0 24 24"
    >
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

function EmailSignup({
  compact = false,
  heading,
}: {
  compact?: boolean
  heading?: string
}) {
  const emailId = useId()
  const nameId = useId()
  const consentId = useId()
  const [status, setStatus] = useState<SignupStatus>("idle")
  const [message, setMessage] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")

    const form = event.currentTarget
    const formData = new FormData(form)

    if (!siteConfig.email.endpoint) {
      setStatus("error")
      setMessage(
        "Online registration is not open yet. Please check back shortly.",
      )
      return
    }

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
        throw new Error(`Signup failed with status ${response.status}`)
      }

      form.reset()
      setStatus("success")
    } catch {
      setStatus("error")
      setMessage("We couldn’t add you just now. Please try again in a moment.")
    }
  }

  if (status === "success") {
    return (
      <div
        className={`signup-success ${compact ? "signup-success--compact" : ""}`}
        role="status"
      >
        <span className="eyebrow">YOU’RE ON THE LIST</span>
        <p>We’ll be in touch when the room is ready.</p>
      </div>
    )
  }

  return (
    <form
      className={`signup ${compact ? "signup--compact" : ""}`}
      onSubmit={handleSubmit}
    >
      {heading && <h2>{heading}</h2>}
      {!compact && (
        <p className="signup__intro">
          Be first to hear about our opening night.
        </p>
      )}

      <div className="signup__fields">
        <div className="field field--name">
          <label htmlFor={nameId}>
            First name <span>(optional)</span>
          </label>
          <input
            autoComplete="given-name"
            id={nameId}
            name="firstName"
            placeholder="First name"
            type="text"
          />
        </div>
        <div className="field field--email">
          <label htmlFor={emailId}>Email address</label>
          <input
            autoComplete="email"
            id={emailId}
            name="email"
            placeholder="Email address"
            required
            type="email"
          />
        </div>
        <button
          className="button"
          disabled={status === "submitting"}
          type="submit"
        >
          <span>{status === "submitting" ? "JOINING…" : "JOIN THE LIST"}</span>
          <Arrow />
        </button>
      </div>

      <div className="signup__legal">
        <input id={consentId} name="consent" required type="checkbox" />
        <label htmlFor={consentId}>
          I agree to receive event news and marketing from ROUGE. Unsubscribe
          anytime. <a href="#privacy-policy">Privacy policy</a>.
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

function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__media" aria-hidden="true">
        {siteConfig.media.heroVideo && (
          <video
            autoPlay
            loop
            muted
            playsInline
            poster={siteConfig.media.heroImage}
          >
            <source src={siteConfig.media.heroVideo} />
          </video>
        )}
      </div>
      <div className="hero__veil" />

      <header className="hero__header">
        <a aria-label="ROUGE home" href="#">
          <Wordmark />
        </a>
        <a className="header-link" href="#first-access">
          FIRST ACCESS
        </a>
      </header>

      <div className="hero__content">
        <div className="hero__title-group">
          <p className="location">
            BRIXTON <span>·</span> LONDON
          </p>
          <Wordmark as="h1" />
          <p className="hero__headline" id="hero-title">
            R&amp;B THROUGH THE ERAS.
          </p>
          <p className="hero__subhead">AN INTIMATE MUSIC EXPERIENCE.</p>
        </div>

        <div className="hero__signup">
          <EmailSignup heading="THE ROOM IS ALMOST READY." />
        </div>
      </div>

      <a className="scroll-cue" href="#sound" aria-label="Discover the sound">
        <Arrow direction="down" />
      </a>
    </section>
  )
}

function SoundSection() {
  return (
    <section className="sound" id="sound" aria-labelledby="sound-title">
      <div className="sound__copy">
        <p className="section-number">01 / THE MUSIC</p>
        <h2 id="sound-title">THE SOUND.</h2>
        <p className="sound__eras">90s. 00s. 10s. Now.</p>
        <p className="sound__body">
          R&amp;B through every era. Classics, deep cuts and everything in
          between.
        </p>
        <div className="sound__line" aria-hidden="true" />
        <p className="sound__note">
          SELECTED WITH INTENTION.
          <br />
          PLAYED LOUD.
        </p>
      </div>

      <figure className="sound__image">
        <img
          alt="A translucent red vinyl record spinning on a turntable"
          loading="lazy"
          src={siteConfig.media.vinylImage}
        />
        <figcaption>
          <span>ANALOGUE FEELING</span>
          <a
            href="https://unsplash.com/@wasdrew"
            rel="noreferrer"
            target="_blank"
          >
            PHOTO — ANDRAS VAS
          </a>
        </figcaption>
      </figure>
    </section>
  )
}

function FirstAccess() {
  return (
    <section
      className="access"
      id="first-access"
      aria-labelledby="access-title"
    >
      <div className="access__heading">
        <p className="section-number">02 / FIRST ACCESS</p>
        <h2 id="access-title">
          GOOD NIGHTS
          <br />
          ARE HARD TO FIND.
        </h2>
      </div>
      <div className="access__form">
        <p>Something is coming to Brixton.</p>
        <EmailSignup compact />
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer>
      <div className="footer__top">
        <Wordmark />
        <p>
          BRIXTON <span>·</span> LONDON
        </p>
        <a href={siteConfig.links.instagram} rel="noreferrer" target="_blank">
          INSTAGRAM <Arrow />
        </a>
      </div>
      <div className="footer__bottom">
        <p>© {new Date().getFullYear()} ROUGE LONDON</p>
        <a href={`mailto:${siteConfig.links.contact}`}>CONTACT</a>
        <a href="#privacy-policy">PRIVACY POLICY</a>
      </div>
      <section
        className="privacy"
        id="privacy-policy"
        aria-labelledby="privacy-title"
      >
        <h2 id="privacy-title">PRIVACY POLICY</h2>
        <p>
          We use the details you submit only to send ROUGE event news and
          marketing. You can unsubscribe at any time using the link in our
          emails or by contacting us. We do not sell your personal information.
        </p>
      </section>
    </footer>
  )
}

export default function App() {
  return (
    <main>
      <Hero />
      <SoundSection />
      <FirstAccess />
      <Footer />
    </main>
  )
}
