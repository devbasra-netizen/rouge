import { Label, RadioDial, Signup, useReveal } from "../components"
import { RadioSession, siteConfig } from "../config"

const sessions = siteConfig.radio.sessions as readonly RadioSession[]

// Concepts we're developing. Shown as "in development", never as released shows.
const FORMATS = [
  { n: "01", title: "Selected mixes", text: "Hour-long journeys from the ROUGE booth. R&B into house into somewhere else." },
  { n: "02", title: "Guest selectors", text: "DJs and diggers we rate, playing what they’d never get away with at a club." },
  { n: "03", title: "Late-night sessions", text: "Slower, softer, after midnight. For the walk home and the hours after." },
  { n: "04", title: "Vinyl hours", text: "Records only. Crackle included." },
  { n: "05", title: "ROUGE Sessions", text: "Recorded sets from the room, so the night lasts longer than the night." },
  { n: "06", title: "Conversations", text: "Selectors and artists on the records that made them." },
]

// Turns a SoundCloud, Mixcloud or YouTube link into an embeddable player URL.
function embedFor(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.endsWith("soundcloud.com")) {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%237a1626&visual=false&show_comments=false`
    }
    if (u.hostname.endsWith("mixcloud.com")) {
      return `https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&light=0&feed=${encodeURIComponent(u.pathname)}`
    }
    if (u.hostname.endsWith("youtube.com") || u.hostname === "youtu.be") {
      const id = u.hostname === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v")
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null
    }
  } catch {}
  return null
}

function SessionCard({ s }: { s: RadioSession }) {
  const embed = s.embedUrl ? embedFor(s.embedUrl) : null
  return (
    <article className="session" data-reveal>
      {s.artwork && <img alt="" className="session__art" loading="lazy" src={s.artwork} />}
      <div className="session__body">
        <p className="session__meta">
          <span>Session {s.number}</span>
          <span>{s.date}</span>
        </p>
        <h3>{s.title}</h3>
        <p className="session__selector">Selected by {s.selector}</p>
        {s.tags && (
          <ul className="session__tags">
            {s.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        {embed && (
          <iframe allow="autoplay; encrypted-media" className="session__player" loading="lazy" src={embed} title={`Listen: ${s.title}`} />
        )}
        {s.tracklist && s.tracklist.length > 0 && (
          <details className="session__tracks">
            <summary>Tracklist</summary>
            <ol>
              {s.tracklist.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </article>
  )
}

export default function Radio() {
  useReveal()
  return (
    <>
      <section aria-labelledby="radio-page-title" className="radio-hero">
        <Label>
          <span aria-hidden="true" className="dial__lamp" /> Off air — coming soon
        </Label>
        <h1 className="radio-hero__title" id="radio-page-title">
          ROUGE <em>Radio</em>
        </h1>
        <p className="radio-hero__lede">Frequencies from the ROUGE universe.</p>
        <p className="radio-hero__sub">Selected sounds. Wherever you are.</p>
        <div className="radio-hero__dial">
          <RadioDial large />
        </div>
      </section>

      <section aria-labelledby="formats-title" className="formats">
        <div className="formats__head">
          <Label>On the dial</Label>
          <h2 data-reveal id="formats-title">
            What we’re tuning.
          </h2>
          <p data-reveal>Ideas in development, not a schedule. They’ll arrive when they’re ready, and not before.</p>
        </div>
        <ol className="formats__list">
          {FORMATS.map((f) => (
            <li data-reveal key={f.n}>
              <span className="formats__n">{f.n}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <span className="formats__tag">In development</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sessions-title" className="sessions">
        <Label>The broadcasts</Label>
        <h2 data-reveal id="sessions-title">
          Sessions
        </h2>
        {sessions.length > 0 ? (
          <div className="sessions__list">
            {sessions.map((s) => (
              <SessionCard key={s.number} s={s} />
            ))}
          </div>
        ) : (
          <div className="sessions__empty" data-reveal>
            <span className="sessions__slot">001</span>
            <div>
              <p className="sessions__empty-title">Awaiting first transmission.</p>
              <p>The first session hasn’t aired. When it does, it’ll live here with its tracklist, and every one after it.</p>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="tune-title" className="tune-in">
        <div>
          <Label>Be first to tune in</Label>
          <h2 data-reveal id="tune-title">
            Hear it first.
          </h2>
          <p>Join the ROUGE list and we’ll email you the moment Radio goes on air, along with news of the next gathering.</p>
        </div>
        <Signup
          button="Tell me when it’s live"
          source="rouge-london.com/radio"
          successText="We’ll let you know the moment ROUGE Radio goes on air."
          successTitle="You’re tuned in."
        />
      </section>
    </>
  )
}
