export const siteConfig = {
  brand: {
    name: "ROUGE",
    tagline: "An intimate music gathering in London",
    philosophy: "Different sounds. Same feeling.",
  },
  // The last night. Photos live in public/assets/001 (01.jpg, 01-sm.jpg, ...).
  pastEvent: {
    number: "001",
    name: "ROUGE #001",
    date: "24.10.26",
    stamp: "'26 10 24",
    venue: "BRICKS",
    area: "Brixton, London",
    sound: "R&B and house through the eras",
    photos: [
      { file: "01", alt: "Outside BRICKS in Brixton, people gathering under the lit sign", wide: true },
      { file: "02", alt: "The ROUGE #001 poster on a black pillar inside BRICKS", wide: false },
      { file: "03", alt: "A mirror ball over the room, red light on the bar behind", wide: true },
      { file: "04", alt: "Two friends posing together by the decks", wide: true },
      { file: "05", alt: "Behind the decks, records leaning on the wall, someone dancing beside the DJ", wide: true },
      { file: "06", alt: "DJ Dev and a friend in the booth under the BRICKS sign, the red Rouge neon glowing below", wide: false },
      { file: "07", alt: "DJ Dev pointing and smiling from the booth", wide: false },
      { file: "08", alt: "DJ Dev laughing as the crowd reaches over the booth", wide: true },
      { file: "09", alt: "Friends throwing up hand signs in front of the BRICKS sign", wide: false },
      { file: "10", alt: "Hands up under the mirror-ball lights, Rouge neon on the booth", wide: false },
      { file: "11", alt: "A raised hand points up at the DJ, Rouge neon in the foreground", wide: true },
    ],
  },
  // The next night. Leave date/venue empty until they're confirmed; the page says "soon".
  nextEvent: {
    number: "002",
    date: "",
    venue: "",
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
