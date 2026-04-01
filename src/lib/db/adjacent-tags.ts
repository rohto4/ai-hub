import { getSql } from '@/lib/db'
import { PUBLIC_DISPLAY_MAX_AGE, type PublicTagSummary } from '@/lib/db/public-shared'
import type { AdjacentTagKeywordReference } from '@/lib/tags/adjacent'

type AdjacentTagKeywordRow = {
  adjacent_tag_id: string
  tag_key: string
  display_name: string
  theme_key: string
  priority: number | string
  keyword: string
  is_case_sensitive: boolean
}

type AdjacentTagSummaryRow = {
  tag_key: string
  display_name: string
  article_count: number | string
}

export async function listAdjacentTagKeywords(): Promise<AdjacentTagKeywordReference[]> {
  const sql = getSql()
  const rows = (await sql`
    SELECT
      atm.adjacent_tag_id,
      atm.tag_key,
      atm.display_name,
      atm.theme_key,
      atm.priority,
      atk.keyword,
      atk.is_case_sensitive
    FROM adjacent_tags_master atm
    JOIN adjacent_tag_keywords atk ON atk.adjacent_tag_id = atm.adjacent_tag_id
    WHERE atm.is_active = true
    ORDER BY atm.priority ASC, atm.tag_key ASC, atk.keyword ASC
  `) as AdjacentTagKeywordRow[]

  return rows.map((row) => ({
    adjacentTagId: row.adjacent_tag_id,
    tagKey: row.tag_key,
    displayName: row.display_name,
    themeKey: row.theme_key,
    priority: Number(row.priority),
    keyword: row.keyword,
    isCaseSensitive: row.is_case_sensitive,
  }))
}

export async function listAdjacentTagSummaries(limit = 24): Promise<PublicTagSummary[]> {
  const sql = getSql()
  const rows = (await sql`
    SELECT atm.tag_key, atm.display_name, COUNT(*)::int AS article_count
    FROM public_article_adjacent_tags paat
    JOIN adjacent_tags_master atm ON atm.adjacent_tag_id = paat.adjacent_tag_id
    JOIN public_articles pa ON pa.public_article_id = paat.public_article_id
    WHERE atm.is_active = true
      AND pa.visibility_status = 'published'
      AND COALESCE(pa.original_published_at, pa.created_at) >= now() - ${PUBLIC_DISPLAY_MAX_AGE}::interval
    GROUP BY atm.tag_key, atm.display_name
    ORDER BY article_count DESC, atm.display_name ASC
    LIMIT ${limit}
  `) as AdjacentTagSummaryRow[]

  return rows.map((row) => ({
    tagKey: row.tag_key,
    displayName: row.display_name,
    articleCount: Number(row.article_count),
  }))
}
