import { getSql } from '@/lib/db'
import type { PublicArticleDetail } from '@/lib/db/public-shared'
import { ArticleSourceRow, ArticleTagRow, PUBLIC_DISPLAY_MAX_AGE, PublicArticleRow, toArticle } from '@/lib/db/public-shared'
import { findSiteCategory } from '@/lib/site/navigation'

export async function getPublicArticleDetail(publicKey: string): Promise<PublicArticleDetail | null> {
  const sql = getSql()

  const articleRows = (await sql`
    SELECT pa.public_article_id AS id, pa.public_key, pa.canonical_url AS url, pa.display_title AS title,
           pa.source_category, pa.source_type, pa.thumbnail_url, pa.thumbnail_emoji, to_jsonb(pa)->>'thumbnail_bg_theme' AS thumbnail_bg_theme, pa.content_language,
           COALESCE(pa.original_published_at, pa.created_at) AS published_at,
           pa.display_summary_100 AS summary_100, pa.display_summary_200 AS summary_200, pa.critique,
           pa.publication_basis, pa.summary_input_basis, NULL::text AS topic_group_id,
           pa.created_at, pa.updated_at, pa.content_score AS score, NULL::jsonb AS breakdown
    FROM public_articles pa
    WHERE pa.visibility_status = 'published'
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
      AND (pa.public_key = ${publicKey} OR pa.public_article_id::text = ${publicKey})
    LIMIT 1
  `) as Array<PublicArticleRow & { public_key: string }>

  const row = articleRows[0]
  if (!row) return null

  const [tagRows, sourceRows, adjacentTagRows] = await Promise.all([
    (sql`
      SELECT tm.tag_key, tm.display_name, pat.sort_order
      FROM public_article_tags pat
      JOIN tags_master tm ON tm.tag_id = pat.tag_id
      WHERE pat.public_article_id = ${row.id}
      ORDER BY pat.sort_order ASC, tm.display_name ASC
    `) as unknown as Promise<ArticleTagRow[]>,
    (sql`
      SELECT COALESCE(pas.source_key, st.source_key) AS source_key,
             COALESCE(pas.source_display_name, st.display_name) AS display_name,
             COALESCE(st.source_type, 'official') AS source_type
      FROM public_article_sources pas
      LEFT JOIN source_targets st ON st.source_target_id = pas.source_target_id
      WHERE pas.public_article_id = ${row.id}
      ORDER BY pas.is_primary DESC, pas.source_priority DESC
    `) as unknown as Promise<ArticleSourceRow[]>,
    (sql`
      SELECT atm.tag_key, atm.display_name, paat.sort_order
      FROM public_article_adjacent_tags paat
      JOIN adjacent_tags_master atm ON atm.adjacent_tag_id = paat.adjacent_tag_id
      WHERE paat.public_article_id = ${row.id}
      ORDER BY paat.sort_order ASC
    `) as unknown as Promise<ArticleTagRow[]>,
  ])

  const tags = tagRows.map((tag) => ({ tagKey: tag.tag_key, displayName: tag.display_name }))
  const adjacentTags = adjacentTagRows.map((tag) => ({ tagKey: tag.tag_key, displayName: tag.display_name }))
  const primaryTagKeys = tags.map((t) => t.tagKey)
  const adjacentTagKeys = adjacentTags.map((t) => t.tagKey)
  const siteCategory =
    findSiteCategory(row.source_type) ??
    findSiteCategory(row.source_category) ??
    primaryTagKeys.reduce<ReturnType<typeof findSiteCategory>>(
      (found, key) => found ?? findSiteCategory(key),
      null,
    ) ??
    adjacentTagKeys.reduce<ReturnType<typeof findSiteCategory>>(
      (found, key) => found ?? findSiteCategory(key),
      null,
    )

  const article = toArticle(row)
  return {
    ...article,
    primaryTags: tags,
    adjacentTags,
    publicKey: row.public_key,
    tags,
    sources: sourceRows.map((source) => ({
      sourceKey: source.source_key,
      displayName: source.display_name,
      sourceType: source.source_type,
    })),
    siteCategory: siteCategory ?? null,
  }
}
