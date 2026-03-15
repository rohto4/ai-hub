import { getSql } from '@/lib/db'
import { buildHeadlineSignature } from '@/lib/text/normalize'

export interface RawArticleForEnrichment {
  id: number
  sourceTargetId: string
  sourceKey: string
  sourceCategory: string
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
}

type RawArticleRow = {
  id: number
  source_target_id: string
  source_key: string
  source_category: string
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
}

type ExistingEnrichedRow = {
  id: number
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
  score: string | number
  score_reason: string | null
  source_updated_at: string | null
  processed_at: string
  created_at: string
  updated_at: string
}

export type DedupeStatus = 'unique' | 'url_duplicate' | 'source_duplicate' | 'similar_candidate'

export interface DuplicateMatch {
  dedupeStatus: DedupeStatus
  dedupeGroupKey: string | null
}

export interface UpsertEnrichedInput {
  rawArticleId: number
  sourceTargetId: string
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
  score: number
  scoreReason: string
  sourceUpdatedAt: string | null
  matchedTagIds: string[]
  candidateTags: Array<{ candidateKey: string; displayName: string }>
}

type UpsertEnrichedResult = {
  enrichedArticleId: number
}

export async function listRawArticlesForEnrichment(
  limit = 50,
  sourceKey?: string | null,
): Promise<RawArticleForEnrichment[]> {
  const sql = getSql()
  const rows = (sourceKey
    ? await sql`
        SELECT
          ar.id,
          ar.source_target_id,
          st.source_key,
          st.source_category,
          st.content_access_policy,
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
        JOIN source_targets st ON st.id = ar.source_target_id
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
          ar.id,
          ar.source_target_id,
          st.source_key,
          st.source_category,
          st.content_access_policy,
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
        JOIN source_targets st ON st.id = ar.source_target_id
        LEFT JOIN observed_article_domains od
          ON od.domain = lower(regexp_replace(split_part(split_part(coalesce(ar.cited_url, ar.source_url, ar.normalized_url), '://', 2), '/', 1), '^www\\.', ''))
        WHERE ar.is_processed = false
          AND ar.process_after <= now()
        ORDER BY ar.created_at ASC
        LIMIT ${limit}
      `) as RawArticleRow[]

  return rows.map((row) => ({
    id: row.id,
    sourceTargetId: row.source_target_id,
    sourceKey: row.source_key,
    sourceCategory: row.source_category,
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
          id,
          normalized_url,
          cited_url,
          dedupe_group_key
        FROM articles_enriched
        WHERE raw_article_id <> ${currentRawArticleId}
          AND (
            normalized_url = ${normalizedUrl}
            OR cited_url = ${citedUrl}
          )
        ORDER BY processed_at DESC, id DESC
        LIMIT 1
      `
    : sql`
        SELECT
          id,
          normalized_url,
          cited_url,
          dedupe_group_key
        FROM articles_enriched
        WHERE raw_article_id <> ${currentRawArticleId}
          AND normalized_url = ${normalizedUrl}
        ORDER BY processed_at DESC, id DESC
        LIMIT 1
      `

  const rows = (await baseQuery) as Array<{
    id: number
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
      id,
      title,
      dedupe_group_key
    FROM articles_enriched
    WHERE raw_article_id <> ${currentRawArticleId}
    ORDER BY processed_at DESC, id DESC
    LIMIT 200
  `) as Array<{
    id: number
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

export async function upsertEnrichedArticle(input: UpsertEnrichedInput): Promise<UpsertEnrichedResult> {
  const sql = getSql()
  const existingRows = (await sql`
    SELECT *
    FROM articles_enriched
    WHERE normalized_url = ${input.normalizedUrl}
    ORDER BY processed_at DESC, id DESC
    LIMIT 1
  `) as ExistingEnrichedRow[]

  const existing = existingRows[0] ?? null

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
        score,
        score_reason,
        source_updated_at,
        processed_at,
        created_at,
        updated_at
      )
      VALUES (
        ${existing.id},
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
        ${existing.score},
        ${existing.score_reason},
        ${existing.source_updated_at},
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
        score = ${input.score},
        score_reason = ${input.scoreReason},
        source_updated_at = ${input.sourceUpdatedAt},
        processed_at = now(),
        updated_at = now()
      WHERE id = ${existing.id}
    `

    await syncEnrichedTags(existing.id, input.matchedTagIds)
    await upsertTagCandidates(input.candidateTags, input.rawArticleId)
    await refreshTagArticleCounts()

    return { enrichedArticleId: existing.id }
  }

  const inserted = (await sql`
    INSERT INTO articles_enriched (
      raw_article_id,
      source_target_id,
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
      score,
      score_reason,
      source_updated_at
    )
    VALUES (
      ${input.rawArticleId},
      ${input.sourceTargetId},
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
      ${input.score},
      ${input.scoreReason},
      ${input.sourceUpdatedAt}
    )
    RETURNING id
  `) as Array<{ id: number }>

  const enrichedArticleId = inserted[0].id
  await syncEnrichedTags(enrichedArticleId, input.matchedTagIds)
  await upsertTagCandidates(input.candidateTags, input.rawArticleId)
  await refreshTagArticleCounts()

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

async function refreshTagArticleCounts(): Promise<void> {
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
    WHERE tm.id = counts.tag_id
  `

  await sql`
    UPDATE tags_master
    SET article_count = 0,
        updated_at = now()
    WHERE id NOT IN (
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
    WHERE id = ${rawArticleId}
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
    WHERE id = ${rawArticleId}
  `
}
