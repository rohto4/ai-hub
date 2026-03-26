import { getSql } from '@/lib/db'
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
