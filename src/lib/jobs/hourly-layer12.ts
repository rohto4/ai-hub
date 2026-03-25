import { runDailyEnrich, type DailyEnrichResult } from '@/lib/jobs/enrich-worker'
import { runHourlyFetch, type HourlyFetchResult } from '@/lib/jobs/hourly-fetch'

export interface HourlyLayer12Options {
  fetchLimit?: number
  enrichBatchSize?: number
  maxEnrichBatches?: number
  summaryBatchSize?: number
}

export interface HourlyLayer12Result {
  fetch: HourlyFetchResult
  enrichRuns: DailyEnrichResult[]
  totals: {
    attempted: number
    processed: number
    failed: number
    provisional: number
    manualPending: number
    completedBatches: number
  }
}

const DEFAULT_FETCH_LIMIT = 20
const DEFAULT_ENRICH_BATCH_SIZE = 25
const DEFAULT_MAX_ENRICH_BATCHES = 8
const DEFAULT_SUMMARY_BATCH_SIZE = 20

export async function runHourlyLayer12(
  options: HourlyLayer12Options = {},
): Promise<HourlyLayer12Result> {
  const fetchLimit = Math.max(1, Math.min(100, options.fetchLimit ?? DEFAULT_FETCH_LIMIT))
  const enrichBatchSize = Math.max(1, Math.min(100, options.enrichBatchSize ?? DEFAULT_ENRICH_BATCH_SIZE))
  const maxEnrichBatches = Math.max(1, Math.min(12, options.maxEnrichBatches ?? DEFAULT_MAX_ENRICH_BATCHES))
  const summaryBatchSize = Math.max(
    1,
    Math.min(20, options.summaryBatchSize ?? DEFAULT_SUMMARY_BATCH_SIZE),
  )

  const fetch = await runHourlyFetch(fetchLimit)
  const enrichRuns: DailyEnrichResult[] = []

  for (let batchIndex = 0; batchIndex < maxEnrichBatches; batchIndex += 1) {
    const enrichResult = await runDailyEnrich({
      limit: enrichBatchSize,
      summaryBatchSize,
    })
    enrichRuns.push(enrichResult)

    if (enrichResult.attempted < enrichBatchSize) {
      break
    }
  }

  return {
    fetch,
    enrichRuns,
    totals: {
      attempted: enrichRuns.reduce((sum, run) => sum + run.attempted, 0),
      processed: enrichRuns.reduce((sum, run) => sum + run.processed, 0),
      failed: enrichRuns.reduce((sum, run) => sum + run.failed, 0),
      provisional: enrichRuns.reduce(
        (sum, run) => sum + run.items.filter((item) => item.isProvisional).length,
        0,
      ),
      manualPending: enrichRuns.reduce((sum, run) => sum + run.manualPendingCount, 0),
      completedBatches: enrichRuns.length,
    },
  }
}
