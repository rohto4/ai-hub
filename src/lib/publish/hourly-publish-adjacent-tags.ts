import type { AdjacentTagRow, SqlClient } from '@/lib/publish/hourly-publish-shared'

export async function syncPublicArticleAdjacentTagsBulk(
  sql: SqlClient,
  enrichedToPublic: Map<number, string>,
  enrichedIds: number[],
  publicIds: string[],
): Promise<number> {
  const allTags = (await sql`
    SELECT enriched_article_id, adjacent_tag_id, sort_order
    FROM articles_enriched_adjacent_tags
    WHERE enriched_article_id = ANY(${enrichedIds})
    ORDER BY enriched_article_id, sort_order ASC, adjacent_tag_id
  `) as AdjacentTagRow[]

  await sql`DELETE FROM public_article_adjacent_tags WHERE public_article_id = ANY(${publicIds})`

  const rows = allTags
    .map((row) => {
      const publicArticleId = enrichedToPublic.get(row.enriched_article_id)
      if (!publicArticleId) return null
      return {
        public_article_id: publicArticleId,
        adjacent_tag_id: row.adjacent_tag_id,
        sort_order: row.sort_order,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (rows.length === 0) return 0

  const publicArticleIds = rows.map((row) => row.public_article_id)
  const adjacentTagIds = rows.map((row) => row.adjacent_tag_id)
  const sortOrders = rows.map((row) => row.sort_order)

  await sql`
    INSERT INTO public_article_adjacent_tags (public_article_id, adjacent_tag_id, sort_order)
    SELECT public_article_id::uuid, adjacent_tag_id::uuid, sort_order::int
    FROM unnest(
      ${publicArticleIds}::text[],
      ${adjacentTagIds}::text[],
      ${sortOrders}::int[]
    ) AS t(public_article_id, adjacent_tag_id, sort_order)
    ON CONFLICT (public_article_id, adjacent_tag_id)
      DO UPDATE SET sort_order = EXCLUDED.sort_order
  `

  return rows.length
}

export async function syncPublicArticleAdjacentTagsOne(
  sql: SqlClient,
  enrichedArticleId: number,
  publicArticleId: string,
): Promise<number> {
  const tags = (await sql`
    SELECT adjacent_tag_id, sort_order
    FROM articles_enriched_adjacent_tags
    WHERE enriched_article_id = ${enrichedArticleId}
    ORDER BY sort_order ASC, adjacent_tag_id
  `) as Array<{ adjacent_tag_id: string; sort_order: number }>

  await sql`DELETE FROM public_article_adjacent_tags WHERE public_article_id = ${publicArticleId}`
  if (tags.length === 0) return 0

  for (const tag of tags) {
    await sql`
      INSERT INTO public_article_adjacent_tags (public_article_id, adjacent_tag_id, sort_order)
      VALUES (${publicArticleId}, ${tag.adjacent_tag_id}, ${tag.sort_order})
      ON CONFLICT (public_article_id, adjacent_tag_id)
      DO UPDATE SET sort_order = EXCLUDED.sort_order
    `
  }
  return tags.length
}
