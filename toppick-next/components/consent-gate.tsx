'use client'
// Clickwrap consent gate. Blocks interaction until the user actively
// confirms age (18+) and accepts the terms. Consent is recorded server-side
// (see recordConsent). Shown once per terms version.

import { useEffect, useState } from 'react'
import { getConsent, recordConsent, hasBackend } from '@/lib/api'

export function ConsentGate() {
  const [open, setOpen] = useState(false)
  const [age, setAge] = useState(false)
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hasBackend) return
    // small delay so the anonymous session is established first
    const id = setTimeout(() => {
      getConsent().then(c => { if (!c.agreed) setOpen(true) }).catch(() => {})
    }, 800)
    return () => clearTimeout(id)
  }, [])

  if (!open) return null

  const canAccept = age && terms && !busy

  const accept = async () => {
    setBusy(true)
    try { await recordConsent(); setOpen(false) }
    catch { setBusy(false) }
  }

  return (
    <div className="consent-overlay">
      <div className="consent-modal">
        <h2>Before you start</h2>
        <p className="consent-lead">
          Top Pick is a skill market for sports predictions — not a betting
          platform. No stakes, no odds, no payouts for outcomes.
        </p>

        <label className="consent-check">
          <input type="checkbox" checked={age} onChange={e => setAge(e.target.checked)} />
          <span>I confirm I am <strong>18 years or older</strong>.</span>
        </label>

        <label className="consent-check">
          <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} />
          <span>
            I have read and agree to the{' '}
            <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>,{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>, and{' '}
            <a href="/refund" target="_blank" rel="noreferrer">Refund Policy</a>.
          </span>
        </label>

        <button className="consent-btn" onClick={accept} disabled={!canAccept}>
          {busy ? '…' : 'Agree & Continue'}
        </button>

        <p className="consent-fine">
          By continuing you enter a binding agreement. If you do not agree, please
          do not use Top Pick.
        </p>
      </div>
    </div>
  )
}