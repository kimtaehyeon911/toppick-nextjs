import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Leaderboard — Top Sports Analysts',
  description: 'See the top 1% of sports predictors ranked by verified skill. Real track records, measured against crowd consensus across NFL, NBA, MLB, soccer, and UFC.',
  alternates: { canonical: 'https://jointoppick.com/leaderboard' },
}

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children
}