import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured } from '@/lib/db'
import { searchPublicArticles } from '@/lib/db/public-feed'
import { SearchQuerySchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = SearchQuerySchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { q, genre, limit, offset } = parsed.data
  const articles = await searchPublicArticles({
    query: q,
    genre,
    limit,
    offset,
  })

  return NextResponse.json({
    articles,
    query: q,
    total: articles.length,
  })
}
