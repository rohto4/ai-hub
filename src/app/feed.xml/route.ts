import { NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db'
import { listFeedArticles } from '@/lib/db/public-feed'

export const runtime = 'nodejs'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const items = isDatabaseConfigured() ? await listFeedArticles(20) : []
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI Trend Hub Feed</title>
    <link>${siteUrl}</link>
    <description>AI Trend Hub public feed</description>
    ${items
      .map(
        (item) => `<item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid>${escapeXml(item.id)}</guid>
      <pubDate>${item.published_at.toUTCString()}</pubDate>
      <description>${escapeXml(item.summary_100 ?? '')}</description>
    </item>`,
      )
      .join('\n')}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}
