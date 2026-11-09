// Everything the site says that might change lives here: photos, the next event, Radio sessions, links.

export type Photo = {
  file: string
  alt: string
  width: number
  height: number
}

export type RadioSession = {
  // Example: { number: "001", title: "Late-night R&B", selector: "DJ Dev", date: "2026-12-01",
  //   artwork: "/assets/radio/001.jpg", embedUrl: "https://soundcloud.com/...", tags: ["R&B", "Neo-soul"],
  //   tracklist: ["Artist — Track", ...] }
  number: string
  title: string
  selector: string
  date: string
  artwork?: string
  embedUrl?: string
  tags?: string[]
  tracklist?: string[]
}

const photo = (file: string, width: number, height: number, alt: string): Photo => ({ file, width, height, alt })

export const siteConfig = {
  brand: {
    name: "ROUGE",
    descriptor: "Independent gatherings and selected sounds from London",
    founder: "DJ Dev",
  },

  archive: {
    number: "001",
    name: "ROUGE 001",
    date: "24.10.26",
    venue: "BRICKS",
    place: "Brixton, London",
    // Original photographs from the night, in the order they happened. Files live in public/assets/001.
    photos: [
      photo("01", 1600, 1069, "Outside BRICKS in Brixton, people gathering under the lit sign"),
      photo("02", 1069, 1600, "The ROUGE 001 poster on a black pillar inside BRICKS"),
      photo("03", 1600, 1069, "A mirror ball over the room, red light on the bar behind"),
      photo("04", 1600, 1069, "Two friends posing together by the decks"),
      photo("05", 1600, 1069, "Behind the decks, records leaning on the wall, someone dancing beside the DJ"),
      photo("06", 1122, 1402, "DJ Dev and a friend in the booth under the BRICKS sign, the red Rouge neon glowing below"),
      photo("07", 1069, 1600, "DJ Dev pointing and smiling from the booth"),
      photo("08", 1600, 1069, "DJ Dev laughing as the crowd reaches over the booth"),
      photo("09", 1069, 1600, "Friends throwing up hand signs in front of the BRICKS sign"),
      photo("10", 1200, 1600, "Hands up under the mirror-ball lights, Rouge neon on the booth"),
      photo("11", 1600, 1069, "A raised hand points up at the DJ, Rouge neon in the foreground"),
    ],
  },

  // Leave date and venue empty until they are officially announced: the site then shows the teaser only.
  next: {
    number: "002",
    date: "",
    venue: "",
    ticketUrl: "",
  },

  radio: {
    // Add real sessions here when they exist. Until then the Radio page shows its "coming soon" state.
    sessions: [] as RadioSession[],
  },

  email: {
    // ROUGE Members (functions/api/members). Every sign-up form feeds this one list.
    endpoint: import.meta.env.VITE_EMAIL_SIGNUP_ENDPOINT || "/api/members",
    source: "rouge-london.com",
  },

  links: {
    instagram: "https://www.instagram.com/rouge.london/",
    instagramHandle: "@rouge.london",
    dj: "https://www.instagram.com/djdevbasra/",
    djHandle: "@djdevbasra",
    contact: "hello@rouge-london.com",
    website: "rouge-london.com",
    admin: "/admin",
  },
} as const

export const photoSrc = (p: Photo, size: "sm" | "lg" = "lg") => `/assets/001/${p.file}${size === "sm" ? "-sm" : ""}.jpg`

// srcset with the real pixel widths of each file, so the browser picks the right one.
export const photoSrcSet = (p: Photo) => {
  const smWidth = Math.round((p.width * 760) / Math.max(p.width, p.height))
  return `${photoSrc(p, "sm")} ${smWidth}w, ${photoSrc(p)} ${p.width}w`
}
