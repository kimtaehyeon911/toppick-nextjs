// ============================================================
// Top Pick — results ingestion worker
// Runs on any scheduler (GitHub Actions cron included in repo,
// or Railway/Fly/EC2 cron). Uses the SERVICE ROLE key — never
// ship this to the browser.
//
//   node worker/index.mjs ingest    # upsert upcoming fixtures
//   node worker/index.mjs resolve   # finish games -> resolve_match()
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (required)
//   SPORTS_API_KEY                            (provider key; see providers/)
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { fetchFixtures, fetchFinishedResults } from './providers/provider.mjs'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const db = createClient(url, key)

const SPORTS = ['soccer', 'baseball', 'basketball', 'ufc']
const mode = process.argv[2] ?? 'ingest'

// ---------- ingest: upsert upcoming/live fixtures ----------
async function ingest() {
  for (const sport of SPORTS) {
    const fixtures = await fetchFixtures(sport) // [{extId, league, startsAt, status, clock, teamA, teamB}]
    if (!fixtures.length) { console.log(`[${sport}] no fixtures from provider`); continue }
    for (const f of fixtures) {
      // ext_id keeps provider ids stable across runs; add the column once:
      //   alter table matches add column if not exists ext_id text unique;
      const { error } = await db.from('matches').upsert({
        ext_id: f.extId,
        sport,
        league: f.league,
        starts_at: f.startsAt,
        status: f.status,          // 'scheduled' | 'live'
        clock: f.clock,
        team_a: f.teamA,           // {name, abbr, color}
        team_b: f.teamB,
      }, { onConflict: 'ext_id' })
      if (error) console.error(`[${sport}] upsert ${f.extId}:`, error.message)
    }
    console.log(`[${sport}] upserted ${fixtures.length} fixtures`)
  }
}

// ---------- resolve: finished games -> score every pick ----------
async function resolve() {
  // matches we still consider open
  const { data: open, error } = await db
    .from('matches')
    .select('id, ext_id, sport')
    .is('result', null)
    .not('ext_id', 'is', null)
  if (error) throw error
  if (!open?.length) { console.log('nothing open'); return }

  const byExt = new Map(open.map(m => [m.ext_id, m]))
  for (const sport of SPORTS) {
    const finished = await fetchFinishedResults(sport) // [{extId, winner: 'a'|'b'|null}]
    for (const r of finished) {
      const m = byExt.get(r.extId)
      if (!m || !r.winner) continue
      // resolve_match scores every pick with crowd-relative Brier skill
      const { error: e } = await db.rpc('resolve_match', { p_match_id: m.id, p_winner: r.winner })
      if (e) console.error(`resolve ${m.id}:`, e.message)
      else console.log(`resolved match ${m.id} (${sport}) -> ${r.winner}`)
    }
  }
}

// ---------- run ----------
try {
  if (mode === 'ingest') await ingest()
  else if (mode === 'resolve') await resolve()
  else { console.error(`unknown mode "${mode}" (use: ingest | resolve)`); process.exit(1) }
  console.log('done')
} catch (e) {
  console.error(e); process.exit(1)
}
