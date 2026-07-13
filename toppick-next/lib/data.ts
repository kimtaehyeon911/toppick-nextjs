// Server-side data access for Server Components (public data only —
// matches & consensus are world-readable under RLS). No session here;
// picks/entitlements are client concerns (lib/api.ts).
import { createClient } from '@supabase/supabase-js'
import type { Match, Side, Sport, StarBlock } from './types'
import { mockMatches } from './mock'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EMPTY_STAR: StarBlock = { con: 50, n: 0, picks: [] }

export async function getMatches(): Promise<Match[]> {
  if (!url || !key) return mockMatches
  const sb = createClient(url, key)
  const { data: rows, error } = await sb
    .from('matches')
    .select('id, sport, league, status, clock, team_a, team_b, result')
    .order('starts_at', { ascending: true })
  if (error || !rows) return mockMatches
  const { data: cons } = await sb.from('match_consensus').select('*')
  const cMap = new Map((cons ?? []).map((c: any) => [c.match_id, c]))
  return rows.map((r: any) => ({
    id: r.id, sport: r.sport as Sport, leagueId: String(r.league),
    status: r.status, clock: r.clock ?? '',
    a: { name: r.team_a.name, abbr: r.team_a.abbr, color: r.team_a.color },
    b: { name: r.team_b.name, abbr: r.team_b.abbr, color: r.team_b.color },
    votesA: Number(cMap.get(r.id)?.votes_a ?? 0),
    votesB: Number(cMap.get(r.id)?.votes_b ?? 0),
    myPick: null as Side | null, // hydrated client-side after anonymous auth
    star: EMPTY_STAR,
  }))
}

export async function getMatch(id: number): Promise<Match | null> {
  const all = await getMatches()
  return all.find(m => m.id === id) ?? null
}
