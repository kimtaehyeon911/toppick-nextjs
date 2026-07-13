'use client'
import { useState } from 'react'
import type { Sport, Analyst } from '@/lib/types'
import { useApp } from '@/components/providers'
import { LeaderboardView, AnalystModal } from '@/components/views'

export default function LeaderboardPage() {
  const { t, myStars } = useApp()
  const [lbSport, setLbSport] = useState<Sport>('soccer')
  const [prof, setProf] = useState<{ sport: Sport; analyst: Analyst } | null>(null)
  return (
    <div className="wrap">
      <LeaderboardView lbSport={lbSport} setLbSport={setLbSport} myStars={myStars}
        onOpenAnalyst={(s, a) => setProf({ sport: s, analyst: a })} t={t} />
      {prof && <AnalystModal sport={prof.sport} analyst={prof.analyst} onClose={() => setProf(null)} t={t} />}
    </div>
  )
}
