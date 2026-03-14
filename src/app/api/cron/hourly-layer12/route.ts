import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { verifyCronSecret } from '@/lib/auth/admin'
import { isDatabaseConfigured } from '@/lib/db'
import { runHourlyLayer12 } from '@/lib/jobs/hourly-layer12'

export const runtime = 'nodejs'
export const maxDuration = 300

function readBoundedNumber(
  value: string | null,
  defaultValue: number,
  minValue: number,
  maxValue: number,
): number {
  const parsed = value ? Number(value) : defaultValue
  if (!Number.isFinite(parsed)) {
    return defaultValue
  }
  return Math.max(minValue, Math.min(maxValue, parsed))
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse()
  }

  const fetchLimit = readBoundedNumber(request.nextUrl.searchParams.get('fetchLimit'), 20, 1, 100)
  const enrichBatchSize = readBoundedNumber(request.nextUrl.searchParams.get('enrichBatchSize'), 25, 1, 100)
  const maxEnrichBatches = readBoundedNumber(request.nextUrl.searchParams.get('maxEnrichBatches'), 4, 1, 12)

  const result = await runHourlyLayer12({
    fetchLimit,
    enrichBatchSize,
    maxEnrichBatches,
  })

  return NextResponse.json(result)
}
