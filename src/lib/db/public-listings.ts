import type { ArticleWithScore, Lanes, RankPeriod } from '@/lib/db/types'
import { getSql } from '@/lib/db'
import {
  PERIOD_INTERVAL,
  PUBLIC_DISPLAY_MAX_AGE,
  PublicArticleRow,
  buildSourceCategoryFilter,
  buildSourceTypeFilter,
  toArticle,
} from '@/lib/db/public-shared'
import { listContentLaneArticles } from '@/lib/db/public-rankings'

export async function listRandomPublicArticles(options: { limit: number; sourceCategory?: string | null }): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const sourceCategory = buildSourceCategoryFilter(options.sourceCategory)
  const rows = (await sql`
    SELECT pa.public_article_id AS id, pa.public_key, pa.canonical_url AS url, pa.display_title AS title,
           pa.source_category, pa.source_type, pa.thumbnail_url, pa.thumbnail_emoji, pa.content_language,
           COALESCE(pa.original_published_at, pa.created_at) AS published_at,
           pa.display_summary_100 AS summary_100, pa.display_summary_200 AS summary_200, pa.critique,
           pa.publication_basis, pa.summary_input_basis, NULL::text AS topic_group_id,
           pa.created_at, pa.updated_at, pa.content_score AS score, NULL::jsonb AS breakdown
    FROM public_articles pa
    WHERE pa.visibility_status = 'published'
      AND (${sourceCategory}::text IS NULL OR pa.source_category = ${sourceCategory})
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
    ORDER BY RANDOM()
    LIMIT ${options.limit}
  `) as PublicArticleRow[]
  return rows.map(toArticle)
}

export async function listLatestPublicArticles(options: {
  limit: number
  offset?: number
  sourceCategory?: string | null
  sourceType?: string | null
  period?: RankPeriod
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const offset = options.offset ?? 0
  const sourceCategory = buildSourceCategoryFilter(options.sourceCategory)
  const sourceType = buildSourceTypeFilter(options.sourceType)
  const interval = options.period ? PERIOD_INTERVAL[options.period] : null
  const rows = (await sql`
    SELECT pa.public_article_id AS id, pa.public_key, pa.canonical_url AS url, pa.display_title AS title,
           pa.source_category, pa.source_type, pa.thumbnail_url, pa.thumbnail_emoji, pa.content_language,
           COALESCE(pa.original_published_at, pa.created_at) AS published_at,
           pa.display_summary_100 AS summary_100, pa.display_summary_200 AS summary_200, pa.critique,
           pa.publication_basis, pa.summary_input_basis, NULL::text AS topic_group_id,
           pa.created_at, pa.updated_at, pa.content_score AS score, NULL::jsonb AS breakdown
    FROM public_articles pa
    WHERE pa.visibility_status = 'published'
      AND (${sourceCategory}::text IS NULL OR pa.source_category = ${sourceCategory})
      AND (${sourceType}::text IS NULL OR pa.source_type = ${sourceType})
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
      AND (${interval}::text IS NULL OR COALESCE(pa.original_published_at, pa.created_at) >= now() - ${interval}::interval)
    ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
    LIMIT ${options.limit} OFFSET ${offset}
  `) as PublicArticleRow[]
  return rows.map(toArticle)
}

export async function listUniquePublicArticles(options: { limit: number; sourceCategory?: string | null }): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const sourceCategory = buildSourceCategoryFilter(options.sourceCategory)
  const rows = (await sql`
    SELECT pa.public_article_id AS id, pa.public_key, pa.canonical_url AS url, pa.display_title AS title,
           pa.source_category, pa.source_type, pa.thumbnail_url, pa.thumbnail_emoji, pa.content_language,
           COALESCE(pa.original_published_at, pa.created_at) AS published_at,
           pa.display_summary_100 AS summary_100, pa.display_summary_200 AS summary_200, pa.critique,
           pa.publication_basis, pa.summary_input_basis, NULL::text AS topic_group_id,
           pa.created_at, pa.updated_at, pa.content_score AS score, NULL::jsonb AS breakdown
    FROM public_articles pa
    WHERE pa.visibility_status = 'published'
      AND (${sourceCategory}::text IS NULL OR pa.source_category = ${sourceCategory})
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
    ORDER BY pa.source_category, pa.content_score DESC
    LIMIT ${options.limit}
  `) as PublicArticleRow[]
  return rows.map(toArticle)
}

export async function listContentLanes(options: {
  period: RankPeriod
  perLane: number
  sourceCategory?: string | null
}): Promise<Lanes> {
  const [official, paper, news] = await Promise.all([
    listContentLaneArticles({ sourceType: 'official', period: options.period, limit: options.perLane, sourceCategory: options.sourceCategory }),
    listContentLaneArticles({ sourceType: 'paper', period: options.period, limit: options.perLane, sourceCategory: options.sourceCategory }),
    listContentLaneArticles({ sourceType: 'news', period: options.period, limit: options.perLane, sourceCategory: options.sourceCategory }),
  ])
  return { official, paper, news }
}

export async function listFeedArticles(limit = 20): Promise<ArticleWithScore[]> {
  return listLatestPublicArticles({ limit })
}

export async function listPublicArticlesLanes(options: { period: RankPeriod; perLane: number; sourceCategory?: string | null }) {
  return listContentLanes(options)
}
