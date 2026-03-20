import type {
  PublishCandidate,
  RelatedSourceRow,
  SqlClient,
  UpsertedRow,
} from '@/lib/publish/hourly-publish-shared'

export async function syncPublicArticleSources(
  sql: SqlClient,
  rows: UpsertedRow[],
  candidateByCanonical: Map<string, PublishCandidate>,
): Promise<void> {
  if (rows.length === 0) return

  const publicArticleIds = rows.map((row) => row.public_article_id)
  const representativeEnrichedIds = rows
    .map((row) => candidateByCanonical.get(row.canonical_url)?.enriched_article_id)
    .filter((value): value is number => typeof value === 'number')

  const representativeToPublic = new Map<number, string>()
  for (const row of rows) {
    const candidate = candidateByCanonical.get(row.canonical_url)
    if (!candidate) continue
    representativeToPublic.set(candidate.enriched_article_id, row.public_article_id)
  }

  const relatedRows = (await sql`
    WITH representative_articles AS (
      SELECT enriched_article_id, dedupe_group_key
      FROM articles_enriched
      WHERE enriched_article_id = ANY(${representativeEnrichedIds})
    )
    SELECT
      rep.enriched_article_id AS representative_enriched_article_id,
      rel.enriched_article_id AS source_enriched_article_id,
      rel.source_target_id,
      COALESCE(aes.source_key, st.source_key) AS source_key,
      COALESCE(aes.source_display_name, st.display_name) AS source_display_name,
      COALESCE(spr.priority_score, 100) AS source_priority,
      rel.enriched_article_id = rep.enriched_article_id AS is_primary,
      CASE
        WHEN rel.enriched_article_id = rep.enriched_article_id THEN 'selected'
        WHEN rel.dedupe_status = 'similar_candidate' THEN 'supporting'
        ELSE 'rejected'
      END AS selection_status
    FROM representative_articles rep
    JOIN articles_enriched rel
      ON rel.dedupe_group_key = rep.dedupe_group_key
    LEFT JOIN source_targets st
      ON st.source_target_id = rel.source_target_id
    LEFT JOIN source_priority_rules spr
      ON spr.source_target_id = rel.source_target_id
     AND spr.usage_type = 'public_secondary'
     AND spr.is_active = true
    LEFT JOIN LATERAL (
      SELECT aes.source_key, aes.source_display_name
      FROM articles_enriched_sources aes
      WHERE aes.enriched_article_id = rel.enriched_article_id
      ORDER BY
        CASE aes.selection_status
          WHEN 'selected' THEN 0
          WHEN 'supporting' THEN 1
          ELSE 2
        END,
        aes.updated_at DESC
      LIMIT 1
    ) aes ON true
    ORDER BY rep.enriched_article_id, is_primary DESC, COALESCE(spr.priority_score, 100) DESC, rel.processed_at DESC
  `) as RelatedSourceRow[]

  await sql`DELETE FROM public_article_sources WHERE public_article_id = ANY(${publicArticleIds})`

  const insertRows = relatedRows
    .map((row) => {
      const publicArticleId = representativeToPublic.get(row.representative_enriched_article_id)
      if (!publicArticleId || !row.source_key || !row.source_display_name) return null
      return {
        public_article_id: publicArticleId,
        enriched_article_id: row.source_enriched_article_id,
        source_target_id: row.source_target_id,
        source_key: row.source_key,
        source_display_name: row.source_display_name,
        source_priority: Number(row.source_priority ?? 100),
        is_primary: row.is_primary,
        selection_status: row.selection_status,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (insertRows.length === 0) return

  const publicIds = insertRows.map((row) => row.public_article_id)
  const enrichedIds = insertRows.map((row) => row.enriched_article_id)
  const sourceTargetIds = insertRows.map((row) => row.source_target_id ?? null)
  const sourceKeys = insertRows.map((row) => row.source_key)
  const sourceDisplayNames = insertRows.map((row) => row.source_display_name)
  const sourcePriorities = insertRows.map((row) => row.source_priority)
  const primaryFlags = insertRows.map((row) => row.is_primary)
  const selectionStatuses = insertRows.map((row) => row.selection_status)

  await sql`
    INSERT INTO public_article_sources (
      public_article_id, enriched_article_id, source_target_id,
      source_key, source_display_name, source_priority, is_primary, selection_status
    )
    SELECT
      public_id::uuid, enriched_id::bigint, NULLIF(source_target_id, '')::uuid,
      source_key, source_display_name, source_priority::numeric, is_primary, selection_status
    FROM unnest(
      ${publicIds}::text[],
      ${enrichedIds}::bigint[],
      ${sourceTargetIds}::text[],
      ${sourceKeys}::text[],
      ${sourceDisplayNames}::text[],
      ${sourcePriorities}::numeric[],
      ${primaryFlags}::boolean[],
      ${selectionStatuses}::text[]
    ) AS t(public_id, enriched_id, source_target_id, source_key, source_display_name, source_priority, is_primary, selection_status)
    ON CONFLICT (public_article_id, enriched_article_id) DO UPDATE SET
      source_target_id     = EXCLUDED.source_target_id,
      source_key           = EXCLUDED.source_key,
      source_display_name  = EXCLUDED.source_display_name,
      source_priority      = EXCLUDED.source_priority,
      is_primary           = EXCLUDED.is_primary,
      selection_status     = EXCLUDED.selection_status
  `
}
