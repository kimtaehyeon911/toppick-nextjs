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
// Guard against concurrent callers: React StrictMode (and any parallel mount)
// fires this twice, and two simultaneous signInAnonymously() calls create two
// orphan users. Cache the in-flight promise so only one sign-in ever happens.
let sessionPromise: Promise<string> | null = null

export async function ensureSession(): Promise<string> {
  if (!supabase) return 'demo-user'
  if (sessionPromise) return sessionPromise

  sessionPromise = (async () => {
    const { data } = await supabase!.auth.getSession()
    if (data.session) return data.session.user.id

    // Anonymous sign-in must be enabled: Dashboard > Auth > Providers > Anonymous
    const { data: anon, error } = await supabase!.auth.signInAnonymously()
    if (error || !anon.session) {
      console.warn('[toppick] anonymous auth unavailable:', error?.message)
      sessionPromise = null
      return 'demo-user'
    }
    return anon.session.user.id
  })()

  return sessionPromise
}

// ---------- matches & consensus ----------
let demoMatches: Match[] = JSON.parse(JSON.stringify(mockMatches))
const EMPTY_STAR: StarBlock = { con: 50, n: 0, picks: [] }

export async function listMatches(): Promise<Match[]> {
  if (!supabase) return demoMatches
// Finished games stay visible for 3 days, then drop off the board.
  // They remain in the DB — scoring and track records are unaffected.
  const cutoff = new Date(Date.now() - 3 * 86400e3).toISOString()

  const { data: rows, error } = await supabase
    .from('matches')
    .select('id, sport, league, status, clock, team_a, team_b, result')
    .gte('starts_at', cutoff)
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

// ---------- account upgrade (anonymous -> permanent) ----------
// linkIdentity keeps the SAME user_id, so picks/scores/posts survive.
// Without this, clearing browser storage destroys the track record.

export type AuthState = {
  isAnonymous: boolean
  email: string | null
  pickCount: number
}

export async function getAuthState(): Promise<AuthState> {
  if (!supabase) return { isAnonymous: true, email: null, pickCount: 0 }
  const { data } = await supabase.auth.getSession()
  const u = data.session?.user
  if (!u) return { isAnonymous: true, email: null, pickCount: 0 }

  const { count } = await supabase
    .from('picks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', u.id)

  return {
    isAnonymous: u.is_anonymous ?? false,
    email: u.email ?? null,
    pickCount: count ?? 0,
  }
}

// Attach Google to the current anonymous session (same user_id).
export async function linkGoogle(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
  if (error) throw error
}

// Sign in with Google when there is no session to preserve.
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
  window.location.reload()
}
// ---------- my picks (the feedback loop) ----------
// A prediction market with no way to see whether you were right is half a
// product. Skill scores stay empty until a match clears the 30-vote floor
// (migration 0006), but correctness is knowable the moment a game resolves.

export type MyPick = {
  matchId: number
  sport: Sport
  league: string
  startsAt: string
  status: 'scheduled' | 'live' | 'final'
  teamA: { name: string; abbr: string; color: string }
  teamB: { name: string; abbr: string; color: string }
  side: Side
  result: Side | null
  correct: boolean | null     // null = not resolved yet
  skill: number | null        // null = not scored (crowd too small)
}

export async function listMyPicks(): Promise<MyPick[]> {
  if (!supabase) return []
  const uid = (await supabase.auth.getSession()).data.session?.user.id
  if (!uid) return []

  const { data, error } = await supabase
    .from('picks')
    .select(`
      id, side, match_id,
      matches ( id, sport, league, starts_at, status, team_a, team_b, result )
    `)
    .eq('user_id', uid)
    .order('created_at', { ascending: false })

  if (error || !data) { console.warn(error); return [] }

  // pick_scores is RLS-gated to the caller's own rows
  const { data: scores } = await supabase
    .from('pick_scores')
    .select('pick_id, skill')
  const skillMap = new Map((scores ?? []).map(s => [s.pick_id, Number(s.skill)]))

  return data.flatMap((r: any) => {
    const m = r.matches
    if (!m) return []
    const result = (m.result ?? null) as Side | null
    return [{
      matchId: m.id,
      sport: m.sport as Sport,
      league: String(m.league),
      startsAt: m.starts_at,
      status: m.status,
      teamA: { name: m.team_a.name, abbr: m.team_a.abbr, color: m.team_a.color },
      teamB: { name: m.team_b.name, abbr: m.team_b.abbr, color: m.team_b.color },
      side: r.side as Side,
      result,
      correct: result ? r.side === result : null,
      skill: skillMap.get(r.id) ?? null,
    }]
  })
}