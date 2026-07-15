'use client'
import { useState, useEffect } from 'react'
import type { Match, Side, Sport, Analyst, Post } from '@/lib/types'
import { SPORTS, LEAGUES, ANALYSTS, YOU } from '@/lib/mock'
import { Wilson } from './ui'
import { getSkill, hasBackend, type SkillSummary } from '@/lib/api'

type T = (k: string, f: string) => string
const ic = (s: Sport) => SPORTS.find(x => x.id === s)!.ic
const pct = (a: number, b: number) => { const s = a + b; return s ? Math.round(a / s * 100) : 50 }
const leagueName = (m: Match) => LEAGUES[m.sport].find(l => l.id === m.leagueId)?.name ?? ''

export function Badge({ sport, t }: { sport: Sport; t: T }) {
  return <span className={`sbadge ${sport}`}>{ic(sport)} {t('pm.star', 'Star')}</span>
}

export function SportButtons({ cur, onPick, t }: { cur: Sport; onPick: (s: Sport) => void; t: T }) {
  return (
    <div className="sports">
      {SPORTS.map(s => (
        <button key={s.id} className={`sport-btn ${s.id === cur ? 'on' : ''}`} onClick={() => onPick(s.id)}>
          <span className="ic">{s.ic}</span>{t('sport.' + s.id, s.id === 'ufc' ? 'UFC' : s.id[0].toUpperCase() + s.id.slice(1))}
        </button>))}
    </div>
  )
}

export function LeagueTabs({ sport, cur, onPick }: { sport: Sport; cur: string; onPick: (id: string) => void }) {
  return (
    <div className="leagues">
      {LEAGUES[sport].map((l, i) => (
        <button key={l.id} className={`league-tab ${l.id === cur ? 'on' : ''}`} onClick={() => onPick(l.id)}>
          <span className="rank-n">{i + 1}</span>{l.name}<span className="cnt">{(l.pop / 1000).toFixed(1)}k</span>
        </button>))}
    </div>
  )
}

function Status({ m }: { m: Match }) {
  return m.status === 'live'
    ? <span className="status live"><span className="d" />LIVE {m.clock}</span>
    : <span className="status soon">{m.clock}</span>
}

function StarPanel({ m, freeReason, t }: { m: Match; freeReason: string; t: T }) {
  const sc = m.star.con, scb = 100 - sc
  return (
    <div className="star-panel" onClick={e => e.stopPropagation()}>
      <div className="sp-head"><span className="l">★ {t('starcon', 'Star consensus')}</span><span className="n">{m.star.n} {t('analysts', 'analysts')}</span></div>
      <div className="sp-con"><span><b>{sc}%</b> {m.a.name}</span><span>{m.b.name} <b>{scb}%</b></span></div>
      <div className="bar gold"><div className="fill" style={{ width: `${sc}%` }} /></div>
      <div className="sp-picks">
        {m.star.picks.map((p, i) => {
          const a = ANALYSTS[m.sport][p.analystIdx]
          return (
            <div className="sp-pick" key={i}>
              <span className="av">{a.initials}</span>
              <span className="who"><span className="nm">{a.name}</span>{a.starIn.map(sp => <Badge key={sp} sport={sp} t={t} />)}</span>
              <span className="pk">{p.side === 'a' ? m.a.name : m.b.name}</span><span className="cf">{p.conf}</span>
            </div>)
        })}
      </div>
      <div className="sp-free">✓ {freeReason}</div>
    </div>
  )
}

function Consensus({ m, big, t }: { m: Match; big?: boolean; t: T }) {
  const pa = pct(m.votesA, m.votesB), pb = 100 - pa, aLead = pa >= pb
  return (
    <div className={`consensus${big ? ' big' : ''}`}>
      <div className="con-top">
        <span className={`con-pct ${aLead ? 'lead' : 'trail'}`}>{pa}%</span>
        <span className="con-lb">{t('consensus', 'Consensus')}</span>
        <span className={`con-pct ${!aLead ? 'lead' : 'trail'}`}>{pb}%</span>
      </div>
      <div className="bar"><div className="fill" style={{ width: `${pa}%` }} /></div>
      <div className="con-bot">
        <span className="n">{m.votesA.toLocaleString()}</span>
        <span className="n">{(m.votesA + m.votesB).toLocaleString()} {t('picks', 'picks')}</span>
        <span className="n">{m.votesB.toLocaleString()}</span>
      </div>
    </div>
  )
}

function VoteBlock({ m, viewable, open, onVote, onStar, t }:
  { m: Match; viewable: boolean; open: boolean; onVote: (id: number, s: Side) => void; onStar: () => void; t: T }) {
  return (
    <>
      <div className="vote-head">
        <span className="vh-lb">{t('castpick', 'Cast your pick')}</span>
        <button className={`star-mini ${open ? 'open-state' : ''}`} onClick={e => { e.stopPropagation(); onStar() }}>
          ★ {t('starpicks', 'Star picks')} <span className="lk">{viewable ? (open ? '▲' : '▼') : '🔒'}</span>
        </button>
      </div>
      <div className="vote-row">
        <button className={`vbtn ${m.myPick === 'a' ? 'picked' : ''} ${m.myPick === 'b' ? 'dim' : ''}`}
          onClick={e => { e.stopPropagation(); onVote(m.id, 'a') }}>{m.a.name}</button>
        <button className={`vbtn ${m.myPick === 'b' ? 'picked' : ''} ${m.myPick === 'a' ? 'dim' : ''}`}
          onClick={e => { e.stopPropagation(); onVote(m.id, 'b') }}>{m.b.name}</button>
      </div>
    </>
  )
}

export function MatchCard({ m, open, viewable, postCount, onVote, onOpen, onStar, t }:
  { m: Match; open: boolean; viewable: boolean; postCount: number; onVote: (id: number, s: Side) => void; onOpen: (id: number) => void; onStar: () => void; t: T }) {
  return (
    <div className="card" onClick={() => onOpen(m.id)}>
      <div className="card-top">
        <div className="meta"><span className="lg-ic">{ic(m.sport)}</span>{leagueName(m)}</div>
        <Status m={m} />
      </div>
      <div className="matchup">
        <div className="side"><div className="bdg" style={{ background: m.a.color }}>{m.a.abbr}</div>
          <div><div className="nm">{m.a.name}</div><div className="sub">{m.a.abbr}</div></div></div>
        <div className="vs">VS</div>
        <div className="side r"><div className="bdg" style={{ background: m.b.color }}>{m.b.abbr}</div>
          <div><div className="nm">{m.b.name}</div><div className="sub">{m.b.abbr}</div></div></div>
      </div>
      <Consensus m={m} t={t} />
      <VoteBlock m={m} viewable={viewable} open={open} onVote={onVote} onStar={onStar} t={t} />
      {open && <StarPanel m={m} freeReason={t('sp.free', 'Pass applied')} t={t} />}
      {m.myPick
        ? <button className="comm-btn" onClick={e => { e.stopPropagation(); onOpen(m.id) }}>💬 {t('joindisc', 'Join the discussion')} <span className="ct">{postCount}</span></button>
        : <button className="comm-btn locked" onClick={e => e.stopPropagation()}>🔒 {t('votetounlock', 'Vote to unlock the discussion')}</button>}
    </div>
  )
}

export function MatchDetail({ m, viewable, open, posts, myStars, onVote, onStar, onBack, onPost, t }:
  { m: Match; viewable: boolean; open: boolean; posts: Post[]; myStars: Set<Sport>; onVote: (id: number, s: Side) => void; onStar: () => void; onBack: () => void; onPost: (m: Match, body: string) => void; t: T }) {
  const [draft, setDraft] = useState('')
  const pickedName = m.myPick === 'a' ? m.a.name : m.myPick === 'b' ? m.b.name : null
  const threadList = posts.length === 0
    ? <div className="empty-note" style={{ padding: '20px 0', border: 'none' }}>{t('detail.empty', 'No takes yet. Be the first to make the case.')}</div>
    : posts.map(p => (
      <div className="thread" key={p.id}>
        <div className="up"><button onClick={e => { const c = e.currentTarget.nextElementSibling as HTMLElement; c.textContent = String(+c.textContent! + 1) }}>▲</button><span className="c">{p.upvotes}</span></div>
        <div className="body">
          <div className="au"><span className="nm">{p.author}</span>{p.starIn.map(sp => <Badge key={sp} sport={sp} t={t} />)}</div>
          <div className="msg">{p.body}</div>
        </div>
      </div>))
  return (
    <section className="view on">
      <button className="back" onClick={onBack}>←&nbsp;{t('detail.back', 'All matches')}</button>
      <div className="detail-head">
        <div className="dh-top">
          <div className="meta"><span className="lg-ic">{ic(m.sport)}</span>{leagueName(m)}</div><Status m={m} />
        </div>
        <div className="matchup big">
          <div className="side"><div className="bdg" style={{ background: m.a.color }}>{m.a.abbr}</div>
            <div><div className="nm">{m.a.name}</div><div className="sub">{m.a.abbr}</div></div></div>
          <div className="vs">VS</div>
          <div className="side r"><div className="bdg" style={{ background: m.b.color }}>{m.b.abbr}</div>
            <div><div className="nm">{m.b.name}</div><div className="sub">{m.b.abbr}</div></div></div>
        </div>
        <Consensus m={m} big t={t} />
        <VoteBlock m={m} viewable={viewable} open={open} onVote={onVote} onStar={onStar} t={t} />
        {open && <StarPanel m={m} freeReason={t('sp.free', 'Pass applied')} t={t} />}
        {pickedName && <div className="your-pick-tag">✓ {t('yourpick', 'Your pick')}: {pickedName}</div>}
      </div>
      <div className="discuss">
        <h3>{t('detail.disc', 'Discussion')} <span className="cnt">{posts.length}</span></h3>
        <p className="lead">{t('detail.lead', 'Break down the matchup. Picks carry your track record.')}</p>
        {m.myPick === null
          ? <div className="gate">{t('detail.gate', 'Make your pick above to join the discussion.')}</div>
          : <div className="compose">
              <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder={t('detail.ph', 'Share why you picked this — the crowd is watching.')} />
              <div className="cbar">
                <span className="who">{t('yourpick', 'Your pick')}: <b style={{ color: 'var(--brand)' }}>{pickedName}</b></span>
                <button className="post-btn" onClick={() => { const v = draft.trim(); if (v) { onPost(m, v); setDraft('') } }}>{t('detail.post', 'Post reasoning')}</button>
              </div>
            </div>}
        {m.myPick === null ? <div className="blurred">{threadList}</div> : <>{threadList}</>}
        <div className="star-teaser">
          <div className="gi">★</div>
          <div className="tt"><b>{viewable ? t('detail.staropen', 'Star consensus is open for this match') : t('detail.starlock', 'Star consensus is locked for this match')}</b>
            <p>{m.star.n} {t('analysts', 'analysts')} · {t('starcon', 'Star consensus')}</p></div>
          <button onClick={onStar}>{viewable ? t('detail.view', 'View above') : t('detail.unlock', 'Unlock')}</button>
        </div>
      </div>
    </section>
  )
}

const TRENDS = [[3, 4, 4, 5, 4, 6, 5, 6, 7, 6], [2, 3, 3, 4, 5, 4, 5, 5, 6, 6], [4, 4, 5, 4, 5, 5, 5, 6, 5, 6], [3, 4, 3, 5, 4, 5, 6, 5, 6, 7], [3, 3, 4, 4, 4, 5, 4, 5, 5, 5]]

export function LeaderboardView({ lbSport, setLbSport, myStars, onOpenAnalyst, t }:
  { lbSport: Sport; setLbSport: (s: Sport) => void; myStars: Set<Sport>; onOpenAnalyst: (s: Sport, a: Analyst) => void; t: T }) {
  const pool = ANALYSTS[lbSport]
  const me = YOU.bySport[lbSport]
  const myStar = myStars.has(lbSport)
  return (
    <section className="view on">
      <div className="sec-head"><div>
        <div className="eyebrow">{t('lb.eyebrow', 'Ranked by skill, measured with error bars')}</div>
        <h1 className="h-title">{t('lb.title', 'Leaderboard')}</h1>
        <p className="h-sub">{t('lb.sub', 'Skill Score rewards beating the crowd, not just being right. Star tier is the top 1% of each sport — tap any analyst to see their full record.')}</p>
      </div></div>
      <div className="lb-sports"><SportButtons cur={lbSport} onPick={setLbSport} t={t} /></div>
      <div className="lb-wrap">
        <div className="lb-row head">
          <span>{t('lb.rank', 'Rank')}</span><span>{t('lb.analyst', 'Analyst')}</span><span>{t('lb.skill', 'Skill')}</span>
          <span className="h-hide">{t('lb.interval', '95% skill interval')}</span><span>{t('lb.record', 'Record')}</span><span className="h-hide">{t('lb.trend', 'Trend')}</span>
        </div>
        {pool.map((p, i) => {
          const star = p.starIn.includes(lbSport)
          return (
            <div className={`lb-row ${star ? 'star-row' : ''}`} key={p.handle} onClick={() => onOpenAnalyst(lbSport, p)}>
              <span className="lb-rank">{star ? <span className="m">{i + 1}</span> : i + 1}</span>
              <span className="lb-who"><span className={`av ${star ? 'g' : ''}`}>{p.initials}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="nm">{p.name} {p.starIn.map(sp => <Badge key={sp} sport={sp} t={t} />)}</span>
                  <span className="h">{p.handle}</span>
                </span></span>
              <span className={`lb-skill ${star ? 'g' : ''}`}>{p.skill.toFixed(1)}</span>
              <Wilson lo={p.lo} hi={p.hi} v={p.skill} gold={star} min={40} max={90} />
              <span className="lb-rec"><b>{p.w}</b>–{p.l} <span style={{ color: 'var(--dimmer)' }}>· n={p.n}</span></span>
              <span className="lb-trend">{TRENDS[i % 5].map((v, j) => <span key={j} className={j >= 6 ? 'up' : ''} style={{ height: v * 3 + 4 }} />)}</span>
            </div>)
        })}
      </div>
      <div className="lb-you">
        <span className="lb-rank">#{me.rank}</span>
        <span className="lb-who"><span className={`av ${myStar ? 'g' : ''}`}>{YOU.initials}</span>
          <span style={{ minWidth: 0 }}>
            <span className="nm">{YOU.name} <span style={{ color: 'var(--brand)', fontSize: 11 }}>· {t('lb.you.you', 'you')}</span> {myStar && <Badge sport={lbSport} t={t} />}</span>
            <span className="h">{YOU.handle} · top {me.pct}</span>
          </span></span>
        <span className="lb-skill" style={{ color: 'var(--brand)' }}>{me.skill.toFixed(1)}</span>
        <Wilson lo={me.lo} hi={me.hi} v={me.skill} min={40} max={90} />
        <span className="lb-rec"><b>{me.w}</b>–{me.l} <span style={{ color: 'var(--dimmer)' }}>· n={me.n}</span></span>
        <span className="tip">{myStar ? '★' : `+${((pool[0].skill - me.skill) * 0.28).toFixed(1)}`} {t('lb.you.tip', 'to Star tier (top 1.0%)')}</span>
      </div>
    </section>
  )
}

export function PayModal({ m, onClose, onBuy, t }: { m: Match; onClose: () => void; onBuy: (k: 'single' | 'weekly') => void; t: T }) {
  return (
    <div className="overlay open" onClick={e => { if ((e.target as HTMLElement).classList.contains('overlay')) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3><span className="gi">★</span><span>{t('pay.title', 'Unlock Star Picks')}</span></h3>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>
        <p className="modal-sub">{t('pay.sub', 'See how the top 1% of this sport called it — verified track records only.')}</p>
        <div className="modal-match"><span className="lg-ic">{ic(m.sport)}</span>{m.a.name} vs {m.b.name} · {leagueName(m)}</div>
        <div className="pay-opts">
          <button className="pay-opt" onClick={() => onBuy('single')}>
            <div className="t"><b>{t('pay.single', 'Single match pass')}</b><span>{t('pay.single.d', 'Star picks for this match only')}</span></div>
            <span className="pr">$2.90</span>
          </button>
          <button className="pay-opt" onClick={() => onBuy('weekly')}>
            <div className="t"><b>{t('weekly.' + m.sport, `${m.sport[0].toUpperCase() + m.sport.slice(1)} weekly pass`)}</b><span>{t('pay.weekly.d', 'All Star picks in this sport for 7 days')}</span></div>
            <span className="pr">$9.90</span>
          </button>
        </div>
        <p className="pay-note"><b>10%</b> <span>{t('pay.note', "of each sale is shared equally among the analysts who contributed picks. Star analysts view their own sport's picks free.")}</span></p>
      </div>
    </div>
  )
}

export function AnalystModal({ sport, analyst, onClose, t }: { sport: Sport; analyst: Analyst; onClose: () => void; t: T }) {
  const anyStar = analyst.starIn.length > 0
  const scale = (v: number) => ((v - 40) / (90 - 40)) * 100
  return (
    <div className="overlay open" onClick={e => { if ((e.target as HTMLElement).classList.contains('overlay')) onClose() }}>
      <div className="modal prof-modal">
        <div className="modal-head" style={{ padding: 0 }}><span /><button className="modal-x" style={{ margin: '12px 12px 0 0' }} onClick={onClose}>✕</button></div>
        <div className="pm-head">
          <span className={`pm-av ${anyStar ? '' : 'plain'}`}>{analyst.initials}</span>
          <span className="pm-id">
            <span className="nm">{analyst.name} {analyst.starIn.map(sp => <Badge key={sp} sport={sp} t={t} />)}</span>
            <span className="h">{analyst.handle}</span>
          </span>
        </div>
        <div className="pm-stats">
          <div className="pm-stat"><div className={`v ${anyStar ? 'g' : ''}`}>{analyst.skill.toFixed(1)}</div><div className="l">{t('pm.skill', 'Skill')}</div></div>
          <div className="pm-stat"><div className="v">{analyst.w}–{analyst.l}</div><div className="l">{t('pm.record', 'Record')}</div></div>
          <div className="pm-stat"><div className="v">n={analyst.n}</div><div className="l">{t('pm.sample', 'Sample')}</div></div>
        </div>
        <div className="pm-sports">
          <h5>{t('pm.bysport', 'Skill by sport')}</h5>
          {SPORTS.map(s => {
            const found = ANALYSTS[s.id].find(x => x.handle === analyst.handle)
            if (!found) return null
            const g = found.starIn.includes(s.id)
            return (
              <div className="pm-row" key={s.id}>
                <span className="s">{s.ic} {t('sport.' + s.id, s.id)} {g && <Badge sport={s.id} t={t} />}</span>
                <span className="mini-wil"><span className="t" />
                  <span className={`c ${g ? 'g' : ''}`} style={{ left: `${scale(found.lo)}%`, width: `${scale(found.hi) - scale(found.lo)}%` }} />
                  <span className={`p ${g ? 'g' : ''}`} style={{ left: `${scale(found.skill)}%` }} /></span>
                <span className="v">{found.skill.toFixed(1)}</span>
              </div>)
          })}
        </div>
      </div>
    </div>
  )
}

export function ProfileView({ myStars, onToggleStar, t }: { myStars: Set<Sport>; onToggleStar: (s: Sport) => void; t: T }) {
  const scale = (v: number) => ((v - 35) / (90 - 35)) * 100
  const [skill, setSkill] = useState<SkillSummary | null>(null)

  useEffect(() => {
    if (!hasBackend) { setSkill({ bySport: [], overall: null, totalN: 0 }); return }
    getSkill().then(setSkill).catch(() => setSkill({ bySport: [], overall: null, totalN: 0 }))
  }, [])

  const overall = skill?.overall ?? null
  const map = new Map((skill?.bySport ?? []).map(r => [r.sport, r]))

  return (
    <section className="view on">
      <div className="sec-head"><div>
        <div className="eyebrow">{t('pf.eyebrow', 'Your record')}</div>
        <h1 className="h-title">{t('pf.title', 'Track record')}</h1>
        <p className="h-sub">{t('pf.sub', "One number that can't be gamed: your skill against the crowd, bounded by how much you've actually predicted.")}</p>
      </div></div>

      <div className="prof-grid">
        <div className="prof-hero">
          <div className="lb">{t('pf.skillscore', 'Skill Score')}</div>

          {overall ? (
            <>
              <div className="big mono">{overall.score.toFixed(1)}</div>
              <div className="u">
                {overall.n} {t('pf.resolved', 'resolved picks')} · {overall.wins}–{overall.losses}
              </div>
              <div className="to-star">
                <div className="r">
                  <span>{t('pf.interval', '95% interval')}</span>
                  <b className="mono">{overall.lo.toFixed(1)} – {overall.hi.toFixed(1)}</b>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="big mono dim">—</div>
              <div className="u">{t('pf.none', 'No resolved picks yet')}</div>
              <div className="to-star">
                <div className="r" style={{ color: 'var(--dimmer)' }}>
                  <span>{t('pf.none.note', 'Your score appears once your picks resolve. Matches need 30+ picks before the crowd counts as a benchmark.')}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="prof-side">
          <div className="stat-card">
            <h4>{t('pf.bysport', 'Skill by sport — point estimate & 95% interval')}</h4>
            {SPORTS.map(s => {
              const d = map.get(s.id)
              return (
                <div className="pm-row" key={s.id}>
                  <span className="s">{s.ic} {t('sport.' + s.id, s.id)}</span>
                  {d ? (
                    <>
                      <span className="mini-wil"><span className="t" />
                        <span className="c" style={{ left: `${scale(d.lo)}%`, width: `${scale(d.hi) - scale(d.lo)}%` }} />
                        <span className="p" style={{ left: `${scale(d.score)}%` }} /></span>
                      <span className="v">{d.score.toFixed(1)}</span>
                    </>
                  ) : (
                    <>
                      <span className="mini-wil"><span className="t" /></span>
                      <span className="v dim">—</span>
                    </>
                  )}
                </div>)
            })}
          </div>
        </div>
      </div>

      <div className="stat-card">
        <h4>{t('pf.how', 'How your Skill Score is built')}</h4>
        <p style={{ color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.65 }}>
          {t('pf.how.body', "Each resolved pick scores how much you beat the crowd's consensus, so calling a 55/45 upset is worth far more than a 92/8 lock. Scores are shrunk toward zero until you've built a sample, then bounded by a 95% confidence interval — so a hot streak of ten picks can't leapfrog a proven record of five hundred.")}
        </p>
      </div>
    </section>
  )
}