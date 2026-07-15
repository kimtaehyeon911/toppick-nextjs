import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import { Header } from '@/components/header'
import './globals.css'

// Fonts load via <link> for build portability. Optional upgrade: next/font/google
// (self-hosted, zero layout shift) — swap when building in a network-open env.

export const metadata: Metadata = {
  title: { default: 'Top Pick — Skill Market for Sports Predictions', template: '%s · Top Pick' },
  description: 'Cast free picks, beat the crowd consensus, build a verified track record. A skill market — not a betting platform.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
        <script src="https://cdn.paddle.com/paddle/v2/paddle.js" async></script>
      </head>
      <body>
        <Providers>
          <Header />
          {children}
          <footer className="foot">
            <div><span className="wm" style={{ fontFamily: 'var(--disp)', fontWeight: 900, fontSize: 15 }}>TOP<b style={{ color: 'var(--brand)' }}>PICK</b></span></div>
            <div>A skill market — not a betting platform. No stakes, no odds, no payouts for outcomes. Predictions are free.</div>
            <nav className="foot-legal">
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
              <a href="/refund">Refund</a>
              <a href="/creator-agreement">Creator Agreement</a>
            </nav>
          </footer>
        </Providers>
      </body>
    </html>
  )
}
