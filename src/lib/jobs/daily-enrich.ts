import { generateEnrichedSummary } from '@/lib/ai/enrich'
import {
  findDuplicateMatch,
  findSimilarTitleDuplicate,
  listRawArticlesForEnrichment,
  markRawError,
  markRawProcessed,
  upsertEnrichedArticle,
} from '@/lib/db/enrichment'
import { finishJobRun, recordJobRunItem, startJobRun } from '@/lib/db/job-runs'
import { listActiveTagReferences } from '@/lib/db/tags'
import { resolveArticleContent } from '@/lib/extractors/content'
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
  items: DailyEnrichItemResult[]
}

export interface DailyEnrichOptions {
  limit?: number
  sourceKey?: string | null
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

function scoreArticle(
  contentPath: 'full' | 'snippet',
  matchedTagCount: number,
  summarySource: 'gemini' | 'template',
): { score: number; scoreReason: string } {
  const base = contentPath === 'full' ? 70 : 45
  const summaryBonus = summarySource === 'gemini' ? 6 : 0
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
  const jobRunId = await startJobRun({
    jobName: 'daily-enrich',
    metadata: { limit, sourceKey },
  })
  const rawArticles = await listRawArticlesForEnrichment(limit, sourceKey)
  const tagReferences = await listActiveTagReferences()
  const items: DailyEnrichItemResult[] = []

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
      const summaries = await generateEnrichedSummary(title, contentResult.content || title)
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
      const publishCandidate =
        !provisionalState.isProvisional && dedupeStatus === 'unique' && relevance.isRelevant
      const shouldPersistCandidateTags = relevance.isRelevant && contentResult.contentPath === 'full'
      const { score, scoreReason } = scoreArticle(
        contentResult.contentPath,
        tagResult.matchedTagIds.length,
        summaries.summarySource,
      )
      const adjustedScore = relevance.isRelevant ? score : Math.max(0, score - 25)
      const adjustedScoreReason = relevance.isRelevant
        ? scoreReason
        : `${scoreReason}; low source relevance`

      await upsertEnrichedArticle({
        rawArticleId: rawArticle.id,
        sourceTargetId: rawArticle.sourceTargetId,
        normalizedUrl: rawArticle.normalizedUrl,
        citedUrl: rawArticle.citedUrl,
        canonicalUrl: rawArticle.citedUrl ?? rawArticle.normalizedUrl,
        title,
        summary100: summaries.summary100,
        summary200: summaries.summary200,
        summaryBasis,
        contentPath: contentResult.contentPath,
        isProvisional: provisionalState.isProvisional,
        provisionalReason: provisionalState.provisionalReason,
        dedupeStatus,
        dedupeGroupKey,
        publishCandidate,
        score: adjustedScore,
        scoreReason: adjustedScoreReason,
        sourceUpdatedAt: rawArticle.sourceUpdatedAt,
        matchedTagIds: tagResult.matchedTagIds,
        candidateTags: shouldPersistCandidateTags ? tagResult.candidateTags : [],
      })

      await markRawProcessed(rawArticle.id)
      await recordJobRunItem({
        jobRunId,
        itemKey: String(rawArticle.id),
        itemStatus: 'processed',
        detail: {
          rawArticleId: rawArticle.id,
          title,
          contentPath: contentResult.contentPath,
          isProvisional: provisionalState.isProvisional,
          provisionalReason: provisionalState.provisionalReason,
          summaryBasis,
          publishCandidate,
          dedupeStatus,
          relevanceMatchedKeyword: relevance.matchedKeyword,
          isRelevant: relevance.isRelevant,
          extractionStage: contentResult.extractionStage,
          extractedLength: contentResult.extractedLength,
          snippetLength: contentResult.snippetLength,
          extractionError: contentResult.extractionError ?? null,
          matchedTagCount: tagResult.matchedTagIds.length,
          candidateTagCount: shouldPersistCandidateTags ? tagResult.candidateTags.length : 0,
        },
      })
      items.push({
        rawArticleId: rawArticle.id,
        status: 'processed',
        contentPath: contentResult.contentPath,
        isProvisional: provisionalState.isProvisional,
        provisionalReason: provisionalState.provisionalReason,
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

  const result = {
    attempted: items.length,
    processed: items.filter((item) => item.status === 'processed').length,
    failed: items.filter((item) => item.status === 'failed').length,
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
      fullCount: items.filter((item) => item.contentPath === 'full').length,
      snippetCount: items.filter((item) => item.contentPath === 'snippet').length,
      provisionalCount: items.filter((item) => item.isProvisional).length,
    },
    lastError: items.find((item) => item.error)?.error ?? null,
  })

  return result
}
