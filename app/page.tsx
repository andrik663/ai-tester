"use client"

import ManualKeyTester from "@/components/manual-key-tester"

export default function Page() {
  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <ManualKeyTester />
    </div>
  )
}
