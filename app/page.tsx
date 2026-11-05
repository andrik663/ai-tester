import Link from 'next/link'
import ManualKeyTester from '@/components/manual-key-tester'
import MsakuUserGate from '@/components/msaku-user-gate'

export default function Page() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground font-sans overflow-hidden">
      <nav className="flex h-11 shrink-0 items-center gap-1 border-b border-[#222327] bg-[#0a0b0d] px-3 text-[13px]">
        <span className="mr-2 font-semibold tracking-tight">Msaku Gateway</span>
        <Link href="/" className="rounded px-2 py-1 text-zinc-300 hover:bg-[#151619] hover:text-white">
          Studio
        </Link>
        <Link href="/status" className="rounded px-2 py-1 text-zinc-300 hover:bg-[#151619] hover:text-white">
          Status
        </Link>
        <Link href="/analytics" className="rounded px-2 py-1 text-zinc-300 hover:bg-[#151619] hover:text-white">
          Analytics
        </Link>
        <Link href="/discovery" className="rounded px-2 py-1 text-zinc-300 hover:bg-[#151619] hover:text-white">
          Discovery
        </Link>
      </nav>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <MsakuUserGate>
          <ManualKeyTester />
        </MsakuUserGate>
      </div>
    </div>
  )
}
