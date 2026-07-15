// Shared shell for legal pages (terms, privacy, refund, creator agreement).
// DRAFT content only — every page carries a banner making clear these are
// placeholders pending attorney review before any Live launch.

import Link from 'next/link'
import type { ReactNode } from 'react'

export function LegalPage({
  title, updated, children,
}: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="wrap legal">
      <Link href="/" className="legal-back">← Back to Top Pick</Link>

      <h1 className="legal-h1">{title}</h1>
      <p className="legal-updated">Last updated: {updated}</p>

      <div className="legal-body">{children}</div>

      <div className="legal-foot">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/refund">Refund</Link>
        <Link href="/creator-agreement">Creator Agreement</Link>
      </div>
    </div>
  )
}
