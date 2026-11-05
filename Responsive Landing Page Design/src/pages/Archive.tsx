import { Arrow, Label, Lightbox, Picture, useLightbox, useReveal } from "../components"
import { Photo, photoSrc, siteConfig } from "../config"

const { archive } = siteConfig
const photos = archive.photos

// The night in four movements. Numbers refer to positions in archive.photos.
const CHAPTERS: { n: string; title: string; note: string; frames: number[]; layout: string }[] = [
  { n: "I", title: "Arrival", note: "Brixton, a Saturday. A queue under the sign, a poster on the pillar.", frames: [0, 1], layout: "wide-tall" },
  { n: "II", title: "The room", note: "Mirror ball, red light, records against the wall.", frames: [2, 3, 4], layout: "trio" },
  { n: "III", title: "The booth", note: "Where the night was steered from.", frames: [5, 6, 7], layout: "booth" },
  { n: "IV", title: "Late", note: "Hands up for the last stretch.", frames: [8, 9, 10], layout: "late" },
]

function ContactSheet({ onOpen }: { onOpen: (index: number, from: HTMLElement) => void }) {
  return (
    <section aria-label="Contact sheet: every frame from ROUGE 001" className="sheet">
      <div aria-hidden="true" className="sheet__edge">
        <span>ROUGE</span>
        <span>{archive.date}</span>
        <span>BRIXTON</span>
        <span>{photos.length} EXP</span>
      </div>
      <div className="sheet__grid">
        {photos.map((p, i) => (
          <button
            aria-label={`Open frame ${p.file}: ${p.alt}`}
            className="sheet__frame"
            key={p.file}
            onClick={(e) => onOpen(i, e.currentTarget)}
            type="button"
          >
            <span className="sheet__img">
              <img alt="" decoding="async" loading={i < 6 ? "eager" : "lazy"} src={photoSrc(p, "sm")} />
            </span>
            <span aria-hidden="true" className="sheet__no">
              {p.file}
              <i>A</i>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function Plate({ photo, index, onOpen, className = "" }: { photo: Photo; index: number; onOpen: (i: number, from: HTMLElement) => void; className?: string }) {
  return (
    <figure className={`frame ${className}`} data-reveal>
      <button aria-label={`Open frame ${photo.file} full screen`} className="frame__btn" onClick={(e) => onOpen(index, e.currentTarget)} type="button">
        <Picture photo={photo} sizes="(max-width: 700px) 100vw, 60vw" />
      </button>
      <figcaption>
        <span className="frame__no">{photo.file}</span>
        <span>{photo.alt}</span>
      </figcaption>
    </figure>
  )
}

export default function Archive() {
  useReveal()
  const { open, show, close, move } = useLightbox(photos.length)
  return (
    <>
      <section aria-labelledby="archive-title" className="archive-hero">
        <Label>The Archive</Label>
        <h1 className="archive-hero__num" id="archive-title">
          <span className="visually-hidden">The Archive — </span>001
        </h1>
        <p className="meta-row archive-hero__meta">
          <span>{archive.date}</span>
          <span>Brixton, London</span>
          <span>{archive.name}</span>
          <span>{photos.length} frames</span>
        </p>
        <div className="archive-hero__intro">
          <p className="archive-hero__lede">You were there when it began.</p>
          <p>
            The first ROUGE. One packed room at {archive.venue}, R&amp;B and house through the eras, and the people who turned up
            for it. A visual diary of the night it started. Tap any frame to see it full size.
          </p>
        </div>
      </section>

      <ContactSheet onOpen={show} />

      <div className="chapters">
        {CHAPTERS.map((chapter) => (
          <section aria-labelledby={`chapter-${chapter.n}`} className={`chapter-block chapter-block--${chapter.layout}`} key={chapter.n}>
            <header className="chapter-block__head" data-reveal>
              <span className="chapter-block__n">{chapter.n}</span>
              <h2 id={`chapter-${chapter.n}`}>{chapter.title}</h2>
              <p>{chapter.note}</p>
            </header>
            <div className="chapter-block__frames">
              {chapter.frames.map((i, k) => (
                <Plate className={`frame--${k + 1}`} index={i} key={photos[i].file} onOpen={show} photo={photos[i]} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="archive-end">
        <p className="archive-end__lead" data-reveal>
          That was 001.
        </p>
        <a className="archive-end__link" href="/#next">
          <span>002 — in the making</span>
          <span className="text-link">
            Be first to know <Arrow />
          </span>
        </a>
      </section>

      {open !== null && <Lightbox caption={`The Archive — ${archive.number}`} index={open} onClose={close} onMove={move} photos={photos} />}
    </>
  )
}
