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

// ---------- passes (Paddle) ----------
// Flow: edge fn creates a Paddle transaction → Paddle.js opens the overlay
// → on completion Paddle calls paddle-webhook (the only writer of `passes`).
// The frontend never writes passes directly.

let paddleReady = false

function initPaddle(): any {
  const P = (window as any).Paddle
  if (!P) return null
  if (!paddleReady) {
    if (process.env.NEXT_PUBLIC_PADDLE_ENV === 'sandbox') P.Environment.set('sandbox')
    P.Initialize({ token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN! })
    paddleReady = true
  }
  return P
}

export async function purchasePass(
  kind: 'single' | 'weekly',
  matchId?: number,
  sport: Sport = 'soccer',
  onComplete?: () => void,
): Promise<'unlocked' | 'redirected'> {
  if (!supabase) return 'unlocked'   // demo mode

  const P = initPaddle()
  if (!P) throw new Error('Paddle not loaded')

// Pass the user's own JWT so the edge fn resolves the RIGHT uid.
  // Without this, invoke() sends the anon key and the pass gets attributed
  // to the wrong (or anonymous) account.
  const session = (await supabase.auth.getSession()).data.session
  if (!session) throw new Error('no session')

  const { data, error } = await supabase.functions.invoke('paddle-checkout', {
    body: { kind, sport, matchId: matchId ?? null },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error || !data?.transactionId) {
    throw error ?? new Error('checkout failed')
  }

  P.Checkout.open({ transactionId: data.transactionId })

  // Don't rely on Paddle's eventCallback (flaky across environments).
  // Poll the passes table directly; when the webhook lands, close the
  // overlay and refresh the UI. Works regardless of Paddle event quirks.
  pollForPass(kind, matchId, sport, () => {
    try { P.Checkout.close() } catch {}
    onComplete?.()
  })

  return 'redirected'
}

// The webhook may take a second or two. Poll a few times, then give up
// gracefully (the pass will still be there on next page load).
async function pollForPass(
  kind: 'single' | 'weekly',
  matchId: number | undefined,
  sport: Sport,
  onComplete?: () => void,
) {
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500))
    const ent = await getEntitlements()
    const got = kind === 'single'
      ? (matchId != null && ent.singles.includes(matchId))
      : ent.weeklies.includes(sport)
    if (got) { onComplete?.(); return }
  }
  onComplete?.()
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
// ---------- skill (real, from user_skill view) ----------
// The product's whole claim is "one number that can't be gamed". Showing a
// mock number here would undermine that. Empty is honest; fake is not.

export type SkillRow = {
  sport: Sport
  n: number
  wins: number
  losses: number
  score: number      // display_score (50 = crowd-level)
  lo: number
  hi: number
}

export type SkillSummary = {
  bySport: SkillRow[]
  overall: SkillRow | null   // the sport with the most resolved picks
  totalN: number
}

export async function getSkill(): Promise<SkillSummary> {
  const empty: SkillSummary = { bySport: [], overall: null, totalN: 0 }
  if (!supabase) return empty

  const uid = (await supabase.auth.getSession()).data.session?.user.id
  if (!uid) return empty

  // user_skill is grouped by (user_id, sport); RLS limits rows to the caller
  const { data, error } = await supabase
    .from('user_skill')
    .select('sport, n, wins, losses, display_score, display_lo, display_hi')
    .eq('user_id', uid)

  if (error || !data?.length) return empty

  const bySport: SkillRow[] = data.map((r: any) => ({
    sport: r.sport as Sport,
    n: Number(r.n),
    wins: Number(r.wins),
    losses: Number(r.losses),
    score: Number(r.display_score),
    lo: Number(r.display_lo),
    hi: Number(r.display_hi),
  }))

  const overall = bySport.reduce((best, r) => (!best || r.n > best.n ? r : best),
    null as SkillRow | null)

  return { bySport, overall, totalN: bySport.reduce((s, r) => s + r.n, 0) }
}


// ---------- leaderboard (real, from leaderboard view) ----------
export type LbRow = {
  rank: number
  userId: string
  name: string
  handle: string
  initials: string
  skill: number
  lo: number
  hi: number
  w: number
  l: number
  n: number
  isStar: boolean
}

export async function getLeaderboard(sport: string): Promise<LbRow[]> {
  if (!hasBackend || !supabase) return []
  const { data, error } = await supabase
    .from('leaderboard')
    .select('rank, user_id, display_name, handle, initials, skill, lo, hi, wins, losses, n, is_star')
    .eq('sport', sport)
    .order('rank', { ascending: true })
    .limit(100)
  if (error || !data) return []
  return data.map((r: any) => ({
    rank: Number(r.rank),
    userId: r.user_id,
    name: r.display_name ?? 'Anonymous',
    handle: r.handle ?? '',
    initials: r.initials ?? '??',
    skill: Number(r.skill),
    lo: Number(r.lo),
    hi: Number(r.hi),
    w: Number(r.wins),
    l: Number(r.losses),
    n: Number(r.n),
    isStar: !!r.is_star,
  }))
}

// ---------- entitlements (what passes unlock) ----------
// The webhook writes passes asynchronously, so the client reads them back
// to learn what it can view. Single -> that match; weekly -> that sport
// until expiry.

export type Entitlements = {
  singles: number[]     // match_ids unlocked
  weeklies: Sport[]     // sports unlocked (unexpired)
}

export async function getEntitlements(): Promise<Entitlements> {
  if (!supabase) return { singles: [], weeklies: [] }
  const uid = (await supabase.auth.getSession()).data.session?.user.id
  if (!uid) return { singles: [], weeklies: [] }

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('passes')
    .select('kind, sport, match_id, expires_at')
    .eq('user_id', uid)

  if (error || !data) return { singles: [], weeklies: [] }

  const singles: number[] = []
  const weeklies: Sport[] = []
  for (const p of data) {
    if (p.kind === 'single' && p.match_id != null) {
      singles.push(Number(p.match_id))
    } else if (p.kind === 'weekly') {
      // weekly valid only if not expired
      if (!p.expires_at || p.expires_at > nowIso) weeklies.push(p.sport as Sport)
    }
  }
  return { singles, weeklies }
}
// ---------- consent (clickwrap) ----------
// Active, versioned consent stored server-side. When TERMS_VERSION bumps,
// users are re-prompted. This is the provable record attorneys asked for.

export const TERMS_VERSION = '2026-07-15'

export async function getConsent(): Promise<{ agreed: boolean }> {
  if (!supabase) return { agreed: true }   // demo mode: don't block
  const uid = (await supabase.auth.getSession()).data.session?.user.id
  if (!uid) return { agreed: false }

  const { data } = await supabase
    .from('profiles')
    .select('agreed_version, age_confirmed')
    .eq('id', uid)
    .maybeSingle()

  const agreed = Boolean(
    data?.age_confirmed && data?.agreed_version === TERMS_VERSION)
  return { agreed }
}

export async function recordConsent(): Promise<void> {
  if (!supabase) return
  const uid = (await supabase.auth.getSession()).data.session?.user.id
  if (!uid) throw new Error('no session')

  const { error } = await supabase
    .from('profiles')
    .update({
      agreed_at: new Date().toISOString(),
      agreed_version: TERMS_VERSION,
      age_confirmed: true,
    })
    .eq('id', uid)
  if (error) throw error
}
