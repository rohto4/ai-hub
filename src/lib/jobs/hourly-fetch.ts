import { getCollector } from '@/lib/collectors'
import type { SourceTarget } from '@/lib/collectors/types'
import { markLatestRawError, persistCollectedItem } from '@/lib/db/articles-raw'
import { finishJobRun, recordJobRunItem, startJobRun } from '@/lib/db/job-runs'
import { listDueSourceTargets } from '@/lib/db/source-targets'
import { normalizeUrl } from '@/lib/rss/normalize'

export interface HourlyFetchTargetResult {
  sourceTargetId: string
  sourceKey: string
  inserted: number
  updated: number
  skipped: number
  failed: number
  error?: string
}

export interface HourlyFetchResult {
  processedTargets: number
  succeededTargets: number
  failedTargets: number
  inserted: number
  updated: number
  skipped: number
  failedItems: number
  targets: HourlyFetchTargetResult[]
}

export interface HourlyFetchOptions {
  limit?: number
  sourceKey?: string | null
}

async function processSourceTarget(sourceTarget: SourceTarget): Promise<HourlyFetchTargetResult> {
  const collector = getCollector(sourceTarget.fetchKind)
  const result: HourlyFetchTargetResult = {
    sourceTargetId: sourceTarget.id,
    sourceKey: sourceTarget.sourceKey,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  }

  const collectedItems = await collector.collect(sourceTarget)

  for (const item of collectedItems) {
    try {
      const persistResult = await persistCollectedItem({ sourceTarget, item })
      result[persistResult] += 1
    } catch (error) {
      result.failed += 1
      const message = error instanceof Error ? error.message : 'Unknown persistence error'
      result.error = message

      const normalizedUrl = normalizeUrl(item.citedUrl ?? item.sourceUrl)
      if (normalizedUrl) {
        // When a matching raw row already exists, preserve the failure for later inspection.
        // A brand new failed insert has no row to attach an error to.
        await markLatestRawError(sourceTarget.id, normalizedUrl, message)
      }
    }
  }

  return result
}

export async function runHourlyFetch(options: number | HourlyFetchOptions = 20): Promise<HourlyFetchResult> {
  const limit = typeof options === 'number' ? options : options.limit ?? 20
  const sourceKey = typeof options === 'number' ? null : options.sourceKey ?? null
  const jobRunId = await startJobRun({
    jobName: 'hourly-fetch',
    metadata: { limit, sourceKey },
  })
  const sourceTargets = await listDueSourceTargets(limit, sourceKey)
  const settled = await Promise.allSettled(sourceTargets.map((sourceTarget) => processSourceTarget(sourceTarget)))

  const targets: HourlyFetchTargetResult[] = settled.map((entry, index) => {
    if (entry.status === 'fulfilled') {
      return entry.value
    }

    const sourceTarget = sourceTargets[index]
    return {
      sourceTargetId: sourceTarget.id,
      sourceKey: sourceTarget.sourceKey,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      error: entry.reason instanceof Error ? entry.reason.message : 'Unknown collector error',
    }
  })

  for (const target of targets) {
    await recordJobRunItem({
      jobRunId,
      itemKey: target.sourceKey,
      itemStatus: target.error ? 'failed' : 'processed',
      detail: {
        sourceTargetId: target.sourceTargetId,
        sourceKey: target.sourceKey,
        inserted: target.inserted,
        updated: target.updated,
        skipped: target.skipped,
        failed: target.failed,
      },
      errorMessage: target.error ?? null,
    })
  }

  const result = {
    processedTargets: sourceTargets.length,
    succeededTargets: settled.filter((entry) => entry.status === 'fulfilled').length,
    failedTargets: settled.filter((entry) => entry.status === 'rejected').length,
    inserted: targets.reduce((sum, item) => sum + item.inserted, 0),
    updated: targets.reduce((sum, item) => sum + item.updated, 0),
    skipped: targets.reduce((sum, item) => sum + item.skipped, 0),
    failedItems: targets.reduce((sum, item) => sum + item.failed, 0),
    targets,
  }

  await finishJobRun({
    jobRunId,
    status: result.failedTargets > 0 ? 'failed' : 'completed',
    processedCount: result.processedTargets,
    successCount: result.succeededTargets,
    failedCount: result.failedTargets,
    metadata: {
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      failedItems: result.failedItems,
    },
    lastError: targets.find((target) => target.error)?.error ?? null,
  })

  return result
}
