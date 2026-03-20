export interface RawArticleForEnrichment {
  id: number
  sourceTargetId: string
  sourceKey: string
  sourceDisplayName: string
  sourceCategory: string
  sourceType: string
  contentAccessPolicy: 'feed_only' | 'fulltext_allowed' | 'blocked_snippet_only'
  observedDomain: string | null
  observedDomainFetchPolicy: 'needs_review' | 'fulltext_allowed' | 'snippet_only' | 'blocked' | null
  normalizedUrl: string
  citedUrl: string | null
  title: string | null
  snippet: string | null
  sourceUrl: string
  sourceUpdatedAt: string | null
  hasSourceUpdate: boolean
  commercialUsePolicy: 'permitted' | 'prohibited' | 'unknown'
}

export type DedupeStatus = 'unique' | 'url_duplicate' | 'source_duplicate' | 'similar_candidate'

export interface DuplicateMatch {
  dedupeStatus: DedupeStatus
  dedupeGroupKey: string | null
  similarityScore?: number
}

export interface UpsertEnrichedInput {
  rawArticleId: number
  sourceTargetId: string
  sourceCategory: string
  sourceType: string
  normalizedUrl: string
  citedUrl: string | null
  canonicalUrl: string
  title: string
  summary100: string
  summary200: string
  summaryBasis: 'full_content' | 'feed_snippet' | 'blocked_snippet' | 'fallback_snippet'
  contentPath: 'full' | 'snippet'
  isProvisional: boolean
  provisionalReason:
    | 'snippet_only'
    | 'domain_snippet_only'
    | 'fetch_error'
    | 'extracted_below_threshold'
    | 'feed_only_policy'
    | 'domain_needs_review'
    | null
  dedupeStatus: DedupeStatus
  dedupeGroupKey: string | null
  publishCandidate: boolean
  publicationBasis: 'hold' | 'full_summary' | 'source_snippet'
  publicationText: string | null
  summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
  score: number
  scoreReason: string
  aiProcessingState?: 'completed' | 'manual_pending'
  sourceUpdatedAt: string | null
  sourceKey: string
  sourceDisplayName: string
  relatedSources?: Array<{
    sourceTargetId: string | null
    sourceKey: string
    sourceDisplayName: string
    sourceCategory: string | null
    sourceType: string | null
    selectionStatus: 'selected' | 'supporting' | 'rejected'
    selectionReason: string | null
    similarityScore?: number | null
  }>
  summaryEmbedding?: number[] | null
  embeddingModel?: string | null
  matchedTagIds: string[]
  candidateTags: Array<{ candidateKey: string; displayName: string }>
  commercialUsePolicy: 'permitted' | 'prohibited' | 'unknown'
}

export interface UpsertEnrichedOptions {
  refreshTagCounts?: boolean
}
