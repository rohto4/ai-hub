import type { MetadataRoute } from 'next'
import { getSql, isDatabaseConfigured } from '@/lib/db'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: APP_URL, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${APP_URL}/ranking`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${APP_URL}/search`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${APP_URL}/tags`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${APP_URL}/digest`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${APP_URL}/about`, changeFrequency: 'monthly', priority: 0.4 },
  ]

  if (!isDatabaseConfigured()) return staticPages

  try {
    const sql = getSql()
    const rows = (await sql`
      SELECT public_key, COALESCE(original_published_at, created_at) AS updated_at
      FROM public_articles
      WHERE visibility_status = 'published'
      ORDER BY COALESCE(original_published_at, created_at) DESC
      LIMIT 5000
    `) as Array<{ public_key: string; updated_at: string }>

    const articlePages: MetadataRoute.Sitemap = rows.map((row) => ({
      url: `${APP_URL}/articles/${row.public_key}`,
      lastModified: new Date(row.updated_at),
      changeFrequency: 'monthly',
      priority: 0.6,
    }))

    return [...staticPages, ...articlePages]
  } catch {
    return staticPages
  }
}
