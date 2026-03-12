import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { SearchQuerySchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

type SearchRow = {
  id: string
  url: string
  title: string
  genre: string
  source_type: string
  thumbnail_url: string | null
  published_at: string
  summary_100: string | null
  topic_group_id: string | null
}

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = SearchQuerySchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { q, genre, limit, offset } = parsed.data
  const sql = getSql()
  const keyword = `%${q}%`

  const rows = genre
    ? await sql`
        SELECT
          id, url, title, genre, source_type,
          thumbnail_url, published_at, summary_100, topic_group_id
        FROM articles
        WHERE
          (title || ' ' || coalesce(summary_100, '')) ILIKE ${keyword}
          AND genre = ${genre}
        ORDER BY published_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      ` as SearchRow[]
    : await sql`
        SELECT
          id, url, title, genre, source_type,
          thumbnail_url, published_at, summary_100, topic_group_id
        FROM articles
        WHERE
          (title || ' ' || coalesce(summary_100, '')) ILIKE ${keyword}
        ORDER BY published_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      ` as SearchRow[]

  return NextResponse.json({
    articles: rows,
    query: q,
    total: rows.length,
  })
}
