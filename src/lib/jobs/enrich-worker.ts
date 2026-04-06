import {
  claimRawArticlesForEnrichment,
  skipExpiredRawArticlesForEnrichment,
} from '@/lib/db/enrichment'
import { listAdjacentTagKeywords } from '@/lib/db/adjacent-tags'
import { finishJobRun, startJobRun } from '@/lib/db/job-runs'
import { listActiveTagReferences, listActiveTagRelations, listCollectionTagKeywords } from '@/lib/db/tags'
import {
  type DailyEnrichItemResult,
  type DailyEnrichOptions,
  type DailyEnrichResult,
  type ManualPendingExportItem,
  writeManualPendingExport,
} from '@/lib/enrich/enrich-worker-shared'
import { buildAiPrimaryTagOptions } from '@/lib/enrich/ai-primary-tags'
import { prepareEnrichArticles } from '@/lib/enrich/prepare-articles'
import { processSummaryBatches } from '@/lib/enrich/persist-enriched'
import { buildImpliedTagIdsByChild } from '@/lib/tags/relations'

export type { DailyEnrichItemResult, DailyEnrichOptions, DailyEnrichResult } from '@/lib/enrich/enrich-worker-shared'

const DEFAULT_SUMMARY_BATCH_SIZE = 20
const MAX_SUMMARY_BATCH_SIZE = 20

export type EnrichQueueType = 'all' | 'non-paper' | 'paper'

export function resolveEnrichJobName(queueType: EnrichQueueType, sourceKey: string | null): string {
  if (sourceKey) return 'enrich-worker'
  return queueType === 'paper' ? 'enrich-worker-paper' : 'enrich-worker'
}

export async function runDailyEnrich(
  options: number | DailyEnrichOptions = 50,
): Promise<DailyEnrichResult> {
  const limit = typeof options === 'number' ? options : options.limit ?? 50
  const sourceKey = typeof options === 'number' ? null : options.sourceKey ?? null
  const queueType =
    typeof options === 'number' ? 'non-paper' : ((options.queueType ?? (sourceKey ? 'all' : 'non-paper')) as EnrichQueueType)
  const summaryBatchSize =
    typeof options === 'number'
      ? DEFAULT_SUMMARY_BATCH_SIZE
      : Math.max(1, Math.min(MAX_SUMMARY_BATCH_SIZE, options.summaryBatchSize ?? DEFAULT_SUMMARY_BATCH_SIZE))
  const maxSummaryBatches =
    typeof options === 'number'
      ? Number.POSITIVE_INFINITY
      : Math.max(1, options.maxSummaryBatches ?? Number.POSITIVE_INFINITY)

  const jobRunId = await startJobRun({
    jobName: resolveEnrichJobName(queueType, sourceKey),
    metadata: { limit, sourceKey, queueType, summaryBatchSize, maxSummaryBatches, claimMode: 'skip_locked' },
  })

  const skippedExpired = await skipExpiredRawArticlesForEnrichment(sourceKey, queueType)
  const rawArticles = await claimRawArticlesForEnrichment(limit, sourceKey, queueType)
  const tagReferences = await listActiveTagReferences()
  const tagRelations = await listActiveTagRelations()
  const aiPrimaryTagOptions = buildAiPrimaryTagOptions(tagReferences)
  const tagKeywords = await listCollectionTagKeywords()
  const adjacentTagKeywords = await listAdjacentTagKeywords()
  const impliedTagIdsByChild = buildImpliedTagIdsByChild(tagRelations)
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
    impliedTagIdsByChild,
    aiPrimaryTagOptions,
    items,
    manualPendingExports,
  })

  const manualPendingExportPath =
    manualPendingExports.length > 0
      ? writeManualPendingExport(jobRunId, sourceKey ?? queueType, manualPendingExports)
      : null

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
      queueType,
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
