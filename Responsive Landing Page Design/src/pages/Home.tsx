import { Arrow, Label, Lightbox, Picture, RadioDial, Signup, useLightbox, useReveal } from "../components"
import { siteConfig } from "../config"

const { archive, next } = siteConfig
const photos = archive.photos
const announced = Boolean(next.date && next.venue)

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="hero">
      <picture className="hero__photo">
        <source media="(max-width: 700px)" srcSet="/assets/001/hero-tall.jpg" />
        <img alt="" fetchPriority="high" height={1080} src="/assets/001/hero-wide.jpg" width={1616} />
      </picture>
      <div aria-hidden="true" className="hero__shade" />

      <div className="hero__body">
        <Label className="hero__kicker">London — independent gatherings &amp; selected sounds</Label>
        <h1 className="hero__mark" id="hero-title">
          ROUGE
        </h1>
        <div className="hero__foot">
          <p className="hero__line">An evening in sound.</p>
          <dl className="hero__index">
            <div>
              <dt>001</dt>
              <dd>
                <a href="/archive">Brixton, 24.10.26</a>
              </dd>
            </div>
            <div>
              <dt>002</dt>
              <dd>
                <a href="#next">{announced ? next.date : "In the making"}</a>
              </dd>
            </div>
            <div>
              <dt>Radio</dt>
              <dd>
                <a href="/radio">Coming soon</a>
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <p aria-hidden="true" className="hero__credit">
        Frame 11 — ROUGE 001, BRICKS
      </p>
    </section>
  )
}

function Intro() {
  return (
    <section aria-labelledby="intro-title" className="intro">
      <Label className="intro__label">What ROUGE is</Label>
      <h2 className="intro__statement" data-reveal id="intro-title">
        Not every night needs to be loud to be <em>remembered.</em>
      </h2>
      <div className="intro__cols">
        <p data-reveal>
          ROUGE is an independent gathering from London, built around the records. Small rooms, low light, and people who
          came for the music.
        </p>
        <p data-reveal>
          R&amp;B and neo-soul. Soulful and deep house. Garage, hip-hop, amapiano. The 90s to now: forgotten classics, deep cuts
          and the selection you didn’t see coming.
        </p>
      </div>
      <p className="intro__sign" data-reveal>
        Founded by DJ Dev{" "}
        <a href={siteConfig.links.dj} rel="noreferrer" target="_blank">
          {siteConfig.links.djHandle}
        </a>
      </p>
    </section>
  )
}

function NextChapter() {
  return (
    <section aria-labelledby="next-title" className="chapter" id="next">
      <div className="chapter__copy">
        <Label>The next chapter</Label>
        <h2 className="chapter__title" data-reveal id="next-title">
          <span className="chapter__num">002</span>
          <span className="chapter__sub">{announced ? `${next.date} — ${next.venue}` : "In the making."}</span>
        </h2>
        <p className="chapter__lede" data-reveal>
          A new room. The same feeling.
        </p>
        <p className="chapter__text" data-reveal>
          {announced
            ? "The next ROUGE is confirmed. The list gets first access."
            : "We’re building the next one now: new surroundings, more music, and a few ideas we’ve been saving. Nothing to announce yet. When there is, members hear first."}
        </p>
        <a className="text-link chapter__members" data-reveal href="/members">
          Become a member <Arrow />
        </a>
      </div>

      <div aria-hidden="true" className="sleeve" data-reveal>
        <div className="sleeve__record">
          <div className="sleeve__label">
            <span>ROUGE</span>
            <span>002</span>
          </div>
        </div>
        <div className="sleeve__cover">
          <span className="sleeve__cat">RGE—002</span>
          <span className="sleeve__title">ROUGE</span>
          <span className="sleeve__side">Side A · In the making</span>
        </div>
      </div>

      <div className="chapter__form" id="stay-close">
        <h3 className="chapter__form-title">Be first to know.</h3>
        <p>Join ROUGE, free, and hear first when the next room opens.</p>
        <Signup />
      </div>
    </section>
  )
}

function RadioIntro() {
  return (
    <section aria-labelledby="radio-title" className="radio-intro">
      <div className="radio-intro__head">
        <Label>Introducing</Label>
        <h2 className="radio-intro__title" data-reveal id="radio-title">
          ROUGE <em>Radio</em>
        </h2>
        <p className="radio-intro__lede" data-reveal>
          Frequencies from the ROUGE universe. Mixes, guest selectors and late-night sessions: the sound of ROUGE beyond the
          room.
        </p>
        <div className="radio-intro__links">
          <a className="text-link" href="/radio">
            Explore Radio <Arrow />
          </a>
          <a className="text-link" href="/radio/apply">
            Apply to play <Arrow />
          </a>
        </div>
      </div>
      <div data-reveal>
        <RadioDial />
      </div>
    </section>
  )
}

function ArchivePreview() {
  const { open, show, close, move } = useLightbox(photos.length)
  const picks = [0, 5, 2, 7, 9] // street, booth, mirror ball, laughing, hands up
  return (
    <section aria-labelledby="archive-title" className="archive-preview">
      <div className="archive-preview__head">
        <Label>The Archive — 001</Label>
        <h2 data-reveal id="archive-title">
          You were there <em>when it began.</em>
        </h2>
        <p className="meta-row">
          <span>{archive.date}</span>
          <span>Brixton, London</span>
          <span>{archive.name}</span>
        </p>
      </div>
      <div className="archive-preview__grid">
        {picks.map((i, n) => (
          <button
            aria-label={`Open photograph: ${photos[i].alt}`}
            className={`plate plate--${n + 1}`}
            data-reveal
            key={photos[i].file}
            onClick={(e) => show(i, e.currentTarget)}
            type="button"
          >
            <Picture photo={photos[i]} sizes="(max-width: 700px) 100vw, 50vw" />
            <span aria-hidden="true" className="plate__no">
              {photos[i].file}
            </span>
          </button>
        ))}
      </div>
      <a className="text-link archive-preview__more" href="/archive">
        Open the archive · {photos.length} frames <Arrow />
      </a>
      {open !== null && (
        <Lightbox caption={`The Archive — ${archive.number}`} index={open} onClose={close} onMove={move} photos={photos} />
      )}
    </section>
  )
}

function Philosophy() {
  const items = [
    {
      n: "I",
      title: "The room",
      text: "Intimate on purpose. Close enough to feel the record change, small enough that you’ll leave knowing someone new.",
    },
    {
      n: "II",
      title: "The selection",
      text: "Every record earns its place. We play for the room, not the algorithm: the classic you missed, then the one you’ll go looking for.",
    },
    {
      n: "III",
      title: "The people",
      text: "No guest list energy, no posturing. Good music, good people, nothing extra.",
    },
  ]
  return (
    <section aria-labelledby="philosophy-title" className="philosophy">
      <Label>The ROUGE way</Label>
      <h2 data-reveal id="philosophy-title">
        Selected with intention.
      </h2>
      <ol className="philosophy__list">
        {items.map((item) => (
          <li data-reveal key={item.n}>
            <span className="philosophy__n">{item.n}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function Home() {
  useReveal()
  return (
    <>
      <Hero />
      <Intro />
      <NextChapter />
      <RadioIntro />
      <ArchivePreview />
      <Philosophy />
    </>
  )
}
