// Server Component per match: crawlable matchup page + per-match metadata.
// "Real Madrid vs Man City prediction" queries land here.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMatch } from '@/lib/data'
import { MatchClient } from '@/components/match-client'

export const revalidate = 30

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const m = await getMatch(Number(params.id))
  if (!m) return { title: 'Match not found' }
  const total = m.votesA + m.votesB
  const pa = total ? Math.round(m.votesA / total * 100) : 50
  return {
    title: `${m.a.name} vs ${m.b.name} — Prediction & Crowd Consensus`,
    description: `${m.a.name} ${pa}% · ${m.b.name} ${100 - pa}% — ${total.toLocaleString()} free picks on Top Pick. See how the top 1% of analysts called it.`,
    openGraph: { title: `${m.a.name} vs ${m.b.name} · Top Pick`, description: `Crowd consensus ${pa}/${100 - pa} across ${total.toLocaleString()} picks.` },
  }
}

export default async function MatchPage({ params }: { params: { id: string } }) {
  const m = await getMatch(Number(params.id))
  if (!m) notFound()
  return <MatchClient initial={m} />
}
