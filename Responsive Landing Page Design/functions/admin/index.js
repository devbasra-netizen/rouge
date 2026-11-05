// /admin -> ROUGE HQ (the invitations dashboard stays at /admin/invites).

export async function onRequestGet() {
  return new Response(null, { status: 302, headers: { Location: "/admin/hq" } })
}
