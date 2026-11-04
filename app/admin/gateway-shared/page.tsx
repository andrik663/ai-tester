/**
 * /admin/gateway-shared — admin panel for shared gateway keys.
 *
 * Server component: the session check runs here, server-side, before any
 * panel UI is rendered. Unauthenticated visitors only ever see the login
 * form; the panel (and its list API) require a signed session cookie.
 * If GATEWAY_SHARED_ADMIN_TOKEN is unset, the panel is disabled entirely
 * (fail closed) instead of rendering a login that can never succeed.
 */

import { cookies } from "next/headers"
import { GATEWAY_ADMIN_COOKIE, verifyAdminSession } from "@/lib/gateway-admin-session"
import { GatewaySharedLogin, GatewaySharedPanel } from "@/components/gateway-shared-admin"

// This page reads the request cookie, so it must NEVER be statically
// prerendered: a build-time render has no request context, and on the
// OpenNext/Cloudflare build that surfaced as a runtime 500 for this route
// (the API routes from the same PR worked, the page did not). Forcing
// dynamic + nodejs runtime makes every request render with a real cookie
// store. The session check below is additionally wrapped so that any
// headers/crypto failure degrades to the login form, never a 500.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function GatewaySharedAdminPage() {
  const secret = process.env.GATEWAY_SHARED_ADMIN_TOKEN
  if (!secret) {
    return (
      <div style={{ maxWidth: 720, margin: "48px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#e4e4e7" }}>
        <h1 style={{ fontSize: 22 }}>Panel Admin — Kunci Shared Gateway</h1>
        <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: 1.6 }}>
          Panel ini belum diaktifkan: set env <code>GATEWAY_SHARED_ADMIN_TOKEN</code> di environment
          deployment, lalu muat ulang halaman ini.
        </p>
      </div>
    )
  }
  let authed = false
  try {
    const store = await cookies()
    authed = await verifyAdminSession(secret, store.get(GATEWAY_ADMIN_COOKIE)?.value)
  } catch {
    // No usable request context (or crypto unavailable) — fall through to
    // the login form instead of failing the whole page.
    authed = false
  }
  return authed ? <GatewaySharedPanel /> : <GatewaySharedLogin />
}
