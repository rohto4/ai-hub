import { getSql } from '@/lib/db'

export interface HourlyPublishResult {
  upserted: number
  hidden: number
  tagsUpdated: number
  failed: number
}

export const BULK_CHUNK_SIZE = 200
export const FALLBACK_BATCH_SIZE = 10

export type SqlClient = ReturnType<typeof getSql>

export type PublishCandidate = {
  enriched_article_id: number
  source_target_id: string
  source_key: string
  source_display_name: string
  canonical_url: string
  title: string
  summary_100: string
  summary_200: string | null
  publication_text: string | null
  source_category: string
  source_type: string
  content_language: 'ja' | 'en' | null
  dedupe_group_key: string | null
  summary_input_basis: string
  publication_basis: string
  score: string | number
  source_updated_at: string | null
  thumbnail_url: string | null
  thumbnail_bg_theme: string | null
  priority_score: string | number | null
}

export type TagRow = {
  enriched_article_id: number
  tag_id: string
  is_primary: boolean
}

export type AdjacentTagRow = {
  enriched_article_id: number
  adjacent_tag_id: string
  sort_order: number
}

export type UpsertedRow = {
  public_article_id: string
  canonical_url: string
}

export type RelatedSourceRow = {
  representative_enriched_article_id: number
  source_enriched_article_id: number
  source_target_id: string | null
  source_key: string | null
  source_display_name: string | null
  source_priority: string | number | null
  is_primary: boolean
  selection_status: 'selected' | 'supporting' | 'rejected'
}

export function toChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
