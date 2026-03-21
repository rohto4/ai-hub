import { getSql, hasDatabaseColumn } from '@/lib/db'
import type { Article } from '@/lib/db/types'
import { PUBLIC_DISPLAY_MAX_AGE, PublicArticleRow, buildSourceCategoryFilter, toArticle } from '@/lib/db/public-shared'

export async function searchPublicArticles(options: {
  query: string
  sourceCategory?: string | null
  limit: number
  offset?: number
}): Promise<Article[]> {
  const sql = getSql()
  const hasContentLanguage = await hasDatabaseColumn('public_articles', 'content_language')
  const offset = options.offset ?? 0
  const keyword = `%${options.query}%`
  const sourceCategory = buildSourceCategoryFilter(options.sourceCategory)

  const rows = sourceCategory
    ? ((hasContentLanguage ? await sql`
        SELECT
          pa.public_article_id AS id,
          pa.public_key,
          pa.canonical_url AS url,
          pa.display_title AS title,
          pa.source_category,
          pa.source_type,
          pa.thumbnail_url,
          pa.thumbnail_emoji,
          pa.content_language,
          COALESCE(pa.original_published_at, pa.created_at) AS published_at,
          pa.display_summary_100 AS summary_100,
          pa.display_summary_200 AS summary_200,
          pa.critique,
          pa.publication_basis,
          pa.summary_input_basis,
          NULL::text AS topic_group_id,
          pa.created_at,
          pa.updated_at,
          pa.content_score AS score,
          NULL::jsonb AS breakdown
        FROM public_articles pa
        WHERE pa.visibility_status = 'published'
          AND pa.source_category = ${sourceCategory}
          AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
          AND (
            pa.display_title ILIKE ${keyword}
            OR COALESCE(pa.display_summary_100, '') ILIKE ${keyword}
            OR COALESCE(pa.display_summary_200, '') ILIKE ${keyword}
          )
        ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
        LIMIT ${options.limit}
        OFFSET ${offset}
      ` : await sql`
        SELECT
          pa.public_article_id AS id,
          pa.public_key,
          pa.canonical_url AS url,
          pa.display_title AS title,
          pa.source_category,
          pa.source_type,
          pa.thumbnail_url,
          pa.thumbnail_emoji,
          NULL::varchar(2) AS content_language,
          COALESCE(pa.original_published_at, pa.created_at) AS published_at,
          pa.display_summary_100 AS summary_100,
          pa.display_summary_200 AS summary_200,
          pa.critique,
          pa.publication_basis,
          pa.summary_input_basis,
          NULL::text AS topic_group_id,
          pa.created_at,
          pa.updated_at,
          pa.content_score AS score,
          NULL::jsonb AS breakdown
        FROM public_articles pa
        WHERE pa.visibility_status = 'published'
          AND pa.source_category = ${sourceCategory}
          AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
          AND (
            pa.display_title ILIKE ${keyword}
            OR COALESCE(pa.display_summary_100, '') ILIKE ${keyword}
            OR COALESCE(pa.display_summary_200, '') ILIKE ${keyword}
          )
        ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
        LIMIT ${options.limit}
        OFFSET ${offset}
      `) as PublicArticleRow[])
    : ((hasContentLanguage ? await sql`
        SELECT
          pa.public_article_id AS id,
          pa.public_key,
          pa.canonical_url AS url,
          pa.display_title AS title,
          pa.source_category,
          pa.source_type,
          pa.thumbnail_url,
          pa.thumbnail_emoji,
          pa.content_language,
          COALESCE(pa.original_published_at, pa.created_at) AS published_at,
          pa.display_summary_100 AS summary_100,
          pa.display_summary_200 AS summary_200,
          pa.critique,
          pa.publication_basis,
          pa.summary_input_basis,
          NULL::text AS topic_group_id,
          pa.created_at,
          pa.updated_at,
          pa.content_score AS score,
          NULL::jsonb AS breakdown
        FROM public_articles pa
        WHERE pa.visibility_status = 'published'
          AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
          AND (
            pa.display_title ILIKE ${keyword}
            OR COALESCE(pa.display_summary_100, '') ILIKE ${keyword}
            OR COALESCE(pa.display_summary_200, '') ILIKE ${keyword}
          )
        ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
        LIMIT ${options.limit}
        OFFSET ${offset}
      ` : await sql`
        SELECT
          pa.public_article_id AS id,
          pa.public_key,
          pa.canonical_url AS url,
          pa.display_title AS title,
          pa.source_category,
          pa.source_type,
          pa.thumbnail_url,
          pa.thumbnail_emoji,
          NULL::varchar(2) AS content_language,
          COALESCE(pa.original_published_at, pa.created_at) AS published_at,
          pa.display_summary_100 AS summary_100,
          pa.display_summary_200 AS summary_200,
          pa.critique,
          pa.publication_basis,
          pa.summary_input_basis,
          NULL::text AS topic_group_id,
          pa.created_at,
          pa.updated_at,
          pa.content_score AS score,
          NULL::jsonb AS breakdown
        FROM public_articles pa
        WHERE pa.visibility_status = 'published'
          AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
          AND (
            pa.display_title ILIKE ${keyword}
            OR COALESCE(pa.display_summary_100, '') ILIKE ${keyword}
            OR COALESCE(pa.display_summary_200, '') ILIKE ${keyword}
          )
        ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
        LIMIT ${options.limit}
        OFFSET ${offset}
      `) as PublicArticleRow[])

  return rows.map(toArticle)
}
