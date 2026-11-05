import { servePage } from "./_lib/page-meta.js"

export const onRequestGet = (context) =>
  servePage(context, {
    path: "/radio",
    title: "ROUGE Radio — Coming soon",
    description: "Frequencies from the ROUGE universe. Selected sounds, wherever you are. Mixes, guest selectors and late-night sessions, coming soon.",
    image: "/assets/og-radio.jpg",
    imageAlt: "Behind the decks at ROUGE 001, records leaning against the wall",
  })
