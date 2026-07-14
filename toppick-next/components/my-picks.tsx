'use client'
import { useEffect, useState } from 'react'
import { listMyPicks, hasBackend, type MyPick } from '@/lib/api'
import { useApp } from './providers'

export function MyPicks() {
  const { t } = useApp()
  const [picks, setPicks] = useState<MyPick[] | null>(null)

  useEffect(() => {
    if (!hasBackend) { setPicks([]); return }
    listMyPicks().then(setPicks).catch(() => setPicks([]))
  }, [])

  if (!hasBackend) return null
  if (picks === null) return null           // loading
  if (picks.length === 0) {
    return (
      <div className="card mp-card">
        <div className="k">{t('mp.title', 'My picks')}</div>
        <div className="mp-empty">
          {t('mp.empty', 'No picks yet. Call a game and your record starts here.')}
        </div>
      </div>
    )
  }

  const resolved = picks.filter(p => p.correct !== null)
  const hits = resolved.filter(p => p.correct).length

  return (
    <div className="card mp-card">
      <div className="mp-head">
        <span className="k">{t('mp.title', 'My picks')}</span>
        {resolved.length > 0 && (
          <span className="mp-rec mono">
            {hits}–{resolved.length - hits}
            <em>{Math.round((hits / resolved.length) * 100)}%</em>
          </span>
        )}
      </div>

      <ul className="mp-list">
        {picks.map(p => {
          const picked = p.side === 'a' ? p.teamA : p.teamB
          const other  = p.side === 'a' ? p.teamB : p.teamA
          const state  = p.correct === null ? 'open' : p.correct ? 'hit' : 'miss'
          return (
            <li key={p.matchId} className={`mp-row ${state}`}>
              <span className="mp-dot" style={{ background: picked.color }} />
              <span className="mp-teams">
                <b>{picked.name}</b>
                <span className="mp-vs">vs {other.name}</span>
              </span>
              <span className="mp-league mono">{p.league.toUpperCase()}</span>
              <span className="mp-state">
                {state === 'open' ? t('mp.open', 'Open')
                  : state === 'hit' ? t('mp.hit', 'Hit')
                  : t('mp.miss', 'Miss')}
              </span>
              <span className="mp-skill mono">
                {p.skill === null ? '—'
                  : (p.skill > 0 ? '+' : '') + p.skill.toFixed(2)}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mp-note">
        {t('mp.note', 'Skill is only scored once a match draws 30+ picks — the crowd needs to be a real benchmark.')}
      </div>
    </div>
  )
}