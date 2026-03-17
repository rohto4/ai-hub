import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { computeScore, getWindowStart } from '@/lib/ranking/compute'
import type { RankingWindow } from '@/lib/db/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const WINDOWS: RankingWindow[] = ['hourly', '24h', '7d', '30d']

type AggregatedRow = {
  public_article_id: string
  content_score: number | string
  original_published_at: string | null
  created_at: string
  impression_count: number | string
  open_count: number | string
  share_count: number | string
  save_count: number | string
  source_open_count: number | string
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const sql = getSql()
  let updated = 0

  for (const window of WINDOWS) {
    const since = getWindowStart(window)
    const rows = (await sql`
      SELECT
        pa.public_article_id,
        pa.content_score,
        pa.original_published_at,
        pa.created_at,
        COALESCE(SUM(am.impression_count), 0) AS impression_count,
        COALESCE(SUM(am.open_count), 0) AS open_count,
        COALESCE(SUM(am.share_count), 0) AS share_count,
        COALESCE(SUM(am.save_count), 0) AS save_count,
        COALESCE(SUM(am.source_open_count), 0) AS source_open_count
      FROM public_articles pa
      LEFT JOIN activity_metrics_hourly am
        ON am.public_article_id = pa.public_article_id
       AND am.hour_bucket >= ${since.toISOString()}
      WHERE pa.visibility_status = 'published'
      GROUP BY
        pa.public_article_id,
        pa.content_score,
        pa.original_published_at,
        pa.created_at
    `) as AggregatedRow[]

    const scored = rows
      .map((row) => {
        const publishedAt = new Date(row.original_published_at ?? row.created_at)
        const { score } = computeScore({
          contentScore: Number(row.content_score),
          impressionCount: Number(row.impression_count),
          openCount: Number(row.open_count),
          shareCount: Number(row.share_count),
          saveCount: Number(row.save_count),
          sourceOpenCount: Number(row.source_open_count),
          publishedAt,
        })

        return {
          publicArticleId: row.public_article_id,
          score,
        }
      })
      .sort((left, right) => right.score - left.score)

    await sql`
      DELETE FROM public_rankings
      WHERE ranking_window = ${window}
    `

    for (const [index, row] of scored.entries()) {
      await sql`
        INSERT INTO public_rankings (
          public_article_id,
          ranking_window,
          score,
          rank_position,
          computed_at
        )
        VALUES (
          ${row.publicArticleId},
          ${window},
          ${row.score},
          ${index + 1},
          now()
        )
        ON CONFLICT (public_article_id, ranking_window) DO UPDATE SET
          score = EXCLUDED.score,
          rank_position = EXCLUDED.rank_position,
          computed_at = now()
      `
      updated++
    }
  }

  return NextResponse.json({ updated })
}
