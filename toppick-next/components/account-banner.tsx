'use client'
import { useEffect, useState } from 'react'
import { getAuthState, linkGoogle, signOut, hasBackend, type AuthState } from '@/lib/api'
import { useApp } from './providers'

export function AccountBanner() {
  const { t, toast } = useApp()
  const [state, setState] = useState<AuthState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hasBackend) return
    getAuthState().then(setState).catch(() => {})
  }, [])

  if (!hasBackend || !state) return null

  // already permanent
  if (!state.isAnonymous) {
    return (
      <div className="acct-row">
        <span className="acct-ok">
          {t('acct.linked', 'Account secured')}
          {state.email ? ` · ${state.email}` : ''}
        </span>
        <button className="acct-out" onClick={() => signOut()}>
          {t('acct.signout', 'Sign out')}
        </button>
      </div>
    )
  }

  const onLink = async () => {
    setBusy(true)
    try { await linkGoogle() }
    catch (e: any) { toast('!', e?.message ?? 'Sign-in failed'); setBusy(false) }
  }

  return (
    <div className="acct-banner">
      <div className="acct-txt">
        <strong>{t('acct.title', 'Your track record is not saved yet')}</strong>
        <span>
          {t('acct.body',
            'You are browsing anonymously. Clearing this browser\u2019s data will erase your picks and skill score permanently.')}
          {state.pickCount > 0
            ? ` (${state.pickCount} ${t('acct.picks', 'picks at risk')})`
            : ''}
        </span>
      </div>
      <button className="acct-btn" onClick={onLink} disabled={busy}>
        {busy ? '…' : t('acct.link', 'Save with Google')}
      </button>
    </div>
  )
}