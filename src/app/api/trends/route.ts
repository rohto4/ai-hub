import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { TrendsQuerySchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

type TrendRow = {
  id: string
  url: string
  title: string
  genre: string
  source_type: string
  thumbnail_url: string | null
  published_at: string
  summary_100: string | null
  topic_group_id: string | null
  score: number
  breakdown: unknown
}

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = TrendsQuerySchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { period, genre, limit, offset } = parsed.data
  const sql = getSql()

  const rows = await sql`
    SELECT
      a.id, a.url, a.title, a.genre, a.source_type,
      a.thumbnail_url, a.published_at,
      a.summary_100, a.topic_group_id,
      r.score, r.breakdown
    FROM articles a
    JOIN rank_scores r
      ON r.article_id = a.id
      AND r.period    = ${period}
      AND r.genre     = ${genre}
    ORDER BY r.score DESC
    LIMIT  ${limit}
    OFFSET ${offset}
  ` as TrendRow[]

  return NextResponse.json({
    articles: rows,
    period,
    genre,
    total: rows.length,
  })
}
