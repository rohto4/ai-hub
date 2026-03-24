import { getSql } from '@/lib/db'
import type { RawArticleForEnrichment } from '@/lib/db/enrichment-types'
import {
  ARXIV_AI_ENRICH_MAX_ARTICLE_AGE_MONTHS,
  ARXIV_AI_SOURCE_KEY,
  DEFAULT_ENRICH_MAX_ARTICLE_AGE_MONTHS,
} from '@/lib/source-retention'

type RawArticleRow = {
  raw_article_id: number
  source_target_id: string
  source_key: string
  display_name: string
  source_category: string
  source_type: string
  content_language: 'ja' | 'en' | null
  content_access_policy: 'feed_only' | 'fulltext_allowed' | 'blocked_snippet_only'
  observed_domain: string | null
  observed_domain_fetch_policy: 'needs_review' | 'fulltext_allowed' | 'snippet_only' | 'blocked' | null
  normalized_url: string
  cited_url: string | null
  title: string | null
  snippet: string | null
  source_url: string
  source_published_at: string | null
  source_updated_at: string | null
  has_source_update: boolean
  source_commercial_use_policy: 'permitted' | 'prohibited' | 'unknown'
  domain_commercial_use_policy: 'permitted' | 'prohibited' | 'unknown' | null
}

const ENRICH_CLAIM_MINUTES = 30

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
          st.content_language,
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
          ar.source_published_at,
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
          st.content_language,
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
          ar.source_published_at,
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
    contentLanguage: row.content_language,
    contentAccessPolicy: row.content_access_policy,
    observedDomain: row.observed_domain,
    observedDomainFetchPolicy: row.observed_domain_fetch_policy,
    normalizedUrl: row.normalized_url,
    citedUrl: row.cited_url,
    title: row.title,
    snippet: row.snippet,
    sourceUrl: row.source_url,
    sourcePublishedAt: row.source_published_at,
    sourceUpdatedAt: row.source_updated_at,
    hasSourceUpdate: row.has_source_update,
    commercialUsePolicy:
      row.source_commercial_use_policy === 'prohibited' ||
      row.domain_commercial_use_policy === 'prohibited'
        ? 'prohibited'
        : row.source_commercial_use_policy,
  }))
}

export async function claimRawArticlesForEnrichment(
  limit = 10,
  sourceKey?: string | null,
): Promise<RawArticleForEnrichment[]> {
  const sql = getSql()
  const rows = (sourceKey
    ? await sql`
        WITH candidate_rows AS (
          SELECT ar.raw_article_id, ar.created_at
          FROM articles_raw ar
          JOIN source_targets st ON st.source_target_id = ar.source_target_id
          WHERE ar.is_processed = false
            AND ar.process_after <= now()
            AND st.source_key = ${sourceKey}
          ORDER BY ar.created_at ASC
          FOR UPDATE OF ar SKIP LOCKED
          LIMIT ${limit}
        ),
        claimed_rows AS (
          UPDATE articles_raw ar
          SET
            process_after = now() + make_interval(mins => ${ENRICH_CLAIM_MINUTES}),
            updated_at = now()
          FROM candidate_rows cr
          WHERE ar.raw_article_id = cr.raw_article_id
          RETURNING ar.raw_article_id
        )
        SELECT
          ar.raw_article_id,
          ar.source_target_id,
          st.source_key,
          st.display_name,
          st.source_category,
          st.source_type,
          st.content_language,
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
          ar.source_published_at,
          ar.source_updated_at,
          ar.has_source_update
        FROM claimed_rows cl
        JOIN articles_raw ar ON ar.raw_article_id = cl.raw_article_id
        JOIN source_targets st ON st.source_target_id = ar.source_target_id
        LEFT JOIN observed_article_domains od
          ON od.domain = lower(regexp_replace(split_part(split_part(coalesce(ar.cited_url, ar.source_url, ar.normalized_url), '://', 2), '/', 1), '^www\\.', ''))
        ORDER BY ar.created_at ASC
      `
    : await sql`
        WITH candidate_rows AS (
          SELECT ar.raw_article_id, ar.created_at
          FROM articles_raw ar
          WHERE ar.is_processed = false
            AND ar.process_after <= now()
          ORDER BY ar.created_at ASC
          FOR UPDATE OF ar SKIP LOCKED
          LIMIT ${limit}
        ),
        claimed_rows AS (
          UPDATE articles_raw ar
          SET
            process_after = now() + make_interval(mins => ${ENRICH_CLAIM_MINUTES}),
            updated_at = now()
          FROM candidate_rows cr
          WHERE ar.raw_article_id = cr.raw_article_id
          RETURNING ar.raw_article_id
        )
        SELECT
          ar.raw_article_id,
          ar.source_target_id,
          st.source_key,
          st.display_name,
          st.source_category,
          st.source_type,
          st.content_language,
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
          ar.source_published_at,
          ar.source_updated_at,
          ar.has_source_update
        FROM claimed_rows cl
        JOIN articles_raw ar ON ar.raw_article_id = cl.raw_article_id
        JOIN source_targets st ON st.source_target_id = ar.source_target_id
        LEFT JOIN observed_article_domains od
          ON od.domain = lower(regexp_replace(split_part(split_part(coalesce(ar.cited_url, ar.source_url, ar.normalized_url), '://', 2), '/', 1), '^www\\.', ''))
        ORDER BY ar.created_at ASC
      `) as RawArticleRow[]

  return rows.map((row) => ({
    id: row.raw_article_id,
    sourceTargetId: row.source_target_id,
    sourceKey: row.source_key,
    sourceDisplayName: row.display_name,
    sourceCategory: row.source_category,
    sourceType: row.source_type,
    contentLanguage: row.content_language,
    contentAccessPolicy: row.content_access_policy,
    observedDomain: row.observed_domain,
    observedDomainFetchPolicy: row.observed_domain_fetch_policy,
    normalizedUrl: row.normalized_url,
    citedUrl: row.cited_url,
    title: row.title,
    snippet: row.snippet,
    sourceUrl: row.source_url,
    sourcePublishedAt: row.source_published_at,
    sourceUpdatedAt: row.source_updated_at,
    hasSourceUpdate: row.has_source_update,
    commercialUsePolicy:
      row.source_commercial_use_policy === 'prohibited' ||
      row.domain_commercial_use_policy === 'prohibited'
        ? 'prohibited'
        : row.source_commercial_use_policy,
  }))
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

export async function skipExpiredRawArticlesForEnrichment(sourceKey?: string | null): Promise<number> {
  const sql = getSql()
  const rows = (sourceKey
    ? await sql`
        UPDATE articles_raw ar
        SET
          is_processed = true,
          has_source_update = false,
          process_after = now(),
          last_error = null,
          updated_at = now()
        FROM source_targets st
        WHERE st.source_target_id = ar.source_target_id
          AND st.source_key = ${sourceKey}
          AND ar.is_processed = false
          AND ar.source_published_at IS NOT NULL
          AND ar.source_published_at < now() - make_interval(
            months => ${
              sourceKey === ARXIV_AI_SOURCE_KEY
                ? ARXIV_AI_ENRICH_MAX_ARTICLE_AGE_MONTHS
                : DEFAULT_ENRICH_MAX_ARTICLE_AGE_MONTHS
            }
          )
        RETURNING ar.raw_article_id
      `
    : await sql`
        UPDATE articles_raw ar
        SET
          is_processed = true,
          has_source_update = false,
          process_after = now(),
          last_error = null,
          updated_at = now()
        FROM source_targets st
        WHERE st.source_target_id = ar.source_target_id
          AND ar.is_processed = false
          AND ar.source_published_at IS NOT NULL
          AND ar.source_published_at < now() - make_interval(
            months => CASE
              WHEN st.source_key = ${ARXIV_AI_SOURCE_KEY} THEN ${ARXIV_AI_ENRICH_MAX_ARTICLE_AGE_MONTHS}
              ELSE ${DEFAULT_ENRICH_MAX_ARTICLE_AGE_MONTHS}
            END
          )
        RETURNING ar.raw_article_id
      `) as Array<{ raw_article_id: number }>

  return rows.length
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
