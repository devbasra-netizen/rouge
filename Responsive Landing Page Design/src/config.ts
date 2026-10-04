export const siteConfig = {
  brand: {
    name: "ROUGE",
    location: "Brixton · London",
    colors: {
      background: "#110607",
      oxblood: "#390c12",
      burgundy: "#67191f",
      accent: "#a52d36",
      cream: "#f0e4d8",
      muted: "#bfa9a4",
    },
    typography: {
      display: '"Bodoni Moda", "Times New Roman", serif',
      sans: '"DM Sans", Arial, sans-serif',
    },
  },
  media: {
    heroImage: "/assets/rouge-hero.png",
    // Add a compressed MP4 or WebM URL here to enable the silent looping hero video.
    heroVideo: "",
    vinylImage: "/assets/rouge-vinyl.jpg",
  },
  email: {
    // Configure VITE_EMAIL_SIGNUP_ENDPOINT with a server-side MailerLite,
    // Buttondown, or equivalent subscription endpoint. Success is only shown
    // after the endpoint confirms the request.
    endpoint: import.meta.env.VITE_EMAIL_SIGNUP_ENDPOINT ?? "",
    source: "rouge-london.com",
  },
  links: {
    instagram: "https://www.instagram.com/rouge.ldn/",
    contact: "hello@rouge-london.com",
  },
} as const
