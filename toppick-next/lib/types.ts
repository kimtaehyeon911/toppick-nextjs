export type Sport = 'soccer' | 'baseball' | 'basketball' | 'ufc' | 'football'
export type Side = 'a' | 'b'

export interface Team { name: string; abbr: string; color: string }
export interface League { id: string; name: string; pop: number }

export interface StarPickRow { analystIdx: number; side: Side; conf: string }
export interface StarBlock { con: number; n: number; picks: StarPickRow[] }

export interface Match {
  id: number
  sport: Sport
  leagueId: string
  status: 'scheduled' | 'live' | 'final'
  clock: string
  a: Team
  b: Team
  votesA: number
  votesB: number
  myPick: Side | null
  star: StarBlock
}

export interface Analyst {
  name: string; handle: string; initials: string
  skill: number; lo: number; hi: number
  w: number; l: number; n: number
  starIn: Sport[]
}

export interface Post {
  id: number
  matchId: number
  author: string
  starIn: Sport[]
  upvotes: number
  body: string
}

export interface MySportRecord { rank: number; skill: number; lo: number; hi: number; w: number; l: number; n: number; pct: string }
