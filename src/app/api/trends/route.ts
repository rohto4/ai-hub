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
  const parsed = TrendsQuerySchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { period, genre, limit, offset } = parsed.data
  const articles = await listRankedPublicArticles({ period, genre, limit, offset })

  return NextResponse.json({
    articles,
    period,
    genre,
    total: articles.length,
  })
}
