// Server Component: public matches + consensus rendered on the server
// (SEO: match list is crawlable). Interactivity hydrates in HomeBoard.
import type { Metadata } from 'next'
import { getMatches } from '@/lib/data'
import { HomeBoard } from '@/components/home-board'

export const metadata: Metadata = {
  title: 'Live Sports Predictions & Crowd Consensus',
  description: 'Cast free picks on NFL, NBA, MLB, soccer, and UFC. Watch the crowd consensus move in real time and build a verified track record. No wagers, ever.',
  alternates: { canonical: 'https://jointoppick.com' },
}

export const revalidate = 30 // consensus freshness for crawlers/first paint

export default async function Home() {
  const matches = await getMatches()
  return <HomeBoard initialMatches={matches} />
}
