import { cookies } from 'next/headers'
import ManualKeyTester from '@/components/manual-key-tester'
import PublicCodePreview from '@/components/public-code-preview'
import { verifySession, COOKIE_NAME } from '@/lib/auth'

export default async function Page() {
  // Public visitors (no dev_session cookie, or DEV_PASSWORD unset) see ONLY
  // the single-page Code Preview dashboard — no provider sidebar, no other
  // tabs (Batch, Compare, Keys, Skills, Docs, ...). The full multi-tab
  // dashboard is reserved for devs who have logged in at /login.
  const cookieStore = await cookies()
  const isDevAuthenticated = await verifySession(cookieStore.get(COOKIE_NAME)?.value)

  if (!isDevAuthenticated) {
    return <PublicCodePreview />
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <ManualKeyTester />
    </div>
  )
}
