import fs from 'node:fs'
import path from 'node:path'
import type { DedupeStatus, RawArticleForEnrichment } from '@/lib/db/enrichment'
import type { ExtractedContentResult } from '@/lib/extractors/content'
import { assessSourceTargetRelevance } from '@/lib/relevance/source-target'
import { matchTags } from '@/lib/tags/match'

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
  skippedExpired: number
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

export interface PreparedEnrichArticle {
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

export type ManualPendingExportItem = {
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

export const SUMMARY_FALLBACK_BATCH_SIZE = 3

export function determineProvisionalState(
  contentPath: 'full' | 'snippet',
  extractionStage:
    | 'extracted'
    | 'extracted_below_threshold'
    | 'fetch_error'
    | 'domain_snippet_only'
    | 'feed_only_policy'
    | 'domain_needs_review',
) {
  if (contentPath === 'full') {
    return { isProvisional: false, provisionalReason: null }
  }

  if (extractionStage === 'domain_snippet_only') {
    return { isProvisional: true, provisionalReason: 'domain_snippet_only' as const }
  }
  if (extractionStage === 'fetch_error') {
    return { isProvisional: true, provisionalReason: 'fetch_error' as const }
  }
  if (extractionStage === 'feed_only_policy') {
    return { isProvisional: true, provisionalReason: 'feed_only_policy' as const }
  }
  if (extractionStage === 'domain_needs_review') {
    return { isProvisional: true, provisionalReason: 'domain_needs_review' as const }
  }
  if (extractionStage === 'extracted_below_threshold') {
    return { isProvisional: true, provisionalReason: 'extracted_below_threshold' as const }
  }

  return { isProvisional: true, provisionalReason: 'snippet_only' as const }
}

export function determineSummaryBasis(
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
  if (contentPath === 'full') return 'full_content'
  if (provisionalReason === 'feed_only_policy') return 'feed_snippet'
  if (provisionalReason === 'domain_snippet_only') return 'blocked_snippet'
  return 'fallback_snippet'
}

export function determineSummaryInput(
  contentPath: 'full' | 'snippet',
  extractedContent: string,
  normalizedSnippet: string,
  title: string,
) {
  if (contentPath === 'full' && extractedContent.trim().length > 0) {
    return { summaryInputBasis: 'full_content' as const, summaryInputText: extractedContent }
  }
  if (normalizedSnippet.trim().length >= 80) {
    return { summaryInputBasis: 'source_snippet' as const, summaryInputText: normalizedSnippet }
  }
  return { summaryInputBasis: 'title_only' as const, summaryInputText: title }
}

export function isSnippetPublicationEligible(
  summaryBasis: 'full_content' | 'feed_snippet' | 'blocked_snippet' | 'fallback_snippet',
  contentPath: 'full' | 'snippet',
  snippet: string,
  dedupeStatus: DedupeStatus,
  isRelevant: boolean,
): boolean {
  if (contentPath !== 'snippet') return false
  if (!isRelevant || dedupeStatus !== 'unique') return false
  if (!['feed_snippet', 'blocked_snippet'].includes(summaryBasis)) return false

  const normalized = snippet.trim()
  if (normalized.length < 80) return false
  if (/^(\.\.\.|窶ｦ)/.test(normalized)) return false

  const tokenCount = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .length

  return tokenCount >= 12
}

export function chunkItems<T>(items: T[], size: number): T[][] {
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

export function passesSnippetConsistencyGate(input: {
  summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
  title: string
  summaryInputText: string
  summary100: string
  summary200: string
}): boolean {
  if (input.summaryInputBasis !== 'source_snippet') return true

  const sourceTokens = Array.from(new Set(normalizeAsciiTokens(`${input.title} ${input.summaryInputText}`)))
  if (sourceTokens.length === 0) return true

  const summaryText = `${input.summary100} ${input.summary200}`.toLowerCase()
  return sourceTokens.some((token) => summaryText.includes(token))
}

export function writeManualPendingExport(
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
    JSON.stringify({ generatedAt: new Date().toISOString(), sourceKey, totalExported: items.length, items }, null, 2),
    'utf8',
  )

  return outputPath
}

export function scoreArticle(
  contentPath: 'full' | 'snippet',
  matchedTagCount: number,
  summarySource: 'gemini' | 'gemini2' | 'openai' | 'manual_pending',
) {
  const base = contentPath === 'full' ? 70 : 45
  const summaryBonus = summarySource === 'manual_pending' ? 0 : 6
  const score = Math.min(100, base + matchedTagCount * 8 + summaryBonus)
  const scoreReason =
    contentPath === 'full'
      ? `full extraction, ${matchedTagCount} matched tags, ${summarySource} summary`
      : `snippet fallback, ${matchedTagCount} matched tags, ${summarySource} summary`

  return { score, scoreReason }
}
