import { getSql } from '@/lib/db'
import type {
  UpsertEnrichedInput,
  UpsertEnrichedOptions,
} from '@/lib/db/enrichment-types'

type ExistingEnrichedRow = {
  enriched_article_id: number
  raw_article_id: number
  source_target_id: string
  normalized_url: string
  cited_url: string | null
  canonical_url: string
  title: string
  thumbnail_url: string | null
  summary_100: string
  summary_200: string | null
  summary_basis: 'full_content' | 'feed_snippet' | 'blocked_snippet' | 'fallback_snippet'
  content_path: 'full' | 'snippet'
  is_provisional: boolean
  provisional_reason: string | null
  dedupe_status: 'unique' | 'url_duplicate' | 'source_duplicate' | 'similar_candidate'
  dedupe_group_key: string | null
  publish_candidate: boolean
  publication_basis: 'hold' | 'full_summary' | 'source_snippet'
  publication_text: string | null
  summary_input_basis: 'full_content' | 'source_snippet' | 'title_only'
  score: string | number
  score_reason: string | null
  ai_processing_state: 'completed' | 'manual_pending'
  source_updated_at: string | null
  summary_embedding: string | null
  embedding_model: string | null
  embedding_updated_at: string | null
  processed_at: string
  created_at: string
  updated_at: string
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

async function syncEnrichedTags(enrichedArticleId: number, matchedTagIds: string[]): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM articles_enriched_tags WHERE enriched_article_id = ${enrichedArticleId}`

  for (const [index, tagId] of matchedTagIds.entries()) {
    await sql`
      INSERT INTO articles_enriched_tags (enriched_article_id, tag_id, tag_source, is_primary)
      VALUES (${enrichedArticleId}, ${tagId}, 'master', ${index === 0})
    `
  }
}

async function upsertTagCandidates(
  candidateTags: Array<{ candidateKey: string; displayName: string }>,
  rawArticleId: number,
): Promise<void> {
  const sql = getSql()

  for (const candidate of candidateTags) {
    await sql`
      INSERT INTO tag_candidate_pool (candidate_key, display_name, latest_origin_raw_id, review_status)
      VALUES (${candidate.candidateKey}, ${candidate.displayName}, ${rawArticleId}, 'candidate')
      ON CONFLICT (candidate_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        latest_origin_raw_id = EXCLUDED.latest_origin_raw_id,
        seen_count = tag_candidate_pool.seen_count + 1,
        last_seen_at = now(),
        updated_at = now()
    `
  }
}

export async function refreshTagArticleCounts(): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE tags_master tm
    SET
      article_count = COALESCE(counts.article_count, 0),
      last_seen_at = CASE WHEN COALESCE(counts.article_count, 0) > 0 THEN now() ELSE tm.last_seen_at END,
      updated_at = now()
    FROM (
      SELECT aet.tag_id, COUNT(*)::integer AS article_count
      FROM articles_enriched_tags aet
      GROUP BY aet.tag_id
    ) counts
    WHERE tm.tag_id = counts.tag_id
  `

  await sql`
    UPDATE tags_master
    SET article_count = 0, updated_at = now()
    WHERE tag_id NOT IN (SELECT DISTINCT tag_id FROM articles_enriched_tags)
      AND article_count <> 0
  `
}

export async function upsertEnrichedArticle(
  input: UpsertEnrichedInput,
  options: UpsertEnrichedOptions = {},
): Promise<{ enrichedArticleId: number }> {
  const refreshTagCounts = options.refreshTagCounts ?? true
  const sql = getSql()
  const existingRows = (await sql`
    SELECT *
    FROM articles_enriched
    WHERE normalized_url = ${input.normalizedUrl}
    ORDER BY processed_at DESC, enriched_article_id DESC
    LIMIT 1
  `) as ExistingEnrichedRow[]

  const existing = existingRows[0] ?? null
  const embeddingLiteral = input.summaryEmbedding ? toVectorLiteral(input.summaryEmbedding) : null

  const sourceRows = (input.relatedSources?.length
    ? input.relatedSources
    : [
        {
          sourceTargetId: input.sourceTargetId,
          sourceKey: input.sourceKey,
          sourceDisplayName: input.sourceDisplayName,
          sourceCategory: input.sourceCategory,
          sourceType: input.sourceType,
          selectionStatus: input.dedupeStatus === 'unique' ? 'selected' : 'rejected',
          selectionReason: input.dedupeStatus === 'unique' ? 'primary article source' : 'dedupe group member',
          similarityScore: null,
        },
      ]).map((source) => ({
    enriched_article_id: existing?.enriched_article_id,
    source_target_id: source.sourceTargetId,
    source_key: source.sourceKey,
    source_display_name: source.sourceDisplayName,
    source_category: source.sourceCategory,
    source_type: source.sourceType,
    selection_status: source.selectionStatus,
    selection_reason: source.selectionReason,
    similarity_score: source.similarityScore ?? null,
  }))

  if (existing) {
    await sql`
      INSERT INTO articles_enriched_history (
        enriched_article_id, raw_article_id, source_target_id, normalized_url, cited_url, canonical_url,
        title, thumbnail_url, summary_100, summary_200, summary_basis, content_path, is_provisional,
        provisional_reason, dedupe_status, dedupe_group_key, publish_candidate, publication_basis,
        publication_text, summary_input_basis, score, score_reason, ai_processing_state, source_updated_at,
        summary_embedding, embedding_model, embedding_updated_at, processed_at, created_at, updated_at
      )
      VALUES (
        ${existing.enriched_article_id}, ${existing.raw_article_id}, ${existing.source_target_id}, ${existing.normalized_url},
        ${existing.cited_url}, ${existing.canonical_url}, ${existing.title}, ${existing.thumbnail_url}, ${existing.summary_100},
        ${existing.summary_200}, ${existing.summary_basis}, ${existing.content_path}, ${existing.is_provisional},
        ${existing.provisional_reason}, ${existing.dedupe_status}, ${existing.dedupe_group_key}, ${existing.publish_candidate},
        ${existing.publication_basis}, ${existing.publication_text}, ${existing.summary_input_basis}, ${existing.score},
        ${existing.score_reason}, ${existing.ai_processing_state}, ${existing.source_updated_at},
        ${existing.summary_embedding ?? null}::vector, ${existing.embedding_model ?? null}, ${existing.embedding_updated_at ?? null},
        ${existing.processed_at}, ${existing.created_at}, ${existing.updated_at}
      )
    `

    await sql`
      UPDATE articles_enriched
      SET
        raw_article_id = ${input.rawArticleId},
        source_target_id = ${input.sourceTargetId},
        source_category = ${input.sourceCategory},
        source_type = ${input.sourceType},
        cited_url = ${input.citedUrl},
        canonical_url = ${input.canonicalUrl},
        title = ${input.title},
        summary_100 = ${input.summary100},
        summary_200 = ${input.summary200},
        summary_basis = ${input.summaryBasis},
        content_path = ${input.contentPath},
        is_provisional = ${input.isProvisional},
        provisional_reason = ${input.provisionalReason},
        dedupe_status = ${input.dedupeStatus},
        dedupe_group_key = ${input.dedupeGroupKey},
        publish_candidate = ${input.publishCandidate},
        publication_basis = ${input.publicationBasis},
        publication_text = ${input.publicationText},
        summary_input_basis = ${input.summaryInputBasis},
        score = ${input.score},
        score_reason = ${input.scoreReason},
        ai_processing_state = ${input.aiProcessingState ?? 'completed'},
        commercial_use_policy = ${input.commercialUsePolicy},
        source_updated_at = ${input.sourceUpdatedAt},
        summary_embedding = ${embeddingLiteral}::vector,
        embedding_model = ${input.embeddingModel ?? null},
        embedding_updated_at = CASE WHEN ${embeddingLiteral !== null} THEN now() ELSE embedding_updated_at END,
        processed_at = now(),
        updated_at = now()
      WHERE enriched_article_id = ${existing.enriched_article_id}
    `

    await sql`DELETE FROM articles_enriched_sources WHERE enriched_article_id = ${existing.enriched_article_id}`
    if (sourceRows.length > 0) {
      await sql`
        INSERT INTO articles_enriched_sources ${// eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sql as any)(
          sourceRows.map((row) => ({ ...row, enriched_article_id: existing.enriched_article_id })),
          'enriched_article_id',
          'source_target_id',
          'source_key',
          'source_display_name',
          'source_category',
          'source_type',
          'selection_status',
          'selection_reason',
          'similarity_score',
        )}
        ON CONFLICT (enriched_article_id, source_key, selection_status) DO UPDATE SET
          source_target_id = EXCLUDED.source_target_id,
          source_display_name = EXCLUDED.source_display_name,
          source_category = EXCLUDED.source_category,
          source_type = EXCLUDED.source_type,
          selection_reason = EXCLUDED.selection_reason,
          similarity_score = EXCLUDED.similarity_score,
          updated_at = now()
      `
    }

    await syncEnrichedTags(existing.enriched_article_id, input.matchedTagIds)
    await upsertTagCandidates(input.candidateTags, input.rawArticleId)
    if (refreshTagCounts) await refreshTagArticleCounts()
    return { enrichedArticleId: existing.enriched_article_id }
  }

  const inserted = (await sql`
    INSERT INTO articles_enriched (
      raw_article_id, source_target_id, source_category, source_type, normalized_url, cited_url,
      canonical_url, title, summary_100, summary_200, summary_basis, content_path, is_provisional,
      provisional_reason, dedupe_status, dedupe_group_key, publish_candidate, publication_basis,
      publication_text, summary_input_basis, score, score_reason, ai_processing_state, source_updated_at,
      summary_embedding, embedding_model, embedding_updated_at, commercial_use_policy
    )
    VALUES (
      ${input.rawArticleId}, ${input.sourceTargetId}, ${input.sourceCategory}, ${input.sourceType},
      ${input.normalizedUrl}, ${input.citedUrl}, ${input.canonicalUrl}, ${input.title}, ${input.summary100},
      ${input.summary200}, ${input.summaryBasis}, ${input.contentPath}, ${input.isProvisional},
      ${input.provisionalReason}, ${input.dedupeStatus}, ${input.dedupeGroupKey}, ${input.publishCandidate},
      ${input.publicationBasis}, ${input.publicationText}, ${input.summaryInputBasis}, ${input.score},
      ${input.scoreReason}, ${input.aiProcessingState ?? 'completed'}, ${input.sourceUpdatedAt},
      ${embeddingLiteral}::vector, ${input.embeddingModel ?? null},
      CASE WHEN ${embeddingLiteral !== null} THEN now() ELSE null END,
      ${input.commercialUsePolicy}
    )
    RETURNING enriched_article_id
  `) as Array<{ enriched_article_id: number }>

  const enrichedArticleId = inserted[0].enriched_article_id
  if (sourceRows.length > 0) {
    await sql`
      INSERT INTO articles_enriched_sources ${// eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sql as any)(
        sourceRows.map((row) => ({ ...row, enriched_article_id: enrichedArticleId })),
        'enriched_article_id',
        'source_target_id',
        'source_key',
        'source_display_name',
        'source_category',
        'source_type',
        'selection_status',
        'selection_reason',
        'similarity_score',
      )}
      ON CONFLICT (enriched_article_id, source_key, selection_status) DO UPDATE SET
        source_target_id = EXCLUDED.source_target_id,
        source_display_name = EXCLUDED.source_display_name,
        source_category = EXCLUDED.source_category,
        source_type = EXCLUDED.source_type,
        selection_reason = EXCLUDED.selection_reason,
        similarity_score = EXCLUDED.similarity_score,
        updated_at = now()
    `
  }

  await syncEnrichedTags(enrichedArticleId, input.matchedTagIds)
  await upsertTagCandidates(input.candidateTags, input.rawArticleId)
  if (refreshTagCounts) await refreshTagArticleCounts()

  return { enrichedArticleId }
}
