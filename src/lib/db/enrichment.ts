import { getSql } from '@/lib/db'
import { buildHeadlineSignature } from '@/lib/text/normalize'

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

type RawArticleRow = {
  raw_article_id: number
  source_target_id: string
  source_key: string
  display_name: string
  source_category: string
  source_type: string
  content_access_policy: 'feed_only' | 'fulltext_allowed' | 'blocked_snippet_only'
  observed_domain: string | null
  observed_domain_fetch_policy: 'needs_review' | 'fulltext_allowed' | 'snippet_only' | 'blocked' | null
  normalized_url: string
  cited_url: string | null
  title: string | null
  snippet: string | null
  source_url: string
  source_updated_at: string | null
  has_source_update: boolean
  source_commercial_use_policy: 'permitted' | 'prohibited' | 'unknown'
  domain_commercial_use_policy: 'permitted' | 'prohibited' | 'unknown' | null
}

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

type UpsertEnrichedResult = {
  enrichedArticleId: number
}

interface UpsertEnrichedOptions {
  refreshTagCounts?: boolean
}

export async function listRawArticlesForEnrichment(
  limit = 50,
  sourceKey?: string | null,
): Promise<RawArticleForEnrichment[]> {
  const sql = getSql()
  const rows = (sourceKey
    ? await sql`
        SELECT
          ar.raw_article_id,
          ar.source_target_id,
          st.source_key,
          st.display_name,
          st.source_category,
          st.source_type,
          st.content_access_policy,
          COALESCE(st.commercial_use_policy, 'permitted') AS source_commercial_use_policy,
          od.commercial_use_policy AS domain_commercial_use_policy,
          lower(regexp_replace(split_part(split_part(coalesce(ar.cited_url, ar.source_url, ar.normalized_url), '://', 2), '/', 1), '^www\\.', '')) AS observed_domain,
          od.fetch_policy AS observed_domain_fetch_policy,
          ar.normalized_url,
          ar.cited_url,
          ar.title,
          ar.snippet,
          ar.source_url,
          ar.source_updated_at,
          ar.has_source_update
        FROM articles_raw ar
        JOIN source_targets st ON st.source_target_id = ar.source_target_id
        LEFT JOIN observed_article_domains od
          ON od.domain = lower(regexp_replace(split_part(split_part(coalesce(ar.cited_url, ar.source_url, ar.normalized_url), '://', 2), '/', 1), '^www\\.', ''))
        WHERE ar.is_processed = false
          AND ar.process_after <= now()
          AND st.source_key = ${sourceKey}
        ORDER BY ar.created_at ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT
          ar.raw_article_id,
          ar.source_target_id,
          st.source_key,
          st.display_name,
          st.source_category,
          st.source_type,
          st.content_access_policy,
          COALESCE(st.commercial_use_policy, 'permitted') AS source_commercial_use_policy,
          od.commercial_use_policy AS domain_commercial_use_policy,
          lower(regexp_replace(split_part(split_part(coalesce(ar.cited_url, ar.source_url, ar.normalized_url), '://', 2), '/', 1), '^www\\.', '')) AS observed_domain,
          od.fetch_policy AS observed_domain_fetch_policy,
          ar.normalized_url,
          ar.cited_url,
          ar.title,
          ar.snippet,
          ar.source_url,
          ar.source_updated_at,
          ar.has_source_update
        FROM articles_raw ar
        JOIN source_targets st ON st.source_target_id = ar.source_target_id
        LEFT JOIN observed_article_domains od
          ON od.domain = lower(regexp_replace(split_part(split_part(coalesce(ar.cited_url, ar.source_url, ar.normalized_url), '://', 2), '/', 1), '^www\\.', ''))
        WHERE ar.is_processed = false
          AND ar.process_after <= now()
        ORDER BY ar.created_at ASC
        LIMIT ${limit}
      `) as RawArticleRow[]

  return rows.map((row) => ({
    id: row.raw_article_id,
    sourceTargetId: row.source_target_id,
    sourceKey: row.source_key,
    sourceDisplayName: row.display_name,
    sourceCategory: row.source_category,
    sourceType: row.source_type,
    contentAccessPolicy: row.content_access_policy,
    observedDomain: row.observed_domain,
    observedDomainFetchPolicy: row.observed_domain_fetch_policy,
    normalizedUrl: row.normalized_url,
    citedUrl: row.cited_url,
    title: row.title,
    snippet: row.snippet,
    sourceUrl: row.source_url,
    sourceUpdatedAt: row.source_updated_at,
    hasSourceUpdate: row.has_source_update,
    commercialUsePolicy: (
      row.source_commercial_use_policy === 'prohibited' ||
      row.domain_commercial_use_policy === 'prohibited'
    ) ? 'prohibited' : row.source_commercial_use_policy,
  }))
}

export async function findDuplicateMatch(
  normalizedUrl: string,
  citedUrl: string | null,
  title: string,
  currentRawArticleId: number,
): Promise<DuplicateMatch | null> {
  const sql = getSql()
  const baseQuery = citedUrl
    ? sql`
        SELECT
          enriched_article_id,
          normalized_url,
          cited_url,
          dedupe_group_key
        FROM articles_enriched
        WHERE raw_article_id <> ${currentRawArticleId}
          AND (
            normalized_url = ${normalizedUrl}
            OR cited_url = ${citedUrl}
          )
        ORDER BY processed_at DESC, enriched_article_id DESC
        LIMIT 1
      `
    : sql`
        SELECT
          enriched_article_id,
          normalized_url,
          cited_url,
          dedupe_group_key
        FROM articles_enriched
        WHERE raw_article_id <> ${currentRawArticleId}
          AND normalized_url = ${normalizedUrl}
        ORDER BY processed_at DESC, enriched_article_id DESC
        LIMIT 1
      `

  const rows = (await baseQuery) as Array<{
    enriched_article_id: number
    normalized_url: string
    cited_url: string | null
    dedupe_group_key: string | null
  }>

  const row = rows[0]
  if (!row) {
    return null
  }

  if (row.normalized_url === normalizedUrl) {
    return {
      dedupeStatus: 'url_duplicate',
      dedupeGroupKey: row.dedupe_group_key ?? normalizedUrl,
    }
  }

  return {
    dedupeStatus: 'source_duplicate',
    dedupeGroupKey: row.dedupe_group_key ?? citedUrl ?? normalizedUrl,
  }
}

export async function findSimilarTitleDuplicate(
  title: string,
  currentRawArticleId: number,
): Promise<DuplicateMatch | null> {
  const signature = buildHeadlineSignature(title)
  if (signature.length < 12) {
    return null
  }

  const sql = getSql()
  const rows = (await sql`
    SELECT
      enriched_article_id,
      title,
      dedupe_group_key
    FROM articles_enriched
    WHERE raw_article_id <> ${currentRawArticleId}
    ORDER BY processed_at DESC, enriched_article_id DESC
    LIMIT 200
  `) as Array<{
    enriched_article_id: number
    title: string
    dedupe_group_key: string | null
  }>

  const matched = rows.find((row) => buildHeadlineSignature(row.title) === signature)
  if (!matched) {
    return null
  }

  return {
    dedupeStatus: 'similar_candidate',
    dedupeGroupKey: matched.dedupe_group_key ?? `title:${signature}`,
  }
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export async function findSemanticDuplicate(
  embedding: number[] | null | undefined,
  currentRawArticleId: number,
  threshold = 0.92,
): Promise<DuplicateMatch | null> {
  if (!embedding || embedding.length === 0) {
    return null
  }

  const sql = getSql()
  const vectorLiteral = toVectorLiteral(embedding)
  const rows = (await sql`
    SELECT
      enriched_article_id,
      dedupe_group_key,
      1 - (summary_embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM articles_enriched
    WHERE raw_article_id <> ${currentRawArticleId}
      AND summary_embedding IS NOT NULL
    ORDER BY summary_embedding <=> ${vectorLiteral}::vector ASC
    LIMIT 1
  `) as Array<{
    enriched_article_id: number
    dedupe_group_key: string | null
    similarity: string | number
  }>

  const row = rows[0]
  if (!row) {
    return null
  }

  const similarity = Number(row.similarity ?? 0)
  if (!Number.isFinite(similarity) || similarity < threshold) {
    return null
  }

  return {
    dedupeStatus: 'similar_candidate',
    dedupeGroupKey: row.dedupe_group_key ?? `semantic:${row.enriched_article_id}`,
    similarityScore: similarity,
  }
}

export async function upsertEnrichedArticle(
  input: UpsertEnrichedInput,
  options: UpsertEnrichedOptions = {},
): Promise<UpsertEnrichedResult> {
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

  const sourceRows = (input.relatedSources?.length ? input.relatedSources : [
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
        enriched_article_id,
        raw_article_id,
        source_target_id,
        normalized_url,
        cited_url,
        canonical_url,
        title,
        thumbnail_url,
        summary_100,
        summary_200,
        summary_basis,
        content_path,
        is_provisional,
        provisional_reason,
        dedupe_status,
        dedupe_group_key,
        publish_candidate,
        publication_basis,
        publication_text,
        summary_input_basis,
        score,
        score_reason,
        ai_processing_state,
        source_updated_at,
        summary_embedding,
        embedding_model,
        embedding_updated_at,
        processed_at,
        created_at,
        updated_at
      )
      VALUES (
        ${existing.enriched_article_id},
        ${existing.raw_article_id},
        ${existing.source_target_id},
        ${existing.normalized_url},
        ${existing.cited_url},
        ${existing.canonical_url},
        ${existing.title},
        ${existing.thumbnail_url},
        ${existing.summary_100},
        ${existing.summary_200},
        ${existing.summary_basis},
        ${existing.content_path},
        ${existing.is_provisional},
        ${existing.provisional_reason},
        ${existing.dedupe_status},
        ${existing.dedupe_group_key},
        ${existing.publish_candidate},
        ${existing.publication_basis},
        ${existing.publication_text},
        ${existing.summary_input_basis},
        ${existing.score},
        ${existing.score_reason},
        ${existing.ai_processing_state},
        ${existing.source_updated_at},
        ${existing.summary_embedding ?? null}::vector,
        ${existing.embedding_model ?? null},
        ${existing.embedding_updated_at ?? null},
        ${existing.processed_at},
        ${existing.created_at},
        ${existing.updated_at}
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
        embedding_updated_at = CASE
          WHEN ${embeddingLiteral !== null} THEN now()
          ELSE embedding_updated_at
        END,
        processed_at = now(),
        updated_at = now()
      WHERE enriched_article_id = ${existing.enriched_article_id}
    `

    await sql`DELETE FROM articles_enriched_sources WHERE enriched_article_id = ${existing.enriched_article_id}`
    if (sourceRows.length > 0) {
      await sql`
        INSERT INTO articles_enriched_sources ${(sql as any)(
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
    if (refreshTagCounts) {
      await refreshTagArticleCounts()
    }

    return { enrichedArticleId: existing.enriched_article_id }
  }

  const inserted = (await sql`
    INSERT INTO articles_enriched (
      raw_article_id,
      source_target_id,
      source_category,
      source_type,
      normalized_url,
      cited_url,
      canonical_url,
      title,
      summary_100,
      summary_200,
      summary_basis,
      content_path,
      is_provisional,
      provisional_reason,
      dedupe_status,
      dedupe_group_key,
      publish_candidate,
      publication_basis,
      publication_text,
      summary_input_basis,
      score,
      score_reason,
      ai_processing_state,
      source_updated_at,
      summary_embedding,
      embedding_model,
      embedding_updated_at,
      commercial_use_policy
    )
    VALUES (
      ${input.rawArticleId},
      ${input.sourceTargetId},
      ${input.sourceCategory},
      ${input.sourceType},
      ${input.normalizedUrl},
      ${input.citedUrl},
      ${input.canonicalUrl},
      ${input.title},
      ${input.summary100},
      ${input.summary200},
      ${input.summaryBasis},
      ${input.contentPath},
      ${input.isProvisional},
      ${input.provisionalReason},
      ${input.dedupeStatus},
      ${input.dedupeGroupKey},
      ${input.publishCandidate},
      ${input.publicationBasis},
      ${input.publicationText},
      ${input.summaryInputBasis},
      ${input.score},
      ${input.scoreReason},
      ${input.aiProcessingState ?? 'completed'},
      ${input.sourceUpdatedAt},
      ${embeddingLiteral}::vector,
      ${input.embeddingModel ?? null},
      CASE WHEN ${embeddingLiteral !== null} THEN now() ELSE null END,
      ${input.commercialUsePolicy}
    )
    RETURNING enriched_article_id
  `) as Array<{ enriched_article_id: number }>

  const enrichedArticleId = inserted[0].enriched_article_id
  if (sourceRows.length > 0) {
    await sql`
      INSERT INTO articles_enriched_sources ${(sql as any)(
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
  if (refreshTagCounts) {
    await refreshTagArticleCounts()
  }

  return { enrichedArticleId }
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
      INSERT INTO tag_candidate_pool (
        candidate_key,
        display_name,
        latest_origin_raw_id,
        review_status
      )
      VALUES (
        ${candidate.candidateKey},
        ${candidate.displayName},
        ${rawArticleId},
        'candidate'
      )
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
      last_seen_at = CASE
        WHEN COALESCE(counts.article_count, 0) > 0 THEN now()
        ELSE tm.last_seen_at
      END,
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
    SET article_count = 0,
        updated_at = now()
    WHERE tag_id NOT IN (
      SELECT DISTINCT tag_id
      FROM articles_enriched_tags
    )
      AND article_count <> 0
  `
}

export async function markRawProcessed(rawArticleId: number): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE articles_raw
    SET
      is_processed = true,
      has_source_update = false,
      process_after = now(),
      last_error = null,
      updated_at = now()
    WHERE raw_article_id = ${rawArticleId}
  `
}

export async function markRawError(rawArticleId: number, errorMessage: string): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE articles_raw
    SET
      last_error = ${errorMessage},
      process_after = now() + interval '1 hour',
      updated_at = now()
    WHERE raw_article_id = ${rawArticleId}
  `
}
