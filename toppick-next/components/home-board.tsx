'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Match, Side, Sport } from '@/lib/types'
import { LEAGUES, mockPosts } from '@/lib/mock'
import { hasBackend, listMatches, castPick, onConsensusChange } from '@/lib/api'
import { useApp } from './providers'
import { SportButtons, LeagueTabs, MatchCard } from './views'

export function HomeBoard({ initialMatches }: { initialMatches: Match[] }) {
  const { t, canView, openPanels, togglePanel, requestUnlock, toast } = useApp()
  const router = useRouter()
  const [sport, setSport] = useState<Sport>('soccer')
  const [league, setLeague] = useState(LEAGUES.soccer[0].id)
  const [matches, setMatches] = useState<Match[]>(initialMatches)

  const refresh = useCallback(() => { listMatches().then(setMatches) }, [])
  useEffect(() => {
    if (hasBackend) refresh()            // hydrate myPick after anonymous auth
    return onConsensusChange(refresh)
  }, [refresh])

  const vote = async (id: number, side: Side) => {
    try { await castPick(id, side); refresh() }
    catch { toast('!', 'Could not save pick — check connection') }
  }

  const starClick = (m: Match) => { canView(m) ? togglePanel(m.id) : requestUnlock(m) }
  const listed = matches.filter(m => m.sport === sport && m.leagueId === league)

  return (
    <>
      <div className="subbar">
        <div className="subbar-in">
          <SportButtons cur={sport} onPick={s => { setSport(s); setLeague(LEAGUES[s][0].id) }} t={t} />
          <LeagueTabs sport={sport} cur={league} onPick={setLeague} />
        </div>
      </div>
      <div className="wrap">
        <section className="view on">
          <div className="sec-head"><div>
            <div className="eyebrow">{t('m.eyebrow', 'Live public consensus')}</div>
            <h1 className="h-title">{t('m.title', 'Predict. Prove it.')}</h1>
            <p className="h-sub">{t('m.sub', "Cast a free pick on any match. Watch the crowd's consensus move in real time. Your track record does the talking — no wagers, ever.")}</p>
          </div></div>
          <div className="grid">
            {listed.length === 0 && <div className="empty-note">No matches scheduled in this league right now.</div>}
            {listed.map(m => (
              <MatchCard key={m.id} m={m}
                open={canView(m) && openPanels.has(m.id)} viewable={canView(m)}
                postCount={mockPosts.filter(p => p.matchId === m.id).length}
                onVote={vote} onOpen={id => router.push(`/match/${id}`)}
                onStar={() => starClick(m)} t={t} />))}
          </div>
        </section>
      </div>
    </>
  )
}
