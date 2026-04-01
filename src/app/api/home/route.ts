import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured } from '@/lib/db'
import {
  getHomeActivity,
  getHomeStats,
  listContentLanes,
  listLatestPublicArticles,
  listRandomPublicArticles,
  listRankedPublicArticles,
  listUniquePublicArticles,
  listWeeklyTopPrimaryTags,
} from '@/lib/db/public-feed'
import { TrendsQuerySchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

const HOME_TOPICS = new Set(['all', 'llm', 'agent', 'voice', 'policy', 'safety', 'search', 'news'])

function parseSelectedTags(input: string | null): string[] {
  if (!input) return []

  return input
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10)
}

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
  const selectedTagKeys = parseSelectedTags(request.nextUrl.searchParams.get('selectedTags'))

  const [random, latest, unique, ranked, lanes, stats, activity, focusTags] = await Promise.all([
    listRandomPublicArticles({ limit: 10, sourceCategory, tagKeys: selectedTagKeys }),
    listLatestPublicArticles({ limit: 10, sourceCategory, tagKeys: selectedTagKeys }),
    listUniquePublicArticles({ limit: 10, sourceCategory, tagKeys: selectedTagKeys }),
    listRankedPublicArticles({ period, sourceCategory, tagKeys: selectedTagKeys, limit: 10 }),
    listContentLanes({ period, perLane: 8, sourceCategory, tagKeys: selectedTagKeys }),
    getHomeStats(),
    getHomeActivity(),
    listWeeklyTopPrimaryTags(10),
  ])

  return NextResponse.json({
    random,
    latest,
    unique,
    ranked,
    lanes,
    focusTags,
    period,
    stats,
    activity,
  })
}
