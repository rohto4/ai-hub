import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { verifyCronSecret } from '@/lib/auth/admin'
import { isDatabaseConfigured } from '@/lib/db'
import { runDailyEnrich } from '@/lib/jobs/daily-enrich'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const limitParam = request.nextUrl.searchParams.get('limit')
  const parsedLimit = limitParam ? Number(limitParam) : 50
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 50

  const result = await runDailyEnrich(limit)
  return NextResponse.json(result)
}
