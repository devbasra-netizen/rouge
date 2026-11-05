import { servePage } from "./_lib/page-meta.js"

export const onRequestGet = (context) =>
  servePage(context, {
    path: "/archive",
    title: "The Archive — 001 · ROUGE",
    description: "24.10.26, Brixton, London. Photographs from ROUGE 001 at BRICKS: the first night, frame by frame.",
    image: "/assets/og-archive.jpg",
    imageAlt: "DJ Dev and a friend in the booth at BRICKS, the red Rouge neon glowing below",
  })
