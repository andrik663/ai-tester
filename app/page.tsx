import ManualKeyTester from '@/components/manual-key-tester'
import MsakuUserGate from '@/components/msaku-user-gate'

export default function Page() {
  return (
    <div className="flex h-dvh bg-background text-foreground font-sans overflow-hidden">
      <MsakuUserGate>
        <ManualKeyTester />
      </MsakuUserGate>
    </div>
  )
}
