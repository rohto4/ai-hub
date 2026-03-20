import type { SqlClient, TagRow } from '@/lib/publish/hourly-publish-shared'

export async function syncPublicArticleTagsBulk(
  sql: SqlClient,
  enrichedToPublic: Map<number, string>,
  enrichedIds: number[],
  publicIds: string[],
): Promise<number> {
  const allTags = (await sql`
    SELECT enriched_article_id, tag_id, is_primary
    FROM articles_enriched_tags
    WHERE enriched_article_id = ANY(${enrichedIds})
    ORDER BY enriched_article_id, is_primary DESC, tag_id
  `) as TagRow[]

  await sql`DELETE FROM public_article_tags WHERE public_article_id = ANY(${publicIds})`

  const tagCountByEnriched = new Map<number, number>()
  const tagRows = allTags
    .map((tag) => {
      const publicArticleId = enrichedToPublic.get(tag.enriched_article_id)
      if (!publicArticleId) return null
      const sortOrder = tagCountByEnriched.get(tag.enriched_article_id) ?? 0
      tagCountByEnriched.set(tag.enriched_article_id, sortOrder + 1)
      return { public_article_id: publicArticleId, tag_id: tag.tag_id, sort_order: sortOrder }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (tagRows.length === 0) return 0

  const publicArticleIds = tagRows.map((row) => row.public_article_id)
  const tagIds = tagRows.map((row) => String(row.tag_id))
  const sortOrders = tagRows.map((row) => row.sort_order)

  await sql`
    INSERT INTO public_article_tags (public_article_id, tag_id, sort_order)
    SELECT public_article_id::uuid, tag_id::uuid, sort_order::int
    FROM unnest(
      ${publicArticleIds}::text[],
      ${tagIds}::text[],
      ${sortOrders}::int[]
    ) AS t(public_article_id, tag_id, sort_order)
    ON CONFLICT (public_article_id, tag_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
  `

  return tagRows.length
}

export async function syncPublicArticleTagsOne(
  sql: SqlClient,
  enrichedArticleId: number,
  publicArticleId: string,
): Promise<number> {
  const tags = (await sql`
    SELECT tag_id, is_primary
    FROM articles_enriched_tags
    WHERE enriched_article_id = ${enrichedArticleId}
    ORDER BY is_primary DESC
  `) as Array<{ tag_id: string; is_primary: boolean }>

  if (tags.length === 0) return 0

  await sql`DELETE FROM public_article_tags WHERE public_article_id = ${publicArticleId}`
  for (const [index, tag] of tags.entries()) {
    await sql`
      INSERT INTO public_article_tags (public_article_id, tag_id, sort_order)
      VALUES (${publicArticleId}, ${tag.tag_id}, ${index})
      ON CONFLICT (public_article_id, tag_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
    `
  }

  return tags.length
}
