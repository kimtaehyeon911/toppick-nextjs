// Provider adapter — the ONLY file that knows the sports data API.
// TheSportsDB free tier.

const KEY = process.env.SPORTS_API_KEY || '3'
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`

// slug must match lib/mock.ts LEAGUES ids.
const LEAGUES = {
  soccer:   [{ id: '4328', name: 'Premier League', slug: 'epl' },
             { id: '4335', name: 'La Liga',        slug: 'laliga' }],
  baseball: [{ id: '4424', name: 'MLB',            slug: 'mlb' }],
  basketball: [{ id: '4387', name: 'NBA',          slug: 'nba' }],
  ufc:      [{ id: '4443', name: 'UFC',            slug: 'ufc' }],
}

const PALETTE = ['#EF3340', '#6CABDD', '#005A9C', '#A50044', '#FEBE10', '#4A6FA5', '#C30452', '#131230', '#8895a7', '#D64550']
const color = (name) => PALETTE[[...String(name)].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length]
const abbr = (name) => String(name).replace(/[^A-Za-z0-9 ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'TBD'

async function getJSON(path) {
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json()
}

// MMA events have empty strHomeTeam/strAwayTeam; names live in strEvent
// e.g. "UFC 300: Pereira vs. Hill"
function parseFighters(ev) {
  const s = ev.strEvent ?? ''
  const body = s.includes(':') ? s.split(':').slice(1).join(':') : s
  const parts = body.split(/\s+vs\.?\s+/i)
  if (parts.length >= 2) return [parts[0].trim(), parts[1].trim()]
  return [null, null]
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