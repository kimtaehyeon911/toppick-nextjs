'use client'
import { useState, useRef, useCallback } from 'react'
import type { Match, Side, Sport } from '@/lib/types'

export const sportIcon = (s: Sport | string) => s === 'soccer' ? '⚽' : s === 'baseball' ? '⚾' : s === 'basketball' ? '🏀' : '🥊'
export const pct = (a: number, b: number) => { const t = a + b; return t ? Math.round(a / t * 100) : 50 }

export function StatusPill({ m }: { m: Match }) {
  if (m.status === 'live') return <span className="status live"><span className="d" />LIVE {m.clock}</span>
  if (m.status === 'final') return <span className="status done">FINAL</span>
  return <span className="status soon">{m.clock}</span>
}

export function Consensus({ m, big, label, picksWord }: { m: Match; big?: boolean; label: string; picksWord: string }) {
  const pa = pct(m.votesA, m.votesB), pb = 100 - pa, aLead = pa >= pb
  return (
    <div className={`consensus${big ? ' big' : ''}`}>
      <div className="con-top">
        <span className={`con-pct ${aLead ? 'lead' : 'trail'}`}>{pa}%</span>
        <span className="con-lb">{label}</span>
        <span className={`con-pct ${!aLead ? 'lead' : 'trail'}`}>{pb}%</span>
      </div>
      <div className="bar"><div className="fill" style={{ width: `${pa}%` }} /></div>
      <div className="con-bot">
        <span className="n">{m.votesA.toLocaleString()}</span>
        <span className="n">{(m.votesA + m.votesB).toLocaleString()} {picksWord}</span>
        <span className="n">{m.votesB.toLocaleString()}</span>
      </div>
    </div>
  )
}

export function VoteRow({ m, onVote }: { m: Match; onVote: (id: number, s: Side) => void }) {
  return (
    <div className="vote-row">
      <button className={`vbtn ${m.myPick === 'a' ? 'picked' : ''} ${m.myPick === 'b' ? 'dim' : ''}`}
        onClick={e => { e.stopPropagation(); onVote(m.id, 'a') }}>{m.a.name}</button>
      <button className={`vbtn ${m.myPick === 'b' ? 'picked' : ''} ${m.myPick === 'a' ? 'dim' : ''}`}
        onClick={e => { e.stopPropagation(); onVote(m.id, 'b') }}>{m.b.name}</button>
    </div>
  )
}

export function Spark({ data, color = '#E7B94E' }: { data: number[]; color?: string }) {
  if (!data.length) return null
  const w = 76, h = 22, mn = Math.min(...data), mx = Math.max(...data), rng = (mx - mn) || 1
  const y = (v: number) => h - ((v - mn) / rng) * (h - 5) - 2.5
  const pts = data.map((v, i) => `${(i / (data.length - 1) * (w - 3) + 1.5).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(w - 3) + 1.5} cy={y(data[data.length - 1])} r={2.6} fill={color} />
    </svg>
  )
}

export function Wilson({ lo, hi, v, gold, min = 55, max = 90 }:
  { lo: number; hi: number; v: number; gold?: boolean; min?: number; max?: number }) {
  const sc = (x: number) => ((x - min) / (max - min)) * 100
  return (
    <span className="wilson">
      <span className="track" />
      <span className={`ci ${gold ? 'g' : ''}`} style={{ left: `${sc(lo)}%`, width: `${sc(hi) - sc(lo)}%` }} />
      <span className={`pt ${gold ? 'g' : ''}`} style={{ left: `${sc(v)}%` }} />
      <span className="lbl">{lo.toFixed(0)}–{hi.toFixed(0)}</span>
    </span>
  )
}

export function useToast() {
  const [msg, setMsg] = useState<{ k: string; m: string } | null>(null)
  const [show, setShow] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const toast = useCallback((k: string, m: string) => {
    setMsg({ k, m }); setShow(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setShow(false), 2600)
  }, [])
  const node = (
    <div className={`toast ${show ? 'show' : ''}`}>
      <span className="k">{msg?.k ?? '★'}</span><span>{msg?.m ?? ''}</span>
    </div>
  )
  return { toast, node }
}
