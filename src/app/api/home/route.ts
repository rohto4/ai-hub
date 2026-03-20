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

const HOME_TOPICS = new Set(['all', 'llm', 'agent', 'voice', 'policy', 'safety', 'search', 'news'])

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
  const topicParam = request.nextUrl.searchParams.get('topic') ?? 'all'
  const topic = HOME_TOPICS.has(topicParam) ? topicParam : 'all'
  const sourceCategory = topic === 'all' ? null : topic

  const [random, latest, unique, lanes, stats, activity] = await Promise.all([
    listRandomPublicArticles({ limit: 10, sourceCategory }),
    listLatestPublicArticles({ limit: 10, sourceCategory }),
    listUniquePublicArticles({ limit: 10, sourceCategory }),
    listContentLanes({ period, perLane: 8, sourceCategory }),
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
