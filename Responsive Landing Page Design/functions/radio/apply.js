import { servePage } from "../_lib/page-meta.js"

export const onRequestGet = (context) =>
  servePage(context, {
    path: "/radio/apply",
    title: "Your sound. Our frequency. — Apply to play on ROUGE Radio",
    description: "ROUGE Radio guest selector applications. Share a mix, tell us your sound and the session you'd create. For Radio mixes only, not event bookings.",
    image: "/assets/og-radio.jpg",
    imageAlt: "Behind the decks at ROUGE 001, records leaning against the wall",
  })
