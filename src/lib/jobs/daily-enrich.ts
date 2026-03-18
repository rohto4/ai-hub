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
import { listActiveTagReferences, listCollectionTagKeywords } from '@/lib/db/tags'
import { type ExtractedContentResult, resolveArticleContent } from '@/lib/extractors/content'
import { assessSourceTargetRelevance } from '@/lib/relevance/source-target'
import { matchTags, matchTagsFromKeywords } from '@/lib/tags/match'
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
  maxSummaryBatches?: number
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
  sourceCategory: string
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

// summaryBatchSize の AI 呼び出しが失敗したとき試す中間バッチサイズ
const SUMMARY_FALLBACK_BATCH_SIZE = 3

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function normalizeAsciiTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function passesSnippetConsistencyGate(input: {
  summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
  title: string
  summaryInputText: string
  summary100: string
  summary200: string
}): boolean {
  if (input.summaryInputBasis !== 'source_snippet') {
    return true
  }

  const sourceTokens = Array.from(
    new Set(normalizeAsciiTokens(`${input.title} ${input.summaryInputText}`)),
  )
  if (sourceTokens.length === 0) {
    return true
  }

  const summaryText = `${input.summary100} ${input.summary200}`.toLowerCase()
  return sourceTokens.some((token) => summaryText.includes(token))
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
  const maxSummaryBatches =
    typeof options === 'number'
      ? Number.POSITIVE_INFINITY
      : Math.max(1, options.maxSummaryBatches ?? Number.POSITIVE_INFINITY)
  const jobRunId = await startJobRun({
    jobName: 'daily-enrich',
    metadata: { limit, sourceKey, summaryBatchSize, maxSummaryBatches },
  })
  const rawArticles = await listRawArticlesForEnrichment(limit, sourceKey)
  const tagReferences = await listActiveTagReferences()
  const tagKeywords = await listCollectionTagKeywords()
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
      // candidateTags 抽出のみに使用。matchedTagIds は summary 生成後に tag_keywords で確定する。
      const tagResult = matchTags(
        tagReferences,
        title,
        contentResult.content || normalizedSnippet,
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

  const summaryBatches = chunkItems(preparedArticles, summaryBatchSize).slice(0, maxSummaryBatches)

  // AI 呼び出し引数を組み立てるヘルパー
  function toSummaryInput(article: PreparedEnrichArticle) {
    return {
      id: String(article.rawArticle.id),
      title: article.title,
      content: article.summaryInput.summaryInputText,
      summaryInputBasis: article.summaryInput.summaryInputBasis,
    }
  }

  // 1件分の永続化（AI サマリー取得後の処理）。失敗時は throw する。
  async function persistEnrichedArticle(
    article: PreparedEnrichArticle,
    summaryForArticle: Awaited<ReturnType<typeof generateEnrichedSummaries>>[number],
  ): Promise<void> {
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
      publicationBasis === 'hold'
        ? null
        : summaryForArticle.summary200 || summaryForArticle.summary100
    const finalIsProvisional =
      publicationBasis === 'source_snippet' ? false : article.provisionalState.isProvisional
    const finalProvisionalReason =
      publicationBasis === 'source_snippet' ? null : article.provisionalState.provisionalReason
    const publishCandidate =
      publicationBasis !== 'hold' &&
      article.dedupeStatus === 'unique' &&
      article.relevance.isRelevant
    const aiProcessingState =
      summaryForArticle.summarySource === 'manual_pending' ? 'manual_pending' : 'completed'

    // summary_200 + title を使って tag_keywords でマッチング（準備フェーズより高精度）
    const paperTag = tagReferences.find((ref) => ref.tagKey === 'paper')
    const keywordMatchedTagIds =
      article.rawArticle.sourceType === 'paper'
        ? paperTag
          ? [paperTag.id]
          : []
        : matchTagsFromKeywords(
            tagKeywords,
            article.title,
            summaryForArticle.summary200 || summaryForArticle.summary100,
          )
    // source_category を Tier 1 タグとして自動付与。ただし paper は paper タグだけに限定する。
    if (article.rawArticle.sourceType !== 'paper') {
      const sourceCategoryTag = tagReferences.find(
        (ref) => ref.tagKey === article.rawArticle.sourceCategory,
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
    const adjustedScoreReason = article.relevance.isRelevant
      ? scoreReason
      : `${scoreReason}; low source relevance`

    await upsertEnrichedArticle({
      rawArticleId: article.rawArticle.id,
      sourceTargetId: article.rawArticle.sourceTargetId,
      sourceCategory: article.rawArticle.sourceCategory,
      sourceType: article.rawArticle.sourceType,
      normalizedUrl: article.rawArticle.normalizedUrl,
      citedUrl: article.rawArticle.citedUrl,
      canonicalUrl: article.rawArticle.citedUrl ?? article.rawArticle.normalizedUrl,
      title: article.title,
      summary100: summaryForArticle.summary100,
      summary200: summaryForArticle.summary200,
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
      matchedTagIds: keywordMatchedTagIds,
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
        snippetConsistencyPassed,
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
        summarySource: summaryForArticle.summarySource,
        aiProcessingState,
      },
    })
    if (aiProcessingState === 'manual_pending') {
      manualPendingExports.push({
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
        dedupeStatus: article.dedupeStatus,
        dedupeGroupKey: article.dedupeGroupKey,
        isRelevant: article.relevance.isRelevant,
        matchedTagIds: keywordMatchedTagIds,
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
  }

  // AI 呼び出し失敗時の共通エラー記録
  async function handleEnrichError(article: PreparedEnrichArticle, error: unknown): Promise<void> {
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

  // ── AI サマリー生成 + 永続化: 3段階フォールバック ────────────────────
  //   Tier-1: summaryBatchSize 件まとめて AI 呼び出し（通常ケース）
  //     ↓ 失敗
  //   Tier-2: SUMMARY_FALLBACK_BATCH_SIZE(=3) 件ずつ → 原因の束を3件以内に絞る
  //     ↓ チャンク失敗
  //   Tier-3: 1件ずつ AI 呼び出し → 壊れた記事を特定・隔離
  //
  // generateEnrichedSummaries が throw した場合のみ上位 tier へ。
  // persistEnrichedArticle が throw しても当該記事のみ失敗扱い（次の記事は継続）。
  for (const batch of summaryBatches) {
    // Helper: batchSizeHint は generateEnrichedSummaries 内部での分割単位
    async function runAiBatch(
      subBatch: PreparedEnrichArticle[],
      batchSizeHint: number,
    ): Promise<void> {
      const summaries = await generateEnrichedSummaries(
        subBatch.map(toSummaryInput),
        batchSizeHint,
      )
      for (const [idx, article] of subBatch.entries()) {
        try {
          await persistEnrichedArticle(article, summaries[idx])
        } catch (error) {
          await handleEnrichError(article, error)
        }
      }
    }

    try {
      // Tier-1
      await runAiBatch(batch, summaryBatchSize)
    } catch (tier1Error) {
      console.warn(
        `[daily-enrich] Tier-1 AI batch failed (${batch.length} articles, raw_ids: ${batch.map(a => a.rawArticle.id).join(',')}). Switching to sub-batches of ${SUMMARY_FALLBACK_BATCH_SIZE}:`,
        tier1Error instanceof Error ? tier1Error.message : tier1Error,
      )

      for (const subBatch of chunkItems(batch, SUMMARY_FALLBACK_BATCH_SIZE)) {
        try {
          // Tier-2
          await runAiBatch(subBatch, subBatch.length)
        } catch (tier2Error) {
          console.warn(
            `[daily-enrich] Tier-2 sub-batch failed (${subBatch.length} articles, raw_ids: ${subBatch.map(a => a.rawArticle.id).join(',')}). Falling back to per-article:`,
            tier2Error instanceof Error ? tier2Error.message : tier2Error,
          )

          for (const article of subBatch) {
            try {
              // Tier-3: 1件ずつ
              await runAiBatch([article], 1)
            } catch (error) {
              await handleEnrichError(article, error)
            }
          }
        }
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
      maxSummaryBatches:
        Number.isFinite(maxSummaryBatches) ? maxSummaryBatches : 'unbounded',
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
