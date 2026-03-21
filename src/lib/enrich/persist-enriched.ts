import { generateTextEmbeddings } from '@/lib/ai/embeddings'
import { generateEnrichedSummaries } from '@/lib/ai/enrich'
import {
  findSemanticDuplicate,
  markRawError,
  markRawProcessed,
  upsertEnrichedArticle,
} from '@/lib/db/enrichment'
import { recordJobRunItem } from '@/lib/db/job-runs'
import { buildInternalThumbnailUrl } from '@/lib/publish/thumbnail-template'
import { matchTagsFromKeywords } from '@/lib/tags/match'
import {
  chunkItems,
  passesSnippetConsistencyGate,
  scoreArticle,
  SUMMARY_FALLBACK_BATCH_SIZE,
  type DailyEnrichItemResult,
  type ManualPendingExportItem,
  type PreparedEnrichArticle,
} from '@/lib/enrich/daily-enrich-shared'

export async function processSummaryBatches(params: {
  jobRunId: number
  preparedArticles: PreparedEnrichArticle[]
  summaryBatchSize: number
  maxSummaryBatches: number
  tagReferences: Awaited<ReturnType<typeof import('@/lib/db/tags').listActiveTagReferences>>
  tagKeywords: Awaited<ReturnType<typeof import('@/lib/db/tags').listCollectionTagKeywords>>
  items: DailyEnrichItemResult[]
  manualPendingExports: ManualPendingExportItem[]
}): Promise<void> {
  const summaryBatches = chunkItems(params.preparedArticles, params.summaryBatchSize).slice(0, params.maxSummaryBatches)

  for (const batch of summaryBatches) {
    try {
      await runAiBatch(batch, params, params.summaryBatchSize)
    } catch (tier1Error) {
      console.warn(
        `[daily-enrich] Tier-1 AI batch failed (${batch.length} articles, raw_ids: ${batch.map((article) => article.rawArticle.id).join(',')}). Switching to sub-batches of ${SUMMARY_FALLBACK_BATCH_SIZE}:`,
        tier1Error instanceof Error ? tier1Error.message : tier1Error,
      )

      for (const subBatch of chunkItems(batch, SUMMARY_FALLBACK_BATCH_SIZE)) {
        try {
          await runAiBatch(subBatch, params, subBatch.length)
        } catch (tier2Error) {
          console.warn(
            `[daily-enrich] Tier-2 sub-batch failed (${subBatch.length} articles, raw_ids: ${subBatch.map((article) => article.rawArticle.id).join(',')}). Falling back to per-article:`,
            tier2Error instanceof Error ? tier2Error.message : tier2Error,
          )

          for (const article of subBatch) {
            try {
              await runAiBatch([article], params, 1)
            } catch (error) {
              await handleEnrichError(article, params.jobRunId, params.items, error)
            }
          }
        }
      }
    }
  }
}

async function runAiBatch(
  batch: PreparedEnrichArticle[],
  params: {
    jobRunId: number
    tagReferences: Awaited<ReturnType<typeof import('@/lib/db/tags').listActiveTagReferences>>
    tagKeywords: Awaited<ReturnType<typeof import('@/lib/db/tags').listCollectionTagKeywords>>
    items: DailyEnrichItemResult[]
    manualPendingExports: ManualPendingExportItem[]
  },
  batchSizeHint: number,
): Promise<void> {
  const summaries = await generateEnrichedSummaries(
    batch.map((article) => ({
      id: String(article.rawArticle.id),
      title: article.title,
      content: article.summaryInput.summaryInputText,
      summaryInputBasis: article.summaryInput.summaryInputBasis,
    })),
    batchSizeHint,
  )

  const embeddings = await generateTextEmbeddings(
    batch.map((article, index) => ({
      id: String(article.rawArticle.id),
      text: `${article.title}\n${summaries[index]?.summary200 || summaries[index]?.summary100 || ''}`,
    })),
  )
  const embeddingById = new Map(embeddings.map((embedding) => [embedding.id, embedding]))

  for (const [index, article] of batch.entries()) {
    try {
      const embedding = embeddingById.get(String(article.rawArticle.id))
      await persistPreparedArticle({
        article,
        summaryForArticle: summaries[index],
        embeddingResult: { embedding: embedding?.embedding ?? null, model: embedding?.model ?? null },
        jobRunId: params.jobRunId,
        tagReferences: params.tagReferences,
        tagKeywords: params.tagKeywords,
        items: params.items,
        manualPendingExports: params.manualPendingExports,
      })
    } catch (error) {
      await handleEnrichError(article, params.jobRunId, params.items, error)
    }
  }
}

async function persistPreparedArticle(params: {
  article: PreparedEnrichArticle
  summaryForArticle: Awaited<ReturnType<typeof generateEnrichedSummaries>>[number]
  embeddingResult: { embedding: number[] | null; model: string | null }
  jobRunId: number
  tagReferences: Awaited<ReturnType<typeof import('@/lib/db/tags').listActiveTagReferences>>
  tagKeywords: Awaited<ReturnType<typeof import('@/lib/db/tags').listCollectionTagKeywords>>
  items: DailyEnrichItemResult[]
  manualPendingExports: ManualPendingExportItem[]
}): Promise<void> {
  const { article, summaryForArticle } = params
  const publicationBasisIfSummaryExists =
    article.contentResult.contentPath === 'full'
      ? 'full_summary'
      : article.snippetPublishable
        ? 'source_snippet'
        : 'hold'
  const snippetConsistencyPassed = passesSnippetConsistencyGate({
    summaryInputBasis: article.summaryInput.summaryInputBasis,
    title: article.title,
    summaryInputText: article.summaryInput.summaryInputText,
    summary100: summaryForArticle.summary100,
    summary200: summaryForArticle.summary200,
  })
  const publicationBasis =
    summaryForArticle.summarySource === 'manual_pending'
      ? 'hold'
      : !snippetConsistencyPassed
        ? 'hold'
        : article.contentResult.contentPath === 'full'
          ? 'full_summary'
          : article.snippetPublishable
            ? 'source_snippet'
            : 'hold'
  const publicationText =
    publicationBasis === 'hold' ? null : summaryForArticle.summary200 || summaryForArticle.summary100
  const finalIsProvisional = publicationBasis === 'source_snippet' ? false : article.provisionalState.isProvisional
  const finalProvisionalReason =
    publicationBasis === 'source_snippet' ? null : article.provisionalState.provisionalReason
  const semanticDuplicate =
    article.dedupeStatus === 'unique'
      ? await findSemanticDuplicate(params.embeddingResult.embedding, article.rawArticle.id)
      : null
  const finalDedupeStatus = semanticDuplicate?.dedupeStatus ?? article.dedupeStatus
  const finalDedupeGroupKey = semanticDuplicate?.dedupeGroupKey ?? article.dedupeGroupKey
  const publishCandidate =
    publicationBasis !== 'hold' && finalDedupeStatus === 'unique' && article.relevance.isRelevant
  const aiProcessingState =
    summaryForArticle.summarySource === 'manual_pending' ? 'manual_pending' : 'completed'

  const paperTag = params.tagReferences.find((reference) => reference.tagKey === 'paper')
  const keywordMatchedTagIds =
    article.rawArticle.sourceType === 'paper'
      ? paperTag
        ? [paperTag.id]
        : []
      : matchTagsFromKeywords(
          params.tagKeywords,
          article.title,
          summaryForArticle.summary200 || summaryForArticle.summary100,
        )

  if (article.rawArticle.sourceType !== 'paper') {
    const sourceCategoryTag = params.tagReferences.find(
      (reference) => reference.tagKey === article.rawArticle.sourceCategory,
    )
    if (sourceCategoryTag && !keywordMatchedTagIds.includes(sourceCategoryTag.id)) {
      keywordMatchedTagIds.push(sourceCategoryTag.id)
    }
  }

  const { score, scoreReason } = scoreArticle(
    article.contentResult.contentPath,
    keywordMatchedTagIds.length,
    summaryForArticle.summarySource,
  )
  const adjustedScore = article.relevance.isRelevant ? score : Math.max(0, score - 25)
  const adjustedScoreReason = article.relevance.isRelevant ? scoreReason : `${scoreReason}; low source relevance`
  const matchedTags = params.tagReferences
    .filter((reference) => keywordMatchedTagIds.includes(reference.id))
    .map((reference) => ({
      tagKey: reference.tagKey,
      displayName: reference.displayName,
    }))
  const thumbnailUrl = buildInternalThumbnailUrl({
    canonicalUrl: article.rawArticle.citedUrl ?? article.rawArticle.normalizedUrl,
    title: article.title,
    summary100: summaryForArticle.summary100,
    summary200: summaryForArticle.summary200,
    sourceType: article.rawArticle.sourceType as 'official' | 'blog' | 'news' | 'video' | 'alerts' | 'paper',
    sourceCategory: article.rawArticle.sourceCategory as 'llm' | 'agent' | 'voice' | 'policy' | 'safety' | 'search' | 'news',
    contentLanguage: article.rawArticle.contentLanguage,
    matchedTags,
  })

  await upsertEnrichedArticle({
    rawArticleId: article.rawArticle.id,
    sourceTargetId: article.rawArticle.sourceTargetId,
    sourceCategory: article.rawArticle.sourceCategory,
    sourceType: article.rawArticle.sourceType,
    contentLanguage: article.rawArticle.contentLanguage,
    sourceKey: article.rawArticle.sourceKey,
    sourceDisplayName: article.rawArticle.sourceDisplayName,
    normalizedUrl: article.rawArticle.normalizedUrl,
    citedUrl: article.rawArticle.citedUrl,
    canonicalUrl: article.rawArticle.citedUrl ?? article.rawArticle.normalizedUrl,
    title: article.title,
    thumbnailUrl,
    summary100: summaryForArticle.summary100,
    summary200: summaryForArticle.summary200,
    summaryBasis: article.summaryBasis,
    contentPath: article.contentResult.contentPath,
    isProvisional: finalIsProvisional,
    provisionalReason: finalProvisionalReason,
    dedupeStatus: finalDedupeStatus,
    dedupeGroupKey: finalDedupeGroupKey,
    publishCandidate,
    publicationBasis,
    publicationText,
    summaryInputBasis: article.summaryInput.summaryInputBasis,
    score: adjustedScore,
    scoreReason: adjustedScoreReason,
    aiProcessingState,
    sourceUpdatedAt: article.rawArticle.sourceUpdatedAt,
    relatedSources: [
      {
        sourceTargetId: article.rawArticle.sourceTargetId,
        sourceKey: article.rawArticle.sourceKey,
        sourceDisplayName: article.rawArticle.sourceDisplayName,
        sourceCategory: article.rawArticle.sourceCategory,
        sourceType: article.rawArticle.sourceType,
        contentLanguage: article.rawArticle.contentLanguage,
        selectionStatus: finalDedupeStatus === 'unique' ? 'selected' : 'rejected',
        selectionReason: semanticDuplicate
          ? 'semantic duplicate candidate'
          : finalDedupeStatus === 'unique'
            ? 'primary article source'
            : 'dedupe group member',
        similarityScore: semanticDuplicate?.similarityScore ?? null,
      },
    ],
    summaryEmbedding: params.embeddingResult.embedding,
    embeddingModel: params.embeddingResult.model,
    matchedTagIds: keywordMatchedTagIds,
    candidateTags: article.shouldPersistCandidateTags ? article.tagResult.candidateTags : [],
    commercialUsePolicy: article.rawArticle.commercialUsePolicy,
  })

  await markRawProcessed(article.rawArticle.id)
  await recordJobRunItem({
    jobRunId: params.jobRunId,
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
      snippetConsistencyPassed,
      dedupeStatus: finalDedupeStatus,
      dedupeGroupKey: finalDedupeGroupKey,
      semanticSimilarityScore: semanticDuplicate?.similarityScore ?? null,
      relevanceMatchedKeyword: article.relevance.matchedKeyword,
      isRelevant: article.relevance.isRelevant,
      extractionStage: article.contentResult.extractionStage,
      extractedLength: article.contentResult.extractedLength,
      snippetLength: article.contentResult.snippetLength,
      extractionError: article.contentResult.extractionError ?? null,
      matchedTagCount: article.tagResult.matchedTagIds.length,
      candidateTagCount: article.shouldPersistCandidateTags ? article.tagResult.candidateTags.length : 0,
      summarySource: summaryForArticle.summarySource,
      aiProcessingState,
    },
  })

  if (aiProcessingState === 'manual_pending') {
    params.manualPendingExports.push({
      rawArticleId: article.rawArticle.id,
      sourceTargetId: article.rawArticle.sourceTargetId,
      sourceCategory: article.rawArticle.sourceCategory,
      sourceKey: article.rawArticle.sourceKey,
      normalizedUrl: article.rawArticle.normalizedUrl,
      citedUrl: article.rawArticle.citedUrl,
      canonicalUrl: article.rawArticle.citedUrl ?? article.rawArticle.normalizedUrl,
      sourceUpdatedAt: article.rawArticle.sourceUpdatedAt,
      title: article.title,
      contentPath: article.contentResult.contentPath,
      summaryBasis: article.summaryBasis,
      provisionalBase: article.provisionalState,
      dedupeStatus: finalDedupeStatus,
      dedupeGroupKey: finalDedupeGroupKey,
      isRelevant: article.relevance.isRelevant,
      matchedTagIds: keywordMatchedTagIds,
      candidateTags: article.shouldPersistCandidateTags ? article.tagResult.candidateTags : [],
      publicationBasisIfSummaryExists,
      summaryInputBasis: article.summaryInput.summaryInputBasis,
      summaryInputText: article.summaryInput.summaryInputText,
      content: article.contentResult.content,
    })
  }

  params.items.push({
    rawArticleId: article.rawArticle.id,
    status: 'processed',
    contentPath: article.contentResult.contentPath,
    isProvisional: finalIsProvisional,
    provisionalReason: finalProvisionalReason,
  })
}

async function handleEnrichError(
  article: PreparedEnrichArticle,
  jobRunId: number,
  items: DailyEnrichItemResult[],
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown enrich error'
  await markRawError(article.rawArticle.id, message)
  await recordJobRunItem({
    jobRunId,
    itemKey: String(article.rawArticle.id),
    itemStatus: 'failed',
    detail: { rawArticleId: article.rawArticle.id, title: article.rawArticle.title },
    errorMessage: message,
  })
  items.push({ rawArticleId: article.rawArticle.id, status: 'failed', error: message })
}
