import { useEffect } from "react"
import { SiteFooter, SiteHeader } from "./components"
import Archive from "./pages/Archive"
import Home from "./pages/Home"
import Radio from "./pages/Radio"

// Three pages, plain links between them. Cloudflare serves index.html for each path,
// and functions/archive.js + functions/radio.js give those pages their own share previews.
const ROUTES = {
  "/": { key: "home", title: "ROUGE — Independent gatherings and selected sounds from London", Page: Home },
  "/archive": { key: "archive", title: "The Archive — 001 · ROUGE", Page: Archive },
  "/radio": { key: "radio", title: "ROUGE Radio — Coming soon", Page: Radio },
} as const

function NotFound() {
  return (
    <section className="not-found">
      <p className="label">404</p>
      <h1>Between stations.</h1>
      <p>This page doesn’t exist. Try the way in.</p>
      <a className="text-link" href="/">
        Back to ROUGE
      </a>
    </section>
  )
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/"
  const route = ROUTES[path as keyof typeof ROUTES]

  useEffect(() => {
    document.title = route ? route.title : "Not found · ROUGE"
    if (window.location.hash) {
      // Land on the right section after the page has rendered (e.g. /#stay-close from the Archive).
      requestAnimationFrame(() => {
        try {
          document.querySelector(window.location.hash)?.scrollIntoView()
        } catch {}
      })
    }
  }, [route])

  const Page = route ? route.Page : NotFound
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div aria-hidden="true" className="grain" />
      <SiteHeader current={route ? route.key : "other"} />
      <main id="main">
        <Page />
      </main>
      <SiteFooter />
    </>
  )
}
