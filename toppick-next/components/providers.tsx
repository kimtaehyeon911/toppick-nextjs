'use client'
// Cross-route client state: language, entitlements (passes), Star badges,
// pay modal, toast. Server components render public data; everything
// session-scoped lives here.
import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import type { Match, Sport } from '@/lib/types'
import { ensureSession, purchasePass } from '@/lib/api'
import { makeT, type Lang } from '@/lib/i18n'
import { useToast } from './ui'
import { PayModal } from './views'

type Ctx = {
  lang: Lang; setLang: (l: Lang) => void
  t: (k: string, f: string) => string
  singles: Set<number>; weeklies: Set<Sport>; myStars: Set<Sport>
  canView: (m: Match) => boolean
  openPanels: Set<number>; togglePanel: (id: number) => void
  requestUnlock: (m: Match) => void
  toggleStar: (s: Sport) => void
  toast: (k: string, msg: string) => void
}

const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp outside provider')
  return c
}

export function Providers({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')
  const [singles, setSingles] = useState<Set<number>>(new Set())
  const [weeklies, setWeeklies] = useState<Set<Sport>>(new Set())
  const [myStars, setMyStars] = useState<Set<Sport>>(new Set())
  const [openPanels, setOpenPanels] = useState<Set<number>>(new Set())
  const [payTarget, setPayTarget] = useState<Match | null>(null)
  const { toast, node: toastNode } = useToast()
  const t = useMemo(() => makeT(lang), [lang])

  useEffect(() => { ensureSession() }, [])

  // Stripe return (?pass=success|cancelled)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('pass')
    if (!q) return
    window.history.replaceState({}, '', window.location.pathname)
    toast(q === 'success' ? '★' : '!', q === 'success' ? 'Payment complete · Star Picks unlocked' : 'Checkout cancelled')
  }, [toast])

  const canView = useCallback((m: Match) =>
    myStars.has(m.sport) || weeklies.has(m.sport) || singles.has(m.id),
  [myStars, weeklies, singles])

  const togglePanel = useCallback((id: number) => {
    setOpenPanels(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }, [])

  const requestUnlock = useCallback((m: Match) => setPayTarget(m), [])

  const buy = async (kind: 'single' | 'weekly') => {
    const m = payTarget; if (!m) return
    try {
      const r = await purchasePass(kind, kind === 'single' ? m.id : undefined, m.sport)
      if (r === 'redirected') return
      if (kind === 'single') setSingles(prev => new Set(prev).add(m.id))
      else setWeeklies(prev => new Set(prev).add(m.sport))
      setOpenPanels(prev => new Set(prev).add(m.id))
      setPayTarget(null)
      toast('★', kind === 'weekly'
        ? t('toast.weekly', 'Weekly pass active — all Star picks in this sport unlocked')
        : t('toast.single', 'Single match pass applied — Star picks unlocked'))
    } catch { toast('!', 'Purchase failed') }
  }

  const toggleStar = useCallback((sp: Sport) => {
    setMyStars(prev => {
      const s = new Set(prev)
      if (s.has(sp)) { s.delete(sp); toast('★', t('toast.star.off', 'Star badge removed')) }
      else { s.add(sp); toast('★', t('toast.star.on', "Star badge on — this sport's Star picks are free for you")) }
      return s
    })
  }, [t, toast])

  return (
    <AppCtx.Provider value={{ lang, setLang, t, singles, weeklies, myStars, canView, openPanels, togglePanel, requestUnlock, toggleStar, toast }}>
      {children}
      {payTarget && <PayModal m={payTarget} onClose={() => setPayTarget(null)} onBuy={buy} t={t} />}
      {toastNode}
    </AppCtx.Provider>
  )
}
