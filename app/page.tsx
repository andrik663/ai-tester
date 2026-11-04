import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ManualKeyTester from '@/components/manual-key-tester'
import { verifySession, COOKIE_NAME } from '@/lib/auth'

export default async function Page() {
  const cookieStore = await cookies()
  const isDevAuthenticated = await verifySession(cookieStore.get(COOKIE_NAME)?.value)

  if (!isDevAuthenticated) {
    redirect('/login')
  }

  return (
    <div className="flex h-dvh bg-background text-foreground font-sans overflow-hidden">
      <ManualKeyTester />
    </div>
  )
}
