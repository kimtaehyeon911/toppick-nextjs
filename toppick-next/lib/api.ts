'use client'
// ============================================================
// Data layer. If VITE_SUPABASE_URL/ANON_KEY are set the app talks
// to Supabase (real backend, RLS-enforced). Otherwise it runs on
// in-memory mock data so the product is demoable with zero setup.
// Every UI component calls THIS module only.
// ============================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Match, Post, Side, Sport, StarBlock } from './types'
import { mockMatches, mockPosts } from './mock'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const hasBackend = Boolean(url && key)
export const supabase: SupabaseClient | null = hasBackend ? createClient(url!, key!) : null

// ---------- session ----------
export async function ensureSession(): Promise<string> {
  if (!supabase) return 'demo-user'
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  // Anonymous sign-in must be enabled: Dashboard → Auth → Providers → Anonymous
  const { data: anon, error } = await supabase.auth.signInAnonymously()
  if (error || !anon.session) {
    console.warn('[toppick] anonymous auth unavailable, falling back to demo mode:', error?.message)
    return 'demo-user'
  }
  return anon.session.user.id
}

// ---------- matches & consensus ----------
let demoMatches: Match[] = JSON.parse(JSON.stringify(mockMatches))
const EMPTY_STAR: StarBlock = { con: 50, n: 0, picks: [] }

export async function listMatches(): Promise<Match[]> {
  if (!supabase) return demoMatches
  const { data: rows, error } = await supabase
    .from('matches')
    .select('id, sport, league, status, clock, team_a, team_b, result')
    .order('starts_at', { ascending: true })
  if (error || !rows) { console.warn(error); return demoMatches }

  const { data: cons } = await supabase.from('match_consensus').select('*')
  const { data: mine } = await supabase.from('picks').select('match_id, side')
  const cMap = new Map((cons ?? []).map(c => [c.match_id, c]))
  const pMap = new Map((mine ?? []).map(p => [p.match_id, p.side as Side]))

  return rows.map(r => ({
    id: r.id, sport: r.sport as Sport,
    leagueId: String(r.league), // worker & seed store frontend tab slugs (ucl/mlb/nba/ppv…)
    status: r.status, clock: r.clock ?? '',
    a: { name: r.team_a.name, abbr: r.team_a.abbr, color: r.team_a.color },
    b: { name: r.team_b.name, abbr: r.team_b.abbr, color: r.team_b.color },
    votesA: Number(cMap.get(r.id)?.votes_a ?? 0),
    votesB: Number(cMap.get(r.id)?.votes_b ?? 0),
    myPick: pMap.get(r.id) ?? null,
    // Star consensus is served by rpc('star_consensus') only when the caller
    // holds a pass / Star badge (RLS-gated). Until fetched, render locked.
    star: EMPTY_STAR,
  }))
}

// Fetch the RLS-gated star block for a single match (call after unlock).
export async function fetchStarBlock(matchId: number): Promise<StarBlock | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('star_consensus', { p_match_id: matchId })
  if (error || !data) return null
  return data as StarBlock
}

export async function castPick(matchId: number, side: Side): Promise<void> {
  if (!supabase) {
    const m = demoMatches.find(x => x.id === matchId); if (!m || m.myPick === side) return
    if (m.myPick === 'a') m.votesA--; if (m.myPick === 'b') m.votesB--
    side === 'a' ? m.votesA++ : m.votesB++
    m.myPick = side
    return
  }
  const uid = (await supabase.auth.getSession()).data.session?.user.id
  if (!uid) throw new Error('no session')
  const { error } = await supabase.from('picks').upsert(
    { user_id: uid, match_id: matchId, side }, { onConflict: 'user_id,match_id' })
  if (error) throw error
}

export function onConsensusChange(cb: () => void): () => void {
  if (!supabase) return () => {}
  const ch = supabase.channel('consensus')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'picks' }, cb)
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}

// ---------- passes ----------
// Demo mode resolves instantly; with a backend we redirect to Stripe Checkout
// and the webhook (service role) is the only writer of `passes`.
export async function purchasePass(kind: 'single' | 'weekly', matchId?: number, sport: Sport = 'soccer'):
  Promise<'unlocked' | 'redirected'> {
  if (!supabase) return 'unlocked'
  const uid = (await supabase.auth.getSession()).data.session?.user.id
  if (!uid) throw new Error('no session')
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { kind, match_id: matchId ?? null, sport },
  })
  if (error || !data?.url) throw error ?? new Error('checkout failed')
  window.location.href = data.url as string
  return 'redirected'
}

// ---------- community ----------
let demoPosts: Post[] = JSON.parse(JSON.stringify(mockPosts))

export async function listPosts(matchId?: number): Promise<Post[]> {
  if (!supabase) return matchId ? demoPosts.filter(p => p.matchId === matchId) : demoPosts
  let q = supabase.from('posts')
    .select('id, match_id, body, created_at, profiles(handle)')
    .order('created_at', { ascending: false })
  if (matchId) q = q.eq('match_id', matchId)
  const { data, error } = await q
  if (error || !data) return []
  return data.map((r: any) => ({
    id: r.id, matchId: r.match_id, author: r.profiles?.handle ?? 'anon',
    starIn: [], upvotes: 0, body: r.body,
  }))
}

export async function addPost(matchId: number, _label: string, _sport: Sport, body: string): Promise<void> {
  if (!supabase) {
    demoPosts.unshift({ id: Date.now(), matchId, author: 'you', starIn: [], upvotes: 1, body })
    return
  }
  const uid = (await supabase.auth.getSession()).data.session?.user.id
  if (!uid) throw new Error('no session')
  // RLS rejects this insert unless the caller has a pick on the match.
  const { error } = await supabase.from('posts').insert({ user_id: uid, match_id: matchId, body })
  if (error) throw error
}
