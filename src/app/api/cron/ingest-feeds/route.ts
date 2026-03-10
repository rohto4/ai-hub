import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { fetchFeed } from '@/lib/rss/ingest'
import { extractContent } from '@/lib/rss/extract'
import { generateSummary } from '@/lib/ai/summarize'

export const runtime = 'nodejs'
export const maxDuration = 300

interface FeedJobRow {
  id: string
  url: string
  genre: string
  source_type: string
}

interface ExistingHashRow {
  url_hash: string
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const sql = getSql()
  const feeds = await sql`
    SELECT id, url, genre, source_type
    FROM feeds
    WHERE active = true
    ORDER BY last_fetched_at ASC NULLS FIRST
    LIMIT 20
  ` as FeedJobRow[]

  const results = await Promise.allSettled(
    feeds.map(feed => processFeed(feed))
  )

  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({ succeeded, failed })
}

async function processFeed(feed: FeedJobRow) {
  const sql = getSql()

  let items
  try {
    items = await fetchFeed(feed.url)
  } catch (err) {
    await sql`
      UPDATE feeds
      SET error_count = error_count + 1
      WHERE id = ${feed.id}
    `
    throw err
  }

  const hashes = items.map(i => i.url_hash)
  const existingRows = await sql`
    SELECT url_hash FROM source_items
    WHERE url_hash = ANY(${hashes})
  ` as ExistingHashRow[]
  const existing = new Set(existingRows.map(row => row.url_hash))

  const newItems = items.filter(i => !existing.has(i.url_hash))

  for (const item of newItems) {
    let rawContent: string | null = null
    try {
      rawContent = await extractContent(item.url)
    } catch {
      // Continue with title-only fallback if extraction fails.
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await sql`
      INSERT INTO source_items
        (feed_id, url, url_hash, title, published_at, raw_content, content_expires_at)
      VALUES
        (${feed.id}, ${item.url}, ${item.url_hash},
         ${item.title}, ${item.published_at?.toISOString() ?? null},
         ${rawContent}, ${expiresAt.toISOString()})
      ON CONFLICT DO NOTHING
    `

    if (item.title) {
      const { summary_100, critique, ai_model } = await generateSummary(
        item.title,
        rawContent ?? item.title
      )

      await sql`
        INSERT INTO articles
          (url, title, genre, source_type, published_at,
           summary_100, critique, ai_model)
        VALUES
          (${item.url}, ${item.title}, ${feed.genre}, ${feed.source_type},
           ${item.published_at?.toISOString() ?? new Date().toISOString()},
           ${summary_100}, ${critique}, ${ai_model})
        ON CONFLICT (url) DO NOTHING
      `
    }

    await sql`
      UPDATE source_items
      SET processed = true
      WHERE url_hash = ${item.url_hash}
    `
  }

  await sql`
    UPDATE feeds SET last_fetched_at = now(), error_count = 0
    WHERE id = ${feed.id}
  `
}
