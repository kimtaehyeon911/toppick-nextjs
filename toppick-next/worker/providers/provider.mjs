// Provider adapter — the ONLY file that knows the sports data API.
// TheSportsDB free tier.

const KEY = process.env.SPORTS_API_KEY || '3'
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`

// How far ahead to ingest. Season endpoints return the whole calendar;
// anything beyond this window is noise for a prediction market.
const HORIZON_DAYS = 50

// slug must match lib/mock.ts LEAGUES ids.
// Ordered by popularity in the US (primary market) / Korea (secondary).
const LEAGUES = {
  football: [
    { id: '4391', name: 'NFL',            slug: 'nfl',        season: '2026' },
  ],
  basketball: [
    { id: '4387', name: 'NBA',            slug: 'nba',        season: '2026-2027' },
    { id: '4472', name: 'KBL',            slug: 'kbl',        season: '2026-2027' },
  ],
  baseball: [
    { id: '4424', name: 'MLB',            slug: 'mlb',        season: '2026' },
    { id: '4830', name: 'KBO',            slug: 'kbo',        season: '2026' },
    { id: '4425', name: 'NPB',            slug: 'npb',        season: '2026' },
  ],
  soccer: [
    { id: '4328', name: 'Premier League', slug: 'epl',        season: '2026-2027' },
    { id: '4335', name: 'La Liga',        slug: 'laliga',     season: '2026-2027' },
    { id: '4331', name: 'Bundesliga',     slug: 'bundesliga', season: '2026-2027' },
    { id: '4332', name: 'Serie A',        slug: 'seriea',     season: '2026-2027' },
    { id: '4346', name: 'MLS',            slug: 'mls',        season: '2026' },
  ],
  ufc: [
    { id: '4443', name: 'UFC',            slug: 'ufc',        season: '2026' },
  ],
}

const PALETTE = ['#EF3340', '#6CABDD', '#005A9C', '#A50044', '#FEBE10', '#4A6FA5', '#C30452', '#131230', '#8895a7', '#D64550']
const color = (name) => PALETTE[[...String(name)].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length]
const abbr = (name) => String(name).replace(/[^A-Za-z0-9 ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'TBD'

async function getJSON(path) {
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json()
}

// MMA events leave strHomeTeam/strAwayTeam null; fighter names live in strEvent:
//   "UFC Fight Night 281 Du Plessis vs Usman"
//   "UFC 300: Pereira vs. Hill"
function parseFighters(ev) {
  let s = ev.strEvent ?? ''
  if (s.includes(':')) s = s.split(':').slice(1).join(':')

  const parts = s.split(/\s+vs\.?\s+/i)
  if (parts.length < 2) return [null, null]

  let a = parts[0].trim()
  const b = parts[1].trim()
  a = a.replace(/^UFC\s+(?:Fight\s+Night|Fight\s+Pass|on\s+\S+)?\s*\d*\s*/i, '').trim()

  if (!a || !b) return [null, null]
  return [a, b]
}

function mapEvent(ev, leagueSlug) {
  const done = ev.strStatus === 'Match Finished' || ev.strStatus === 'FT' ||
    (ev.intHomeScore != null && ev.intAwayScore != null && ev.strStatus !== 'Not Started')
  const live = !done && ev.strStatus && !['Not Started', 'NS', ''].includes(ev.strStatus)

  let a = ev.strHomeTeam, b = ev.strAwayTeam
  if (!a || !b) { const [fa, fb] = parseFighters(ev); a = a || fa; b = b || fb }
  if (!a || !b) return null

  return {
    extId: `tsdb-${ev.idEvent}`,
    league: leagueSlug,
    startsAt: ev.strTimestamp ?? `${ev.dateEvent}T${ev.strTime ?? '00:00:00'}Z`,
    status: done ? 'final' : live ? 'live' : 'scheduled',
    clock: live ? (ev.strProgress ?? 'LIVE') : done ? 'FT' : '',
    teamA: { name: a, abbr: abbr(a), color: color(a), logo: ev.strHomeTeamBadge ?? null },
    teamB: { name: b, abbr: abbr(b), color: color(b), logo: ev.strAwayTeamBadge ?? null },
    homeScore: ev.intHomeScore != null ? Number(ev.intHomeScore) : null,
    awayScore: ev.intAwayScore != null ? Number(ev.intAwayScore) : null,
  }
}

// Season endpoint returns the full calendar; keep only the near horizon.
function withinHorizon(m) {
  const t = Date.parse(m.startsAt)
  if (Number.isNaN(t)) return false
  const now = Date.now()
  return t > now - 6 * 3600e3 && t < now + HORIZON_DAYS * 86400e3
}

export async function fetchFixtures(sport) {
  const out = []
  const seen = new Set()

  for (const lg of LEAGUES[sport] ?? []) {
    // Two endpoints, merged:
    //   eventsnextleague → next games for leagues currently IN SEASON
    //   eventsseason     → opening fixtures for leagues NOT YET started
    // (free tier caps each at ~5 events; ext_id upsert dedupes overlap)
    const paths = [
      `eventsnextleague.php?id=${lg.id}`,
      `eventsseason.php?id=${lg.id}&s=${lg.season}`,
    ]

    for (const path of paths) {
      try {
        const data = await getJSON(path)
        for (const ev of data.events ?? []) {
          const m = mapEvent(ev, lg.slug)
          if (!m || m.status === 'final' || !withinHorizon(m)) continue
          if (seen.has(m.extId)) continue
          seen.add(m.extId)
          out.push(m)
        }
      } catch (e) {
        console.error(`[provider] ${sport}/${lg.name} ${path.split('.')[0]}:`, e.message)
      }
    }
  }
  return out
}

export async function fetchFinishedResults(sport) {
  const out = []
  for (const lg of LEAGUES[sport] ?? []) {
    try {
      const data = await getJSON(`eventspastleague.php?id=${lg.id}`)
      for (const ev of data.events ?? []) {
        const m = mapEvent(ev, lg.slug)
        if (!m || m.status !== 'final' || m.homeScore == null || m.awayScore == null) continue
        const winner = m.homeScore > m.awayScore ? 'a' : m.awayScore > m.homeScore ? 'b' : null
        out.push({ extId: m.extId, winner })
      }
    } catch (e) { console.error(`[provider] results ${sport}/${lg.name}:`, e.message) }
  }
  return out
}