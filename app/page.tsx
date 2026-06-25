import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ManualKeyTester from '@/components/manual-key-tester'


export default async function Page() {
  const cookieStore = await cookies()
  const devSession = cookieStore.get('dev_session')?.value

  if (devSession !== 'dev_authenticated') {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <ManualKeyTester />
    </div>
  )
}
