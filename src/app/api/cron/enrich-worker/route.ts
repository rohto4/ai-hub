import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { verifyCronSecret } from '@/lib/auth/admin'
import { isDatabaseConfigured } from '@/lib/db'
import { runDailyEnrich } from '@/lib/jobs/enrich-worker'

export const runtime = 'nodejs'
export const maxDuration = 600

const DEFAULT_SUMMARY_BATCH_SIZE = 20
const MAX_SUMMARY_BATCH_SIZE = 20

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const limitParam = request.nextUrl.searchParams.get('limit')
  const sourceKey = request.nextUrl.searchParams.get('sourceKey')
  const summaryBatchSizeParam = request.nextUrl.searchParams.get('summaryBatchSize')
  const maxSummaryBatchesParam = request.nextUrl.searchParams.get('maxSummaryBatches')
  const parsedLimit = limitParam ? Number(limitParam) : 50
  const parsedSummaryBatchSize = summaryBatchSizeParam ? Number(summaryBatchSizeParam) : DEFAULT_SUMMARY_BATCH_SIZE
  const parsedMaxSummaryBatches = maxSummaryBatchesParam ? Number(maxSummaryBatchesParam) : Number.POSITIVE_INFINITY
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 50
  const summaryBatchSize = Number.isFinite(parsedSummaryBatchSize)
    ? Math.max(1, Math.min(MAX_SUMMARY_BATCH_SIZE, parsedSummaryBatchSize))
    : DEFAULT_SUMMARY_BATCH_SIZE
  const maxSummaryBatches = Number.isFinite(parsedMaxSummaryBatches)
    ? Math.max(1, Math.min(100, parsedMaxSummaryBatches))
    : undefined

  const result = await runDailyEnrich({ limit, sourceKey, summaryBatchSize, maxSummaryBatches })
  return NextResponse.json(result)
}
