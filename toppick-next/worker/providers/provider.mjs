// Provider adapter — the ONLY file that knows the sports data API.
// TheSportsDB free tier.

const KEY = process.env.SPORTS_API_KEY || '3'
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`

// slug must match lib/mock.ts LEAGUES ids.
// slug must match lib/mock.ts LEAGUES ids.
// Ordered by popularity in the US (primary market) / Korea (secondary).
const LEAGUES = {
  football: [
    { id: '4391', name: 'NFL',             slug: 'nfl' },
  ],
  basketball: [
    { id: '4387', name: 'NBA',             slug: 'nba' },
    { id: '4472', name: 'KBL',             slug: 'kbl' },
  ],
  baseball: [
    { id: '4424', name: 'MLB',             slug: 'mlb' },
    { id: '4830', name: 'KBO',             slug: 'kbo' },
    { id: '4425', name: 'NPB',             slug: 'npb' },
  ],
  soccer: [
    { id: '4328', name: 'Premier League',  slug: 'epl' },
    { id: '4335', name: 'La Liga',         slug: 'laliga' },
    { id: '4331', name: 'Bundesliga',      slug: 'bundesliga' },
    { id: '4332', name: 'Serie A',         slug: 'seriea' },
    { id: '4346', name: 'MLS',             slug: 'mls' },
  ],
  ufc: [
    { id: '4443', name: 'UFC',             slug: 'ufc' },
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

  // strip the event-title prefix from the left fighter:
  //   "UFC Fight Night 281 Du Plessis" -> "Du Plessis"
  //   "UFC 300 Pereira"                -> "Pereira"
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
    teamA: { name: a, abbr: abbr(a), color: color(a) },
    teamB: { name: b, abbr: abbr(b), color: color(b) },
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
        const m = mapEvent(ev, lg.slug)
        if (m && m.status !== 'final') out.push(m)
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
        const m = mapEvent(ev, lg.slug)
        if (!m || m.status !== 'final' || m.homeScore == null || m.awayScore == null) continue
        const winner = m.homeScore > m.awayScore ? 'a' : m.awayScore > m.homeScore ? 'b' : null
        out.push({ extId: m.extId, winner })
      }
    } catch (e) { console.error(`[provider] results ${sport}/${lg.name}:`, e.message) }
  }
  return out
}