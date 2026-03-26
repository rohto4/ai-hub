import {
  claimRawArticlesForEnrichment,
  skipExpiredRawArticlesForEnrichment,
} from '@/lib/db/enrichment'
import { listAdjacentTagKeywords } from '@/lib/db/adjacent-tags'
import { finishJobRun, startJobRun } from '@/lib/db/job-runs'
import { listActiveTagReferences, listCollectionTagKeywords } from '@/lib/db/tags'
import {
  type DailyEnrichItemResult,
  type DailyEnrichOptions,
  type DailyEnrichResult,
  type ManualPendingExportItem,
  writeManualPendingExport,
} from '@/lib/enrich/enrich-worker-shared'
import { prepareEnrichArticles } from '@/lib/enrich/prepare-articles'
import { processSummaryBatches } from '@/lib/enrich/persist-enriched'

export type { DailyEnrichItemResult, DailyEnrichOptions, DailyEnrichResult } from '@/lib/enrich/enrich-worker-shared'

const DEFAULT_SUMMARY_BATCH_SIZE = 20
const MAX_SUMMARY_BATCH_SIZE = 20

export async function runDailyEnrich(
  options: number | DailyEnrichOptions = 50,
): Promise<DailyEnrichResult> {
  const limit = typeof options === 'number' ? options : options.limit ?? 50
  const sourceKey = typeof options === 'number' ? null : options.sourceKey ?? null
  const summaryBatchSize =
    typeof options === 'number'
      ? DEFAULT_SUMMARY_BATCH_SIZE
      : Math.max(1, Math.min(MAX_SUMMARY_BATCH_SIZE, options.summaryBatchSize ?? DEFAULT_SUMMARY_BATCH_SIZE))
  const maxSummaryBatches =
    typeof options === 'number'
      ? Number.POSITIVE_INFINITY
      : Math.max(1, options.maxSummaryBatches ?? Number.POSITIVE_INFINITY)

  const jobRunId = await startJobRun({
    jobName: 'enrich-worker',
    metadata: { limit, sourceKey, summaryBatchSize, maxSummaryBatches, claimMode: 'skip_locked' },
  })

  const skippedExpired = await skipExpiredRawArticlesForEnrichment(sourceKey)
  const rawArticles = await claimRawArticlesForEnrichment(limit, sourceKey)
  const tagReferences = await listActiveTagReferences()
  const tagKeywords = await listCollectionTagKeywords()
  const adjacentTagKeywords = await listAdjacentTagKeywords()
  const items: DailyEnrichItemResult[] = []
  const manualPendingExports: ManualPendingExportItem[] = []

  const preparedArticles = await prepareEnrichArticles({
    rawArticles,
    tagReferences,
    jobRunId,
    items,
  })

  await processSummaryBatches({
    jobRunId,
    preparedArticles,
    summaryBatchSize,
    maxSummaryBatches,
    tagReferences,
    tagKeywords,
    adjacentTagKeywords,
    items,
    manualPendingExports,
  })

  const manualPendingExportPath =
    manualPendingExports.length > 0 ? writeManualPendingExport(jobRunId, sourceKey, manualPendingExports) : null

  const result: DailyEnrichResult = {
    attempted: items.length,
    processed: items.filter((item) => item.status === 'processed').length,
    failed: items.filter((item) => item.status === 'failed').length,
    skippedExpired,
    manualPendingCount: manualPendingExports.length,
    manualPendingExportPath,
    items,
  }

  await finishJobRun({
    jobRunId,
    status: result.failed > 0 ? 'failed' : 'completed',
    processedCount: rawArticles.length,
    successCount: result.processed,
    failedCount: result.failed,
    metadata: {
      attempted: items.length,
      skippedExpired,
      summaryBatchSize,
      maxSummaryBatches: Number.isFinite(maxSummaryBatches) ? maxSummaryBatches : 'unbounded',
      manualPendingCount: manualPendingExports.length,
      manualPendingExportPath,
      fullCount: items.filter((item) => item.contentPath === 'full').length,
      snippetCount: items.filter((item) => item.contentPath === 'snippet').length,
      provisionalCount: items.filter((item) => item.isProvisional).length,
    },
    lastError: items.find((item) => item.error)?.error ?? null,
  })

  return result
}
