import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured } from '@/lib/db'
import { getPublicArticleDetail } from '@/lib/db/public-feed'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const { id } = await params
  const article = await getPublicArticleDetail(id)

  if (!article) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  return NextResponse.json(article)
}
