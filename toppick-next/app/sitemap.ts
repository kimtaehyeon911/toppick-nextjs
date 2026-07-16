import type { MetadataRoute } from 'next'
import { getMatches } from '@/lib/data'

const BASE = 'https://jointoppick.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    '',
    '/leaderboard',
    '/profile',
    '/terms',
    '/privacy',
    '/refund',
    '/creator-agreement',
  ].map(path => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'hourly' : 'monthly',
    priority: path === '' ? 1 : 0.5,
  }))

  // Dynamic match pages — these are the SEO-valuable long-tail URLs
  // ("Team A vs Team B prediction") that pull in search traffic.
  let matchPages: MetadataRoute.Sitemap = []
  try {
    const matches = await getMatches()
    matchPages = matches.map(m => ({
      url: `${BASE}/match/${m.id}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    }))
  } catch {
    // if data fetch fails, still return static pages
  }

  return [...staticPages, ...matchPages]
}