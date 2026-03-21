import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { getSql, isDatabaseConfigured } from '@/lib/db'
import { finishJobRun, startJobRun } from '@/lib/db/job-runs'
import { computeScore, getWindowStart } from '@/lib/ranking/compute'
import type { RankingWindow } from '@/lib/db/types'

export const runtime = 'nodejs'
export const maxDuration = 300

const WINDOWS: RankingWindow[] = ['hourly', '24h', '7d', '30d']
const PUBLIC_RANKINGS_MAX_AGE = '6 months'

type ArticleRow = {
  public_article_id: string
  content_score: number | string
  original_published_at: string | null
  created_at: string
}

type ActivityRow = {
  public_article_id: string
  hour_bucket: string
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
  const jobRunId = await startJobRun({ jobName: 'compute-ranks', metadata: {} })
  const lastError: string | null = null

  // 1回のクエリで全公開記事を取得
  const articles = (await sql`
    SELECT public_article_id, content_score, original_published_at, created_at
    FROM public_articles
    WHERE visibility_status = 'published'
      AND COALESCE(original_published_at, created_at) >= now() - ${PUBLIC_RANKINGS_MAX_AGE}::interval
  `) as ArticleRow[]

  if (articles.length === 0) {
    await finishJobRun({ jobRunId, status: 'completed', processedCount: 0, successCount: 0, failedCount: 0, metadata: { updated: 0 }, lastError: null })
    return NextResponse.json({ updated: 0 })
  }

  // 最長 window 分のアクティビティを1回取得
  const longestSince = getWindowStart('30d')
  const activityRows = (await sql`
    SELECT public_article_id, hour_bucket,
           impression_count, open_count, share_count, save_count, source_open_count
    FROM activity_metrics_hourly
    WHERE hour_bucket >= ${longestSince.toISOString()}
  `) as ActivityRow[]

  // article_id → activity rows のマップ
  const activityByArticle = new Map<string, ActivityRow[]>()
  for (const row of activityRows) {
    const existing = activityByArticle.get(row.public_article_id) ?? []
    existing.push(row)
    activityByArticle.set(row.public_article_id, existing)
  }

  let totalUpdated = 0

  // 4 window を並列処理
  const windowResults = await Promise.all(
    WINDOWS.map(async (window) => {
      const since = getWindowStart(window)

      const scored = articles
        .map((article) => {
          const windowActivity = (activityByArticle.get(article.public_article_id) ?? []).filter(
            (a) => new Date(a.hour_bucket) >= since,
          )
          const impression = windowActivity.reduce((s, a) => s + Number(a.impression_count), 0)
          const open = windowActivity.reduce((s, a) => s + Number(a.open_count), 0)
          const share = windowActivity.reduce((s, a) => s + Number(a.share_count), 0)
          const save = windowActivity.reduce((s, a) => s + Number(a.save_count), 0)
          const sourceOpen = windowActivity.reduce((s, a) => s + Number(a.source_open_count), 0)

          const publishedAt = new Date(article.original_published_at ?? article.created_at)
          const { score } = computeScore({
            contentScore: Number(article.content_score),
            impressionCount: impression,
            openCount: open,
            shareCount: share,
            saveCount: save,
            sourceOpenCount: sourceOpen,
            publishedAt,
          })
          return { publicArticleId: article.public_article_id, score }
        })
        .sort((a, b) => b.score - a.score)

      if (scored.length === 0) return 0

      const publicArticleIds = scored.map((r) => r.publicArticleId)
      const rankingWindows = scored.map(() => window)
      const scores = scored.map((r) => r.score)
      const rankPositions = scored.map((_, i) => i + 1)

      await sql`
        INSERT INTO public_rankings (
          public_article_id, ranking_window, score, rank_position, computed_at
        )
        SELECT
          public_article_id::uuid, ranking_window, score::numeric, rank_position::integer, now()
        FROM unnest(
          ${publicArticleIds}::text[],
          ${rankingWindows}::text[],
          ${scores}::numeric[],
          ${rankPositions}::integer[]
        ) AS t(public_article_id, ranking_window, score, rank_position)
        ON CONFLICT (public_article_id, ranking_window) DO UPDATE SET
          score        = EXCLUDED.score,
          rank_position = EXCLUDED.rank_position,
          computed_at  = now()
      `
      return scored.length
    }),
  )

  totalUpdated = windowResults.reduce((s, n) => s + n, 0)

  // 公開から外れた記事の stale rankings を削除
  await sql`
    DELETE FROM public_rankings
    WHERE public_article_id NOT IN (
      SELECT public_article_id FROM public_articles WHERE visibility_status = 'published'
    )
  `

  await finishJobRun({
    jobRunId,
    status: 'completed',
    processedCount: articles.length,
    successCount: totalUpdated,
    failedCount: 0,
    metadata: { updated: totalUpdated, articles: articles.length, windows: WINDOWS.length },
    lastError,
  })

  return NextResponse.json({ updated: totalUpdated })
}
