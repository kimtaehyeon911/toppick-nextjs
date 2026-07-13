'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LANGS } from '@/lib/i18n'
import { useApp } from './providers'
import { Badge } from './views'

export function Header() {
  const { lang, setLang, t, myStars } = useApp()
  const [open, setOpen] = useState(false)
  const path = usePathname()
  const links: [string, string][] = [
    ['/', t('nav.matches', 'Matches')],
    ['/leaderboard', t('nav.leaderboard', 'Leaderboard')],
    ['/profile', t('nav.profile', 'Profile')],
  ]
  return (
    <header className="topbar" onClick={() => setOpen(false)}>
      <div className="topbar-in">
        <div className="brand">
          <span className="ey">{t('tag', 'SKILL MARKET')}</span>
          <span className="wm">TOP<b>PICK</b></span>
        </div>
        <nav className="nav">
          {links.map(([href, label]) => (
            <Link key={href} href={href}>
              <button className={path === href ? 'on' : ''}>{label}</button>
            </Link>))}
        </nav>
        <div className="top-right">
          <div className="lang">
            <button className="lang-btn" onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
              <span>{lang.toUpperCase()}</span>
            </button>
            {open && (
              <div className="lang-menu open" onClick={e => e.stopPropagation()}>
                {LANGS.map(l => (
                  <button key={l.code} className={l.code === lang ? 'sel' : ''} onClick={() => { setLang(l.code); setOpen(false) }}>
                    {l.label} <span>{l.code.toUpperCase()}</span>
                  </button>))}
              </div>)}
          </div>
          <div className="you-chip">
            <span className="you-badges">{[...myStars].map(sp => <Badge key={sp} sport={sp} t={t} />)}</span>
            <span className="lb">{t('you.skill', 'Skill')}</span>
            <span className="sc mono">62.4</span>
            <span className="av">JS</span>
          </div>
        </div>
      </div>
    </header>
  )
}
