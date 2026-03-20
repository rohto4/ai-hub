import {
  findDuplicateMatch,
  findSimilarTitleDuplicate,
  markRawError,
  type RawArticleForEnrichment,
} from '@/lib/db/enrichment'
import { recordJobRunItem } from '@/lib/db/job-runs'
import { resolveArticleContent } from '@/lib/extractors/content'
import { assessSourceTargetRelevance } from '@/lib/relevance/source-target'
import { matchTags } from '@/lib/tags/match'
import { decodeAndNormalizeText, normalizeHeadline } from '@/lib/text/normalize'
import {
  determineProvisionalState,
  determineSummaryBasis,
  determineSummaryInput,
  isSnippetPublicationEligible,
  type DailyEnrichItemResult,
  type PreparedEnrichArticle,
} from '@/lib/enrich/daily-enrich-shared'

export async function prepareEnrichArticles(params: {
  rawArticles: RawArticleForEnrichment[]
  tagReferences: Awaited<ReturnType<typeof import('@/lib/db/tags').listActiveTagReferences>>
  jobRunId: number
  items: DailyEnrichItemResult[]
}): Promise<PreparedEnrichArticle[]> {
  const preparedArticles: PreparedEnrichArticle[] = []

  for (const rawArticle of params.rawArticles) {
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
      const tagResult = matchTags(params.tagReferences, title, contentResult.content || normalizedSnippet)
      const duplicate = await findDuplicateMatch(rawArticle.normalizedUrl, rawArticle.citedUrl, rawArticle.id)
      const similarDuplicate = duplicate ? null : await findSimilarTitleDuplicate(title, rawArticle.id)
      const provisionalState = determineProvisionalState(contentResult.contentPath, contentResult.extractionStage)
      const summaryBasis = determineSummaryBasis(contentResult.contentPath, provisionalState.provisionalReason)
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
        shouldPersistCandidateTags: relevance.isRelevant && contentResult.contentPath === 'full',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown enrich error'
      await markRawError(rawArticle.id, message)
      await recordJobRunItem({
        jobRunId: params.jobRunId,
        itemKey: String(rawArticle.id),
        itemStatus: 'failed',
        detail: { rawArticleId: rawArticle.id, title: rawArticle.title },
        errorMessage: message,
      })
      params.items.push({ rawArticleId: rawArticle.id, status: 'failed', error: message })
    }
  }

  return preparedArticles
}
