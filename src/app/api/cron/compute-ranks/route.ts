import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { computeScore, getWindowStart } from '@/lib/ranking/compute'
import type { RankingWindow } from '@/lib/db/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const WINDOWS: RankingWindow[] = ['hourly', '24h', '7d', '30d']
const PUBLIC_RANKINGS_MAX_AGE = '6 months'

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
        AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_RANKINGS_MAX_AGE}::interval
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

    if (scored.length === 0) {
      continue
    }

    const publicArticleIds = scored.map((row) => row.publicArticleId)
    const rankingWindows = scored.map(() => window)
    const scores = scored.map((row) => row.score)
    const rankPositions = scored.map((_, index) => index + 1)

    await sql`
      INSERT INTO public_rankings (
        public_article_id,
        ranking_window,
        score,
        rank_position,
        computed_at
      )
      SELECT
        public_article_id::uuid,
        ranking_window,
        score::numeric,
        rank_position::integer,
        now()
      FROM unnest(
        ${publicArticleIds}::text[],
        ${rankingWindows}::text[],
        ${scores}::numeric[],
        ${rankPositions}::integer[]
      ) AS t(public_article_id, ranking_window, score, rank_position)
      ON CONFLICT (public_article_id, ranking_window) DO UPDATE SET
        score = EXCLUDED.score,
        rank_position = EXCLUDED.rank_position,
        computed_at = now()
    `
    updated += scored.length
  }

  return NextResponse.json({ updated })
}
