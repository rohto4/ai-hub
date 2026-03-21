export type {
  DedupeStatus,
  DuplicateMatch,
  RawArticleForEnrichment,
  UpsertEnrichedInput,
  UpsertEnrichedOptions,
} from '@/lib/db/enrichment-types'

export {
  claimRawArticlesForEnrichment,
  listRawArticlesForEnrichment,
  markRawError,
  markRawProcessed,
} from '@/lib/db/enrichment-raw'

export {
  findDuplicateMatch,
  findSemanticDuplicate,
  findSimilarTitleDuplicate,
} from '@/lib/db/enrichment-dedupe'

export {
  refreshTagArticleCounts,
  upsertEnrichedArticle,
} from '@/lib/db/enrichment-upsert'
