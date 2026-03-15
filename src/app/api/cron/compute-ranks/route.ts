import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { computeScore, getPeriodStart } from '@/lib/ranking/compute'
import type { RankPeriod, RankBreakdown } from '@/lib/db/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const PERIODS: RankPeriod[] = ['24h', '7d', '30d']

interface AggregatedRow {
  article_id: string
  share: number | string
  save: number | string
  view: number | string
  expand_200: number | string
  critique_expand: number | string
  article_open: number | string
  genre: string
  published_at: string
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

  for (const period of PERIODS) {
    const since = getPeriodStart(period)

    const aggregated = await sql`
      SELECT
        article_id,
        COUNT(*) FILTER (WHERE action_type IN ('share_x','share_threads','share_slack','share_misskey','share_copy')) AS share,
        COUNT(*) FILTER (WHERE action_type = 'save')            AS save,
        COUNT(*) FILTER (WHERE action_type = 'view')            AS view,
        COUNT(*) FILTER (WHERE action_type = 'expand_200')      AS expand_200,
        COUNT(*) FILTER (WHERE action_type = 'critique_expand') AS critique_expand,
        COUNT(*) FILTER (WHERE action_type = 'article_open')    AS article_open,
        a.genre,
        a.published_at
      FROM action_logs al
      JOIN articles a ON a.id = al.article_id
      WHERE al.created_at >= ${since.toISOString()}
        AND al.article_id IS NOT NULL
      GROUP BY al.article_id, a.genre, a.published_at
    ` as AggregatedRow[]

    for (const row of aggregated) {
      const breakdown: RankBreakdown = {
        share: Number(row.share),
        save: Number(row.save),
        view: Number(row.view),
        expand_200: Number(row.expand_200),
        critique_expand: Number(row.critique_expand),
        article_open: Number(row.article_open),
      }
      const score = computeScore(breakdown, new Date(row.published_at))

      for (const genre of ['all', row.genre] as const) {
        await sql`
          INSERT INTO rank_scores (article_id, period, genre, score, breakdown)
          VALUES (
            ${row.article_id}, ${period}, ${genre},
            ${score}, ${JSON.stringify(breakdown)}
          )
          ON CONFLICT (article_id, period, genre)
          DO UPDATE SET
            score       = EXCLUDED.score,
            breakdown   = EXCLUDED.breakdown,
            computed_at = now()
        `
        updated++
      }
    }
  }

  return NextResponse.json({ updated })
}
