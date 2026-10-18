export const siteConfig = {
  brand: {
    name: "ROUGE",
    tagline: "London Music Collective",
    philosophy: "Different sounds. Same feeling.",
    location: "Brixton · London",
  },
  media: {
    heroImage: "/assets/rouge-hero.jpg",
    // Add a compressed MP4 or WebM URL here to enable the silent looping hero video.
    heroVideo: "",
    vinylImage: "/assets/rouge-vinyl.jpg",
  },
  // The next event. The homepage switches automatically between
  // "upcoming" (countdown), "live" (tonight) and "past" (thank you) using these times.
  event: {
    name: "ROUGE #001",
    genres: "R&B | House",
    dateLabel: "Saturday 24 October 2026",
    shortDate: "24 October 2026",
    timeLabel: "9 PM — Late",
    venue: "BRICKS",
    area: "Brixton, London",
    // 9 PM London time (BST, UTC+1) on 24 October 2026.
    startsAt: "2026-10-24T20:00:00Z",
    // When the page stops saying "tonight" and switches to the past-event state.
    endsAt: "2026-10-25T04:00:00Z",
    capacity: "around 90",
    ticketUrl: "https://link.dice.fm/Bd42c746fbaa",
    directionsUrl: "https://www.google.com/maps/search/?api=1&query=BRICKS%20Brixton%20London",
    selector: "DJ Dev",
  },
  email: {
    // Same-site signup function (functions/api/signup.js). A build variable can still override it.
    endpoint: import.meta.env.VITE_EMAIL_SIGNUP_ENDPOINT || "/api/signup",
    source: "rouge-london.com",
  },
  links: {
    instagram: "https://www.instagram.com/rouge.ldn/",
    instagramHandle: "@rouge.ldn",
    contact: "hello@rouge-london.com",
    admin: "/admin",
  },
} as const
