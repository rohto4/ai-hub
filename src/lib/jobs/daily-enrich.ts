import fs from 'node:fs'
import path from 'node:path'
import { generateEnrichedSummaries } from '@/lib/ai/enrich'
import {
  type RawArticleForEnrichment,
  type DedupeStatus,
  findDuplicateMatch,
  findSimilarTitleDuplicate,
  listRawArticlesForEnrichment,
  markRawError,
  markRawProcessed,
  upsertEnrichedArticle,
} from '@/lib/db/enrichment'
import { finishJobRun, recordJobRunItem, startJobRun } from '@/lib/db/job-runs'
import { listActiveTagReferences } from '@/lib/db/tags'
import { type ExtractedContentResult, resolveArticleContent } from '@/lib/extractors/content'
import { assessSourceTargetRelevance } from '@/lib/relevance/source-target'
import { matchTags } from '@/lib/tags/match'
import { decodeAndNormalizeText, normalizeHeadline } from '@/lib/text/normalize'

export interface DailyEnrichItemResult {
  rawArticleId: number
  status: 'processed' | 'failed'
  contentPath?: 'full' | 'snippet'
  isProvisional?: boolean
  provisionalReason?:
    | 'snippet_only'
    | 'domain_snippet_only'
    | 'fetch_error'
    | 'extracted_below_threshold'
    | 'feed_only_policy'
    | 'domain_needs_review'
    | null
  error?: string
}

export interface DailyEnrichResult {
  attempted: number
  processed: number
  failed: number
  manualPendingCount: number
  manualPendingExportPath: string | null
  items: DailyEnrichItemResult[]
}

export interface DailyEnrichOptions {
  limit?: number
  sourceKey?: string | null
  summaryBatchSize?: number
}

interface PreparedEnrichArticle {
  rawArticle: RawArticleForEnrichment
  title: string
  normalizedSnippet: string
  contentResult: ExtractedContentResult
  summaryInput: {
    summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
    summaryInputText: string
  }
  relevance: ReturnType<typeof assessSourceTargetRelevance>
  tagResult: ReturnType<typeof matchTags>
  dedupeStatus: DedupeStatus
  dedupeGroupKey: string
  provisionalState: ReturnType<typeof determineProvisionalState>
  summaryBasis: ReturnType<typeof determineSummaryBasis>
  snippetPublishable: boolean
  shouldPersistCandidateTags: boolean
}

type ManualPendingExportItem = {
  rawArticleId: number
  sourceTargetId: string
  sourceKey: string
  normalizedUrl: string
  citedUrl: string | null
  canonicalUrl: string
  sourceUpdatedAt: string | null
  title: string
  contentPath: 'full' | 'snippet'
  summaryBasis: 'full_content' | 'feed_snippet' | 'blocked_snippet' | 'fallback_snippet'
  provisionalBase: {
    isProvisional: boolean
    provisionalReason:
      | 'snippet_only'
      | 'domain_snippet_only'
      | 'fetch_error'
      | 'extracted_below_threshold'
      | 'feed_only_policy'
      | 'domain_needs_review'
      | null
  }
  dedupeStatus: DedupeStatus
  dedupeGroupKey: string | null
  isRelevant: boolean
  matchedTagIds: string[]
  candidateTags: Array<{ candidateKey: string; displayName: string }>
  publicationBasisIfSummaryExists: 'hold' | 'full_summary' | 'source_snippet'
  summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
  summaryInputText: string
  content: string
}

function determineProvisionalState(
  contentPath: 'full' | 'snippet',
  extractionStage:
    | 'extracted'
    | 'extracted_below_threshold'
    | 'fetch_error'
    | 'domain_snippet_only'
    | 'feed_only_policy'
    | 'domain_needs_review'
): {
  isProvisional: boolean
  provisionalReason:
    | 'snippet_only'
    | 'domain_snippet_only'
    | 'fetch_error'
    | 'extracted_below_threshold'
    | 'feed_only_policy'
    | 'domain_needs_review'
    | null
} {
  if (contentPath === 'full') {
    return {
      isProvisional: false,
      provisionalReason: null,
    }
  }

  if (extractionStage === 'domain_snippet_only') {
    return {
      isProvisional: true,
      provisionalReason: 'domain_snippet_only',
    }
  }

  if (extractionStage === 'fetch_error') {
    return {
      isProvisional: true,
      provisionalReason: 'fetch_error',
    }
  }

  if (extractionStage === 'feed_only_policy') {
    return {
      isProvisional: true,
      provisionalReason: 'feed_only_policy',
    }
  }

  if (extractionStage === 'domain_needs_review') {
    return {
      isProvisional: true,
      provisionalReason: 'domain_needs_review',
    }
  }

  if (extractionStage === 'extracted_below_threshold') {
    return {
      isProvisional: true,
      provisionalReason: 'extracted_below_threshold',
    }
  }

  return {
    isProvisional: true,
    provisionalReason: 'snippet_only',
  }
}

function determineSummaryBasis(
  contentPath: 'full' | 'snippet',
  provisionalReason:
    | 'snippet_only'
    | 'domain_snippet_only'
    | 'fetch_error'
    | 'extracted_below_threshold'
    | 'feed_only_policy'
    | 'domain_needs_review'
    | null,
): 'full_content' | 'feed_snippet' | 'blocked_snippet' | 'fallback_snippet' {
  if (contentPath === 'full') {
    return 'full_content'
  }

  if (provisionalReason === 'feed_only_policy') {
    return 'feed_snippet'
  }

  if (provisionalReason === 'domain_snippet_only') {
    return 'blocked_snippet'
  }

  return 'fallback_snippet'
}

function determineSummaryInput(
  contentPath: 'full' | 'snippet',
  extractedContent: string,
  normalizedSnippet: string,
  title: string,
): {
  summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
  summaryInputText: string
} {
  if (contentPath === 'full' && extractedContent.trim().length > 0) {
    return {
      summaryInputBasis: 'full_content',
      summaryInputText: extractedContent,
    }
  }

  if (normalizedSnippet.trim().length >= 80) {
    return {
      summaryInputBasis: 'source_snippet',
      summaryInputText: normalizedSnippet,
    }
  }

  return {
    summaryInputBasis: 'title_only',
    summaryInputText: title,
  }
}

function isSnippetPublicationEligible(
  summaryBasis: 'full_content' | 'feed_snippet' | 'blocked_snippet' | 'fallback_snippet',
  contentPath: 'full' | 'snippet',
  snippet: string,
  dedupeStatus: DedupeStatus,
  isRelevant: boolean,
): boolean {
  if (contentPath !== 'snippet') {
    return false
  }

  if (!isRelevant || dedupeStatus !== 'unique') {
    return false
  }

  if (!['feed_snippet', 'blocked_snippet'].includes(summaryBasis)) {
    return false
  }

  const normalized = snippet.trim()
  if (normalized.length < 80) {
    return false
  }

  if (/^(\.\.\.|…)/.test(normalized)) {
    return false
  }

  const tokenCount = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .length

  return tokenCount >= 12
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function writeManualPendingExport(
  jobRunId: number,
  sourceKey: string | null,
  items: ManualPendingExportItem[],
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputDir = path.join(process.cwd(), 'artifacts', 'manual-pending')
  const outputPath = path.join(
    outputDir,
    `ai-enrich-inputs-manual-pending-${sourceKey ?? 'mixed'}-job-${jobRunId}-${timestamp}.json`,
  )

  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceKey,
        totalExported: items.length,
        items,
      },
      null,
      2,
    ),
    'utf8',
  )

  return outputPath
}

function scoreArticle(
  contentPath: 'full' | 'snippet',
  matchedTagCount: number,
  summarySource: 'gemini' | 'gemini2' | 'openai' | 'manual_pending',
): { score: number; scoreReason: string } {
  const base = contentPath === 'full' ? 70 : 45
  const summaryBonus = summarySource === 'manual_pending' ? 0 : 6
  const score = Math.min(100, base + matchedTagCount * 8 + summaryBonus)
  const scoreReason =
    contentPath === 'full'
      ? `full extraction, ${matchedTagCount} matched tags, ${summarySource} summary`
      : `snippet fallback, ${matchedTagCount} matched tags, ${summarySource} summary`

  return { score, scoreReason }
}

export async function runDailyEnrich(
  options: number | DailyEnrichOptions = 50,
): Promise<DailyEnrichResult> {
  const limit = typeof options === 'number' ? options : options.limit ?? 50
  const sourceKey = typeof options === 'number' ? null : options.sourceKey ?? null
  const summaryBatchSize =
    typeof options === 'number' ? 10 : Math.max(1, Math.min(10, options.summaryBatchSize ?? 10))
  const jobRunId = await startJobRun({
    jobName: 'daily-enrich',
    metadata: { limit, sourceKey, summaryBatchSize },
  })
  const rawArticles = await listRawArticlesForEnrichment(limit, sourceKey)
  const tagReferences = await listActiveTagReferences()
  const items: DailyEnrichItemResult[] = []
  const preparedArticles: PreparedEnrichArticle[] = []
  const manualPendingExports: ManualPendingExportItem[] = []

  for (const rawArticle of rawArticles) {
    try {
      const title = rawArticle.title ? normalizeHeadline(rawArticle.title) : rawArticle.normalizedUrl
      const normalizedSnippet = rawArticle.snippet ? decodeAndNormalizeText(rawArticle.snippet) : ''
      const contentResult = await resolveArticleContent(
        rawArticle.citedUrl ?? rawArticle.sourceUrl,
        normalizedSnippet,
        rawArticle.contentAccessPolicy,
        rawArticle.observedDomainFetchPolicy,
      )
      const summaryInput = determineSummaryInput(
        contentResult.contentPath,
        contentResult.content,
        normalizedSnippet,
        title,
      )
      const relevance = assessSourceTargetRelevance(rawArticle.sourceKey, title, normalizedSnippet)
      const tagResult = matchTags(
        tagReferences,
        title,
        contentResult.content || normalizedSnippet,
        rawArticle.sourceCategory,
      )
      const duplicate = await findDuplicateMatch(
        rawArticle.normalizedUrl,
        rawArticle.citedUrl,
        title,
        rawArticle.id,
      )
      const similarDuplicate = duplicate ? null : await findSimilarTitleDuplicate(title, rawArticle.id)
      const provisionalState = determineProvisionalState(contentResult.contentPath, contentResult.extractionStage)
      const summaryBasis = determineSummaryBasis(
        contentResult.contentPath,
        provisionalState.provisionalReason,
      )

      const dedupeStatus = duplicate?.dedupeStatus ?? similarDuplicate?.dedupeStatus ?? 'unique'
      const dedupeGroupKey =
        duplicate?.dedupeGroupKey ??
        similarDuplicate?.dedupeGroupKey ??
        rawArticle.citedUrl ??
        rawArticle.normalizedUrl
      const snippetPublishable = isSnippetPublicationEligible(
        summaryBasis,
        contentResult.contentPath,
        normalizedSnippet,
        dedupeStatus,
        relevance.isRelevant,
      )
      const shouldPersistCandidateTags = relevance.isRelevant && contentResult.contentPath === 'full'

      preparedArticles.push({
        rawArticle,
        title,
        normalizedSnippet,
        contentResult,
        summaryInput,
        relevance,
        tagResult,
        dedupeStatus,
        dedupeGroupKey,
        provisionalState,
        summaryBasis,
        snippetPublishable,
        shouldPersistCandidateTags,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown enrich error'
      await markRawError(rawArticle.id, message)
      await recordJobRunItem({
        jobRunId,
        itemKey: String(rawArticle.id),
        itemStatus: 'failed',
        detail: {
          rawArticleId: rawArticle.id,
          title: rawArticle.title,
        },
        errorMessage: message,
      })
      items.push({
        rawArticleId: rawArticle.id,
        status: 'failed',
        error: message,
      })
    }
  }

  for (const batch of chunkItems(preparedArticles, summaryBatchSize)) {
    const summaries = await generateEnrichedSummaries(
      batch.map((article) => ({
        id: String(article.rawArticle.id),
        title: article.title,
        content: article.summaryInput.summaryInputText,
      })),
      summaryBatchSize,
    )

    for (const [index, article] of batch.entries()) {
      const summariesForArticle = summaries[index]

      try {
        const publicationBasisIfSummaryExists =
          article.contentResult.contentPath === 'full'
            ? 'full_summary'
            : article.snippetPublishable
              ? 'source_snippet'
              : 'hold'
        const publicationBasis =
          summariesForArticle.summarySource === 'manual_pending'
            ? 'hold'
            : article.contentResult.contentPath === 'full'
              ? 'full_summary'
              : article.snippetPublishable
                ? 'source_snippet'
                : 'hold'
        const publicationText =
          publicationBasis === 'hold'
            ? null
            : summariesForArticle.summary200 || summariesForArticle.summary100
        const finalIsProvisional =
          publicationBasis === 'source_snippet' ? false : article.provisionalState.isProvisional
        const finalProvisionalReason =
          publicationBasis === 'source_snippet' ? null : article.provisionalState.provisionalReason
        const publishCandidate =
          publicationBasis !== 'hold' &&
          article.dedupeStatus === 'unique' &&
          article.relevance.isRelevant
        const aiProcessingState =
          summariesForArticle.summarySource === 'manual_pending' ? 'manual_pending' : 'completed'
        const { score, scoreReason } = scoreArticle(
          article.contentResult.contentPath,
          article.tagResult.matchedTagIds.length,
          summariesForArticle.summarySource,
        )
        const adjustedScore = article.relevance.isRelevant ? score : Math.max(0, score - 25)
        const adjustedScoreReason = article.relevance.isRelevant
          ? scoreReason
          : `${scoreReason}; low source relevance`

        await upsertEnrichedArticle({
          rawArticleId: article.rawArticle.id,
          sourceTargetId: article.rawArticle.sourceTargetId,
          normalizedUrl: article.rawArticle.normalizedUrl,
          citedUrl: article.rawArticle.citedUrl,
          canonicalUrl: article.rawArticle.citedUrl ?? article.rawArticle.normalizedUrl,
          title: article.title,
          summary100: summariesForArticle.summary100,
          summary200: summariesForArticle.summary200,
          summaryBasis: article.summaryBasis,
          contentPath: article.contentResult.contentPath,
          isProvisional: finalIsProvisional,
          provisionalReason: finalProvisionalReason,
          dedupeStatus: article.dedupeStatus,
          dedupeGroupKey: article.dedupeGroupKey,
          publishCandidate,
          publicationBasis,
          publicationText,
          summaryInputBasis: article.summaryInput.summaryInputBasis,
          score: adjustedScore,
          scoreReason: adjustedScoreReason,
          aiProcessingState,
          sourceUpdatedAt: article.rawArticle.sourceUpdatedAt,
          matchedTagIds: article.tagResult.matchedTagIds,
          candidateTags: article.shouldPersistCandidateTags ? article.tagResult.candidateTags : [],
        })

        await markRawProcessed(article.rawArticle.id)
        await recordJobRunItem({
          jobRunId,
          itemKey: String(article.rawArticle.id),
          itemStatus: 'processed',
          detail: {
            rawArticleId: article.rawArticle.id,
            title: article.title,
            contentPath: article.contentResult.contentPath,
            isProvisional: finalIsProvisional,
            provisionalReason: finalProvisionalReason,
            summaryBasis: article.summaryBasis,
            publicationBasis,
            summaryInputBasis: article.summaryInput.summaryInputBasis,
            publishCandidate,
            dedupeStatus: article.dedupeStatus,
            relevanceMatchedKeyword: article.relevance.matchedKeyword,
            isRelevant: article.relevance.isRelevant,
            extractionStage: article.contentResult.extractionStage,
            extractedLength: article.contentResult.extractedLength,
            snippetLength: article.contentResult.snippetLength,
            extractionError: article.contentResult.extractionError ?? null,
            matchedTagCount: article.tagResult.matchedTagIds.length,
            candidateTagCount: article.shouldPersistCandidateTags
              ? article.tagResult.candidateTags.length
              : 0,
            summarySource: summariesForArticle.summarySource,
            aiProcessingState,
          },
        })
        if (aiProcessingState === 'manual_pending') {
          manualPendingExports.push({
            rawArticleId: article.rawArticle.id,
            sourceTargetId: article.rawArticle.sourceTargetId,
            sourceKey: article.rawArticle.sourceKey,
            normalizedUrl: article.rawArticle.normalizedUrl,
            citedUrl: article.rawArticle.citedUrl,
            canonicalUrl: article.rawArticle.citedUrl ?? article.rawArticle.normalizedUrl,
            sourceUpdatedAt: article.rawArticle.sourceUpdatedAt,
            title: article.title,
            contentPath: article.contentResult.contentPath,
            summaryBasis: article.summaryBasis,
            provisionalBase: article.provisionalState,
            dedupeStatus: article.dedupeStatus,
            dedupeGroupKey: article.dedupeGroupKey,
            isRelevant: article.relevance.isRelevant,
            matchedTagIds: article.tagResult.matchedTagIds,
            candidateTags: article.shouldPersistCandidateTags ? article.tagResult.candidateTags : [],
            publicationBasisIfSummaryExists,
            summaryInputBasis: article.summaryInput.summaryInputBasis,
            summaryInputText: article.summaryInput.summaryInputText,
            content: article.contentResult.content,
          })
        }
        items.push({
          rawArticleId: article.rawArticle.id,
          status: 'processed',
          contentPath: article.contentResult.contentPath,
          isProvisional: finalIsProvisional,
          provisionalReason: finalProvisionalReason,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown enrich error'
        await markRawError(article.rawArticle.id, message)
        await recordJobRunItem({
          jobRunId,
          itemKey: String(article.rawArticle.id),
          itemStatus: 'failed',
          detail: {
            rawArticleId: article.rawArticle.id,
            title: article.rawArticle.title,
          },
          errorMessage: message,
        })
        items.push({
          rawArticleId: article.rawArticle.id,
          status: 'failed',
          error: message,
        })
      }
    }
  }

  const manualPendingExportPath =
    manualPendingExports.length > 0 ? writeManualPendingExport(jobRunId, sourceKey, manualPendingExports) : null

  const result = {
    attempted: items.length,
    processed: items.filter((item) => item.status === 'processed').length,
    failed: items.filter((item) => item.status === 'failed').length,
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
      summaryBatchSize,
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
