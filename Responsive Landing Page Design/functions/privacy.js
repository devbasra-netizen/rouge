import { servePage } from "./_lib/page-meta.js"

export const onRequestGet = (context) =>
  servePage(context, {
    path: "/privacy",
    title: "Privacy notice · ROUGE",
    description: "What ROUGE collects when you join or apply to ROUGE Radio, why, how long we keep it and your rights.",
    image: "/assets/og-archive.jpg",
    imageAlt: "ROUGE 001 at BRICKS, Brixton",
  })
