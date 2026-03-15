import { getSql } from '@/lib/db'
import type { TagReference } from '@/lib/tags/match'

type TagRow = {
  id: string
  tag_key: string
  display_name: string
  trend_keyword: string | null
  aliases: string[] | null
}

export async function listActiveTagReferences(): Promise<TagReference[]> {
  const sql = getSql()
  const rows = (await sql`
    SELECT
      tm.tag_id AS id,
      tm.tag_key,
      tm.display_name,
      tm.trend_keyword,
      COALESCE(array_agg(ta.alias_key) FILTER (WHERE ta.alias_key IS NOT NULL), '{}'::text[]) AS aliases
    FROM tags_master tm
    LEFT JOIN tag_aliases ta ON ta.tag_id = tm.tag_id
    WHERE tm.is_active = true
    GROUP BY tm.tag_id, tm.tag_key, tm.display_name, tm.trend_keyword
    ORDER BY tm.display_name ASC
  `) as TagRow[]

  return rows.map((row) => ({
    id: row.id,
    tagKey: row.tag_key,
    displayName: row.display_name,
    aliases: [row.trend_keyword, ...(row.aliases ?? [])].filter((value): value is string => Boolean(value)),
  }))
}
