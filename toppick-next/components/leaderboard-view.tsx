'use client'
import type { Sport } from '@/lib/types'
import type { LbRow } from '@/lib/api'
import { SportButtons, Badge } from './views'
import { Wilson } from './ui'
type T = (k: string, f: string) => string

export function LeaderboardLive({ lbSport, setLbSport, rows, me, loading, onOpenRow, t }:
  { lbSport: Sport; setLbSport: (s: Sport) => void; rows: LbRow[]; me: LbRow | null; loading: boolean; onOpenRow: (r: LbRow) => void; t: T }) {
  return (
    <section className="view on">
      <div className="sec-head"><div>
        <div className="eyebrow">{t('lb.eyebrow', 'Ranked by skill, measured with error bars')}</div>
        <h1 className="h-title">{t('lb.title', 'Leaderboard')}</h1>
        <p className="h-sub">{t('lb.sub', 'Skill Score rewards beating the crowd, not just being right. Star tier is the top 1% of each sport - tap any analyst to see their full record.')}</p>
      </div></div>
      <div className="lb-sports"><SportButtons cur={lbSport} onPick={setLbSport} t={t} /></div>
      <div className="lb-wrap">
        <div className="lb-row head">
          <span>{t('lb.rank', 'Rank')}</span><span>{t('lb.analyst', 'Analyst')}</span><span>{t('lb.skill', 'Skill')}</span>
          <span className="h-hide">{t('lb.interval', '95% skill interval')}</span><span>{t('lb.record', 'Record')}</span><span className="h-hide">{t('lb.trend', 'Trend')}</span>
        </div>
        {loading
          ? <div className="empty-note" style={{ padding: '32px 0' }}>{t('lb.loading', 'Loading rankings...')}</div>
          : rows.length === 0
            ? <div className="empty-note" style={{ padding: '32px 0', lineHeight: 1.6 }}>{t('lb.empty', 'No ranked analysts yet in this sport. Make 50+ scored picks over 90 days to appear here - be the first Star.')}</div>
            : rows.map(r => (
              <div className={`lb-row ${r.isStar ? 'star-row' : ''}`} key={r.userId} onClick={() => onOpenRow(r)}>
                <span className="lb-rank">{r.isStar ? <span className="m">{r.rank}</span> : r.rank}</span>
                <span className="lb-who"><span className={`av ${r.isStar ? 'g' : ''}`}>{r.initials}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="nm">{r.name} {r.isStar && <Badge sport={lbSport} t={t} />}</span>
                    <span className="h">{r.handle}</span>
                  </span></span>
                <span className={`lb-skill ${r.isStar ? 'g' : ''}`}>{r.skill.toFixed(1)}</span>
                <Wilson lo={r.lo} hi={r.hi} v={r.skill} gold={r.isStar} min={40} max={90} />
                <span className="lb-rec"><b>{r.w}</b>-{r.l} <span style={{ color: 'var(--dimmer)' }}>{'\u00b7'} n={r.n}</span></span>
                <span className="lb-trend" />
              </div>))
        }
      </div>
      {me && (
        <div className="lb-you">
          <span className="lb-rank">#{me.rank}</span>
          <span className="lb-who"><span className={`av ${me.isStar ? 'g' : ''}`}>{me.initials}</span>
            <span style={{ minWidth: 0 }}>
              <span className="nm">{me.name} <span style={{ color: 'var(--brand)', fontSize: 11 }}>{'\u00b7'} {t('lb.you.you', 'you')}</span> {me.isStar && <Badge sport={lbSport} t={t} />}</span>
              <span className="h">{me.handle}</span>
            </span></span>
          <span className="lb-skill" style={{ color: 'var(--brand)' }}>{me.skill.toFixed(1)}</span>
          <Wilson lo={me.lo} hi={me.hi} v={me.skill} min={40} max={90} />
          <span className="lb-rec"><b>{me.w}</b>-{me.l} <span style={{ color: 'var(--dimmer)' }}>{'\u00b7'} n={me.n}</span></span>
          <span className="tip">{me.isStar ? '\u2605' : ''} {t('lb.you.tip', 'to Star tier (top 1.0%)')}</span>
        </div>
      )}
    </section>
  )
}

export function AnalystModalLive({ row, sport, onClose, t }: { row: LbRow; sport: Sport; onClose: () => void; t: T }) {
  return (
    <div className="overlay open" onClick={e => { if ((e.target as HTMLElement).classList.contains('overlay')) onClose() }}>
      <div className="modal prof-modal">
        <div className="modal-head" style={{ padding: 0 }}><span /><button className="modal-x" style={{ margin: '12px 12px 0 0' }} onClick={onClose}>{'\u2715'}</button></div>
        <div className="pm-head">
          <span className={`pm-av ${row.isStar ? '' : 'plain'}`}>{row.initials}</span>
          <span className="pm-id">
            <span className="nm">{row.name} {row.isStar && <Badge sport={sport} t={t} />}</span>
            <span className="h">{row.handle}</span>
          </span>
        </div>
        <div className="pm-stats">
          <div className="pm-stat"><div className={`v ${row.isStar ? 'g' : ''}`}>{row.skill.toFixed(1)}</div><div className="l">{t('pm.skill', 'Skill')}</div></div>
          <div className="pm-stat"><div className="v">{row.w}-{row.l}</div><div className="l">{t('pm.record', 'Record')}</div></div>
          <div className="pm-stat"><div className="v">n={row.n}</div><div className="l">{t('pm.sample', 'Sample')}</div></div>
        </div>
      </div>
    </div>
  )
}