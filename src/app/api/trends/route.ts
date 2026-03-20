import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured } from '@/lib/db'
import { listRankedPublicArticles } from '@/lib/db/public-feed'
import { TrendsQuerySchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const sourceCategory = typeof params.sourceCategory === 'string' ? params.sourceCategory : params.genre
  const parsed = TrendsQuerySchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { period, limit, offset } = parsed.data
  const articles = await listRankedPublicArticles({ period, sourceCategory, limit, offset })

  return NextResponse.json({
    articles,
    period,
    sourceCategory: sourceCategory ?? 'all',
    total: articles.length,
  })
}
