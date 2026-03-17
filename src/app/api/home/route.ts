import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured } from '@/lib/db'
import { getHomeActivity, getHomeStats, listRankedPublicArticles } from '@/lib/db/public-feed'
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

  const { period, limit } = parsed.data
  const [articles, stats, activity] = await Promise.all([
    listRankedPublicArticles({ period, genre: 'all', limit }),
    getHomeStats(),
    getHomeActivity(),
  ])

  return NextResponse.json({
    articles,
    period,
    stats,
    activity,
    total: articles.length,
  })
}
