import { getSql } from '@/lib/db'
import { finishJobRun, recordJobRunItem, startJobRun } from '@/lib/db/job-runs'
import { listPublishCandidates } from '@/lib/publish/hourly-publish-candidates'
import { hideUnpublishedPublicArticles } from '@/lib/publish/hourly-publish-hide'
import {
  BULK_CHUNK_SIZE,
  FALLBACK_BATCH_SIZE,
  type HourlyPublishResult,
  toChunks,
} from '@/lib/publish/hourly-publish-shared'
import { bulkPublishBatch, publishOne } from '@/lib/publish/hourly-publish-upsert'

export type { HourlyPublishResult } from '@/lib/publish/hourly-publish-shared'

export async function runHourlyPublish(): Promise<HourlyPublishResult> {
  const sql = getSql()
  const jobRunId = await startJobRun({
    jobName: 'hourly-publish',
    metadata: {},
  })

  const candidates = await listPublishCandidates(sql)

  let upserted = 0
  let tagsUpdated = 0
  let failed = 0

  for (const chunk of toChunks(candidates, BULK_CHUNK_SIZE)) {
    try {
      const result = await bulkPublishBatch(sql, chunk)
      upserted += result.upserted
      tagsUpdated += result.tagsUpdated
    } catch (tier1Error) {
      console.warn(
        `[hourly-publish] Tier-1 chunk failed (${chunk.length} articles, ids: ${chunk[0]?.enriched_article_id}-${chunk[chunk.length - 1]?.enriched_article_id}). Switching to batch-of-${FALLBACK_BATCH_SIZE}:`,
        tier1Error instanceof Error ? tier1Error.message : tier1Error,
      )

      for (const smallChunk of toChunks(chunk, FALLBACK_BATCH_SIZE)) {
        try {
          const result = await bulkPublishBatch(sql, smallChunk)
          upserted += result.upserted
          tagsUpdated += result.tagsUpdated
        } catch (tier2Error) {
          console.warn(
            `[hourly-publish] Tier-2 batch-of-${FALLBACK_BATCH_SIZE} failed (enriched_ids: ${smallChunk.map((candidate) => candidate.enriched_article_id).join(',')}). Switching to per-article:`,
            tier2Error instanceof Error ? tier2Error.message : tier2Error,
          )

          for (const candidate of smallChunk) {
            try {
              const articleTagsUpdated = await publishOne(sql, candidate)
              upserted += 1
              tagsUpdated += articleTagsUpdated
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unknown publish error'
              failed += 1
              await recordJobRunItem({
                jobRunId,
                itemKey: String(candidate.enriched_article_id),
                itemStatus: 'failed',
                detail: {
                  enrichedArticleId: candidate.enriched_article_id,
                  canonicalUrl: candidate.canonical_url,
                },
                errorMessage: message,
              })
            }
          }
        }
      }
    }
  }

  const hidden = await hideUnpublishedPublicArticles(sql)

  await finishJobRun({
    jobRunId,
    status: failed > 0 ? 'failed' : 'completed',
    processedCount: candidates.length,
    successCount: upserted,
    failedCount: failed,
    metadata: { upserted, hidden, tagsUpdated },
    lastError: null,
  })

  return { upserted, hidden, tagsUpdated, failed }
}
