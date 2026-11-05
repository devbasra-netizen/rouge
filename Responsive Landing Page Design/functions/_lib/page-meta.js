// Serves the single-page app's index.html for a sub-page, with that page's own title,
// description and share image, so links to /archive and /radio preview properly.

const SITE = "https://www.rouge-london.com"

export async function servePage(context, meta) {
  const { request, env } = context
  const res = await env.ASSETS.fetch(new Request(new URL("/", request.url), request))
  if (!res.ok || !(res.headers.get("Content-Type") || "").includes("text/html")) return res

  const url = `${SITE}${meta.path}`
  const image = `${SITE}${meta.image}`
  const set = (value) => ({ element: (el) => el.setAttribute("content", value) })

  const out = new HTMLRewriter()
    .on("title", { element: (el) => el.setInnerContent(meta.title) })
    .on('meta[name="description"]', set(meta.description))
    .on('meta[property="og:title"]', set(meta.title))
    .on('meta[property="og:description"]', set(meta.description))
    .on('meta[property="og:url"]', set(url))
    .on('meta[property="og:image"]', set(image))
    .on('meta[name="twitter:image"]', set(image))
    .on('meta[property="og:image:alt"]', set(meta.imageAlt))
    .on('link[rel="canonical"]', { element: (el) => el.setAttribute("href", url) })
    .transform(res)

  const headers = new Headers(out.headers)
  headers.set("Cache-Control", "public, max-age=0, must-revalidate")
  return new Response(out.body, { status: 200, headers })
}
