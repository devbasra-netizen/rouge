import { servePage } from "./_lib/page-meta.js"

export const onRequestGet = (context) =>
  servePage(context, {
    path: "/members",
    title: "Become part of ROUGE — Members",
    description: "Good music. Good people. More to come. Join ROUGE, free, and be first to hear about gatherings, selected sounds and ROUGE Radio.",
    image: "/assets/og-archive.jpg",
    imageAlt: "Hands up under the mirror-ball lights at ROUGE 001",
  })
