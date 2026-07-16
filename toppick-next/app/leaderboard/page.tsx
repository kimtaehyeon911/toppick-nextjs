'use client'
import { useState, useEffect } from 'react'
import type { Sport } from '@/lib/types'
import { useApp } from '@/components/providers'
import { LeaderboardLive, AnalystModalLive } from '@/components/leaderboard-view'
import { getLeaderboard, hasBackend, supabase, type LbRow } from '@/lib/api'

export default function LeaderboardPage() {
  const { t } = useApp()
  const [lbSport, setLbSport] = useState<Sport>('soccer')
  const [rows, setRows] = useState<LbRow[]>([])
  const [me, setMe] = useState<LbRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<LbRow | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      const data = await getLeaderboard(lbSport)
      let uid: string | null = null
      if (hasBackend && supabase) {
        uid = (await supabase.auth.getSession()).data.session?.user.id ?? null
      }
      if (!alive) return
      setRows(data)
      setMe(uid ? (data.find(r => r.userId === uid) ?? null) : null)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [lbSport])

  return (
    <div className="wrap">
      <LeaderboardLive lbSport={lbSport} setLbSport={setLbSport} rows={rows} me={me}
        loading={loading} onOpenRow={r => setSel(r)} t={t} />
      {sel && <AnalystModalLive row={sel} sport={lbSport} onClose={() => setSel(null)} t={t} />}
    </div>
  )
}