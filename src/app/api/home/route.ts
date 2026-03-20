import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured } from '@/lib/db'
import {
  getHomeActivity,
  getHomeStats,
  listContentLanes,
  listLatestPublicArticles,
  listRandomPublicArticles,
  listUniquePublicArticles,
} from '@/lib/db/public-feed'
import { TrendsQuerySchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = TrendsQuerySchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { period } = parsed.data

  const [random, latest, unique, lanes, stats, activity] = await Promise.all([
    // ランダム・最新・ユニークは1年以内から各10件取得（期間フィルタなし）
    listRandomPublicArticles({ limit: 10 }),
    listLatestPublicArticles({ limit: 10 }),
    listUniquePublicArticles({ limit: 10 }),
    // ソースレーンのみ期間フィルタを適用
    listContentLanes({ period, perLane: 8 }),
    getHomeStats(),
    getHomeActivity(),
  ])

  return NextResponse.json({
    random,
    latest,
    unique,
    lanes,
    period,
    stats,
    activity,
  })
}
