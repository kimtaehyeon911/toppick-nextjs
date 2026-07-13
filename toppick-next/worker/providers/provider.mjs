// ============================================================
// Provider adapter — the ONLY file that knows the sports data API.
// Reference implementation: TheSportsDB (free tier, good for dev).
// For production volume/latency switch to a commercial feed
// (API-SPORTS, Sportradar, SportsDataIO) by rewriting these two
// functions; the worker and DB never change.
//
// Contract:
//   fetchFixtures(sport)        -> [{ extId, league, startsAt, status, clock, teamA, teamB }]
//   fetchFinishedResults(sport) -> [{ extId, winner: 'a' | 'b' | null }]   // null = draw/void -> skipped
// ============================================================

const KEY = process.env.SPORTS_API_KEY || '3' // '3' = TheSportsDB free test key
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`

// League ids to track per sport (TheSportsDB ids). Extend freely.
const LEAGUES = {
  // `slug` must match the frontend league tab ids in src/mock.ts LEAGUES.
  // TheSportsDB has no UCL/UEL fixtures on the free tier; Premier League /
  // La Liga are mapped onto the top-2 soccer tabs for v1 ingestion. Swap ids
  // when moving to a paid data provider.
  soccer:   [{ id: '4328', name: 'Premier League', slug: 'ucl' }, { id: '4335', name: 'La Liga', slug: 'uel' }],
  baseball: [{ id: '4424', name: 'MLB', slug: 'mlb' }],
  basketball: [{ id: '4387', name: 'NBA', slug: 'nba' }],
  ufc:      [{ id: '4443', name: 'UFC', slug: 'ppv' }],
}

const PALETTE = ['#EF3340', '#6CABDD', '#005A9C', '#A50044', '#FEBE10', '#4A6FA5', '#C30452', '#131230', '#8895a7', '#D64550']
const color = (name) => PALETTE[[...String(name)].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length]
const abbr = (name) => String(name).replace(/[^A-Za-z0-9 ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'TBD'

async function getJSON(path) {
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json()
}

function mapEvent(ev, leagueName) {
  const done = ev.strStatus === 'Match Finished' || ev.strStatus === 'FT' || (ev.intHomeScore != null && ev.intAwayScore != null && ev.strStatus !== 'Not Started')
  const live = !done && ev.strStatus && !['Not Started', 'NS', ''].includes(ev.strStatus)
  return {
    extId: `tsdb-${ev.idEvent}`,
    league: leagueName,
    startsAt: ev.strTimestamp ?? `${ev.dateEvent}T${ev.strTime ?? '00:00:00'}Z`,
    status: done ? 'final' : live ? 'live' : 'scheduled',
    clock: live ? (ev.strProgress ?? 'LIVE') : done ? 'FT' : '',
    teamA: { name: ev.strHomeTeam, abbr: abbr(ev.strHomeTeam), color: color(ev.strHomeTeam) },
    teamB: { name: ev.strAwayTeam, abbr: abbr(ev.strAwayTeam), color: color(ev.strAwayTeam) },
    homeScore: ev.intHomeScore != null ? Number(ev.intHomeScore) : null,
    awayScore: ev.intAwayScore != null ? Number(ev.intAwayScore) : null,
  }
}

export async function fetchFixtures(sport) {
  const out = []
  for (const lg of LEAGUES[sport] ?? []) {
    try {
      const data = await getJSON(`eventsnextleague.php?id=${lg.id}`)
      for (const ev of data.events ?? []) {
        const m = mapEvent(ev, lg.slug ?? lg.name)
        if (m.status !== 'final') out.push(m)
      }
    } catch (e) { console.error(`[provider] fixtures ${sport}/${lg.name}:`, e.message) }
  }
  return out
}

export async function fetchFinishedResults(sport) {
  const out = []
  for (const lg of LEAGUES[sport] ?? []) {
    try {
      const data = await getJSON(`eventspastleague.php?id=${lg.id}`)
      for (const ev of data.events ?? []) {
        const m = mapEvent(ev, lg.slug ?? lg.name)
        if (m.status !== 'final' || m.homeScore == null || m.awayScore == null) continue
        // Draws return null and are skipped (v1 product = two-way markets;
        // add a 'draw' side or void policy when soccer 3-way markets ship).
        const winner = m.homeScore > m.awayScore ? 'a' : m.awayScore > m.homeScore ? 'b' : null
        out.push({ extId: m.extId, winner })
      }
    } catch (e) { console.error(`[provider] results ${sport}/${lg.name}:`, e.message) }
  }
  return out
}
