import { NextRequest, NextResponse } from 'next/server'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { verifyCronSecret } from '@/lib/auth/admin'
import { isDatabaseConfigured } from '@/lib/db'
import { runMonthlyPublicArchive } from '@/lib/jobs/monthly-public-archive'

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

  const limit = readBoundedNumber(request.nextUrl.searchParams.get('limit'), 5000, 1, 10000)
  const ageMonths = readBoundedNumber(request.nextUrl.searchParams.get('ageMonths'), 6, 1, 24)
  const result = await runMonthlyPublicArchive({ limit, ageMonths })
  return NextResponse.json(result)
}
