'use client'
// Cross-route client state: language, entitlements (passes), Star badges,
// pay modal, toast. Server components render public data; everything
// session-scoped lives here.
import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import type { Match, Sport } from '@/lib/types'
import { ensureSession, purchasePass, getEntitlements, hasBackend } from '@/lib/api'
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

  const refreshEntitlements = useCallback(async () => {
    if (!hasBackend) return
    const ent = await getEntitlements()
    setSingles(new Set(ent.singles))
    setWeeklies(new Set(ent.weeklies))
  }, [])

  useEffect(() => {
    (async () => {
      await ensureSession()
      await refreshEntitlements()
    })()
  }, [refreshEntitlements])

  const canView = useCallback((m: Match) =>
    myStars.has(m.sport) || weeklies.has(m.sport) || singles.has(m.id),
  [myStars, weeklies, singles])

  const togglePanel = useCallback((id: number) => {
    setOpenPanels(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }, [])

  const starsComingSoon = process.env.NEXT_PUBLIC_STARS_COMING_SOON === 'true'
  const requestUnlock = useCallback((m: Match) => {
    if (starsComingSoon) {
      toast('\u2605', "Star picks are coming soon \u2014 keep making picks to climb the leaderboard and become a Star.")
      return
    }
    setPayTarget(m)
  }, [starsComingSoon, toast])

  const buy = async (kind: 'single' | 'weekly') => {
    const m = payTarget; if (!m) return
    try {
      const onComplete = async () => {
        await refreshEntitlements()
        setOpenPanels(prev => new Set(prev).add(m.id))
        setPayTarget(null)
        toast('\u2605', kind === 'weekly'
          ? t('toast.weekly', 'Weekly pass active — all Star picks in this sport unlocked')
          : t('toast.single', 'Single match pass applied — Star picks unlocked'))
      }

      const r = await purchasePass(
        kind, kind === 'single' ? m.id : undefined, m.sport, onComplete)

      if (r === 'unlocked') {
        if (kind === 'single') setSingles(prev => new Set(prev).add(m.id))
        else setWeeklies(prev => new Set(prev).add(m.sport))
        setOpenPanels(prev => new Set(prev).add(m.id))
        setPayTarget(null)
      }
    } catch { toast('!', 'Purchase failed') }
  }

  const toggleStar = useCallback((sp: Sport) => {
    setMyStars(prev => {
      const s = new Set(prev)
      if (s.has(sp)) { s.delete(sp); toast('\u2605', t('toast.star.off', 'Star badge removed')) }
      else { s.add(sp); toast('\u2605', t('toast.star.on', "Star badge on — this sport's Star picks are free for you")) }
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