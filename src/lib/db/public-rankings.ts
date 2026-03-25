import { getSql } from '@/lib/db'
import type { ArticleWithScore, RankPeriod } from '@/lib/db/types'
import {
  applyDomainDiversity,
  PERIOD_INTERVAL,
  PUBLIC_DISPLAY_MAX_AGE,
  PublicArticleRow,
  buildSourceCategoryFilter,
  toArticle,
} from '@/lib/db/public-shared'

export async function listRankedPublicArticles(options: {
  period: RankPeriod
  sourceCategory?: string | null
  limit: number
  offset?: number
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const rankingWindow = options.period
  const sourceCategory = buildSourceCategoryFilter(options.sourceCategory)
  const offset = options.offset ?? 0

  const rows = (await sql`
    SELECT pa.public_article_id AS id, pa.public_key, pa.canonical_url AS url, pa.display_title AS title,
           pa.source_category, pa.source_type, pa.thumbnail_url, pa.thumbnail_emoji, pa.content_language,
           COALESCE(pa.original_published_at, pa.created_at) AS published_at,
           pa.display_summary_100 AS summary_100, pa.display_summary_200 AS summary_200, pa.critique,
           pa.publication_basis, pa.summary_input_basis, NULL::text AS topic_group_id,
           pa.created_at, pa.updated_at, COALESCE(pr.score, pa.content_score) AS score, NULL::jsonb AS breakdown
    FROM public_articles pa
    LEFT JOIN public_rankings pr ON pr.public_article_id = pa.public_article_id AND pr.ranking_window = ${rankingWindow}
    WHERE pa.visibility_status = 'published'
      AND (${sourceCategory}::text IS NULL OR pa.source_category = ${sourceCategory})
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
    ORDER BY COALESCE(pr.rank_position, 999999) ASC, COALESCE(pr.score, pa.content_score) DESC, COALESCE(pa.original_published_at, pa.created_at) DESC
    LIMIT ${Math.max(options.limit * 4, options.limit + offset + 20)} OFFSET ${offset}
  `) as PublicArticleRow[]

  return applyDomainDiversity(rows.map(toArticle), options.limit)
}

export async function listDigestArticles(limit = 10): Promise<ArticleWithScore[]> {
  return listRankedPublicArticles({ period: '24h', limit })
}

export async function listContentLaneArticles(options: {
  sourceType: 'official' | 'paper' | 'news'
  period: RankPeriod
  limit: number
  sourceCategory?: string | null
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const interval = PERIOD_INTERVAL[options.period]
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
      AND pa.source_type = ${options.sourceType}
      AND (${sourceCategory}::text IS NULL OR pa.source_category = ${sourceCategory})
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${interval}::interval
    ORDER BY pa.content_score DESC, COALESCE(pa.original_published_at, pa.created_at) DESC
    LIMIT ${Math.max(options.limit * 4, options.limit + 20)}
  `) as PublicArticleRow[]

  return applyDomainDiversity(rows.map(toArticle), options.limit)
}
