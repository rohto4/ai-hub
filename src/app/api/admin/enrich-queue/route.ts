import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSecret } from '@/lib/auth/admin'
import { databaseUnavailableResponse } from '@/lib/api/responses'
import { isDatabaseConfigured } from '@/lib/db'
import {
  getEnrichQueueDashboardData,
  type AdminEnrichActionKey,
} from '@/lib/db/enrich-queue-dashboard'
import { runDailyEnrich } from '@/lib/jobs/enrich-worker'
import { runHourlyFetch } from '@/lib/jobs/hourly-fetch'
import { runHourlyLayer12 } from '@/lib/jobs/hourly-layer12'
import { runHourlyPublish } from '@/lib/jobs/hourly-publish'
import { runHourlyComputeRanks } from '@/lib/jobs/hourly-compute-ranks'

export const runtime = 'nodejs'
export const maxDuration = 300

async function runAction(action: AdminEnrichActionKey) {
  switch (action) {
    case 'run-hourly-layer12-recovery':
      return runHourlyLayer12({
        fetchLimit: 20,
        enrichBatchSize: 20,
        maxEnrichBatches: 2,
        summaryBatchSize: 20,
      })
    case 'run-hourly-layer12-8cycles':
      return runHourlyLayer12({
        fetchLimit: 20,
        enrichBatchSize: 20,
        maxEnrichBatches: 8,
        summaryBatchSize: 20,
      })
    case 'run-enrich-worker':
      return runDailyEnrich({
        limit: 20,
        summaryBatchSize: 20,
        maxSummaryBatches: 1,
      })
    case 'run-enrich-arxiv':
      return runDailyEnrich({
        limit: 20,
        sourceKey: 'arxiv-ai',
        summaryBatchSize: 20,
        maxSummaryBatches: 1,
      })
    case 'run-hourly-fetch':
      return runHourlyFetch({ limit: 20 })
    case 'run-publish-and-ranks': {
      const publish = await runHourlyPublish()
      const ranks = await runHourlyComputeRanks()
      return { publish, ranks }
    }
    default:
      throw new Error(`Unsupported action: ${String(action)}`)
  }
}

export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse()

  const data = await getEnrichQueueDashboardData()
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  if (!verifyAdminSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse()

  const body = (await request.json().catch(() => null)) as { action?: AdminEnrichActionKey } | null
  if (!body?.action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  const result = await runAction(body.action)
  const data = await getEnrichQueueDashboardData()
  return NextResponse.json({
    ok: true,
    action: body.action,
    result,
    data,
  })
}
