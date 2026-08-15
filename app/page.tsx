import { cookies } from 'next/headers'
import ManualKeyTester from '@/components/manual-key-tester'
import { verifySession, COOKIE_NAME } from '@/lib/auth'

export default async function Page() {
  // Public visitors (no dev_session cookie, or DEV_PASSWORD unset) only ever
  // see the Miuclaw Gateway preset — every other provider is hidden until a
  // dev logs in at /login.
  const cookieStore = await cookies()
  const isDevAuthenticated = await verifySession(cookieStore.get(COOKIE_NAME)?.value)

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <ManualKeyTester isDevAuthenticated={isDevAuthenticated} />
    </div>
  )
}
