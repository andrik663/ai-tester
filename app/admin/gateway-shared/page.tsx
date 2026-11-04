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
  const store = await cookies()
  const authed = await verifyAdminSession(secret, store.get(GATEWAY_ADMIN_COOKIE)?.value)
  return authed ? <GatewaySharedPanel /> : <GatewaySharedLogin />
}
