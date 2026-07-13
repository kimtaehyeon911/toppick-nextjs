// Server Component: public matches + consensus rendered on the server
// (SEO: match list is crawlable). Interactivity hydrates in HomeBoard.
import { getMatches } from '@/lib/data'
import { HomeBoard } from '@/components/home-board'

export const revalidate = 30 // consensus freshness for crawlers/first paint

export default async function Home() {
  const matches = await getMatches()
  return <HomeBoard initialMatches={matches} />
}
