import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import ManualKeyTester from '@/components/manual-key-tester'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <ManualKeyTester />
    </div>
  )
}
