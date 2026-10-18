// /admin -> the invitations dashboard.

export async function onRequestGet() {
  return new Response(null, { status: 302, headers: { Location: "/admin/invites" } })
}
