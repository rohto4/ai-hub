import { getSql } from '@/lib/db'
import type { ArticleWithScore } from '@/lib/db/types'
import { PUBLIC_DISPLAY_MAX_AGE, PublicArticleRow, PublicTagRow, PublicTagSummary, toArticle } from '@/lib/db/public-shared'

export async function listTagSummaries(limit = 50): Promise<PublicTagSummary[]> {
  const sql = getSql()
  const rows = (await sql`
    SELECT tm.tag_key, tm.display_name, COUNT(*)::int AS article_count
    FROM public_article_tags pat
    JOIN tags_master tm ON tm.tag_id = pat.tag_id
    JOIN public_articles pa ON pa.public_article_id = pat.public_article_id
    WHERE pa.visibility_status = 'published'
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
    GROUP BY tm.tag_key, tm.display_name
    ORDER BY article_count DESC, tm.display_name ASC
    LIMIT ${limit}
  `) as PublicTagRow[]

  return rows.map((row) => ({
    tagKey: row.tag_key,
    displayName: row.display_name,
    articleCount: Number(row.article_count),
  }))
}

export async function listArticlesByTag(options: {
  tagKey: string
  limit: number
  offset?: number
}): Promise<ArticleWithScore[]> {
  const sql = getSql()
  const offset = options.offset ?? 0

  const rows = (await sql`
    SELECT
      pa.public_article_id AS id,
      pa.public_key,
      pa.canonical_url AS url,
      pa.display_title AS title,
      pa.source_category,
      pa.source_type,
      pa.thumbnail_url,
      pa.thumbnail_emoji,
      to_jsonb(pa)->>'thumbnail_bg_theme' AS thumbnail_bg_theme,
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
    JOIN public_article_tags pat ON pat.public_article_id = pa.public_article_id
    JOIN tags_master tm ON tm.tag_id = pat.tag_id
    WHERE pa.visibility_status = 'published'
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
      AND tm.tag_key = ${options.tagKey}
    ORDER BY COALESCE(pa.original_published_at, pa.created_at) DESC
    LIMIT ${options.limit}
    OFFSET ${offset}
  `) as PublicArticleRow[]

  return rows.map(toArticle)
}
