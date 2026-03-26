import type { PublishCandidate, SqlClient } from '@/lib/publish/hourly-publish-shared'

export async function listPublishCandidates(sql: SqlClient): Promise<PublishCandidate[]> {
  return (await sql`
    WITH tag_stats AS (
      SELECT
        ae.enriched_article_id,
        COUNT(aet.tag_id)::int AS tag_count,
        COUNT(*) FILTER (WHERE tm.tag_key IN ('llm', 'policy'))::int AS generic_tag_count,
        COUNT(*) FILTER (WHERE tm.tag_key NOT IN ('llm', 'policy'))::int AS specific_tag_count
      FROM articles_enriched ae
      LEFT JOIN articles_enriched_tags aet
        ON aet.enriched_article_id = ae.enriched_article_id
      LEFT JOIN tags_master tm
        ON tm.tag_id = aet.tag_id
      GROUP BY ae.enriched_article_id
    )
    SELECT
      ae.enriched_article_id,
      ae.source_target_id,
      st.source_key,
      st.display_name AS source_display_name,
      ae.canonical_url,
      ae.title,
      ae.summary_100,
      ae.summary_200,
      ae.publication_text,
      ae.source_category,
      ae.source_type,
      ae.content_language,
      ae.dedupe_group_key,
      ae.summary_input_basis,
      ae.publication_basis,
      GREATEST(
        0,
        ae.score::int
        - CASE
            WHEN COALESCE(ts.tag_count, 0) = 0 THEN 35
            WHEN ts.tag_count = 1 THEN 20
            WHEN ts.tag_count = 2 THEN 8
            ELSE 0
          END
        - CASE
            WHEN COALESCE(ts.tag_count, 0) > 0
             AND COALESCE(ts.specific_tag_count, 0) = 0
             AND COALESCE(ts.generic_tag_count, 0) = COALESCE(ts.tag_count, 0)
             AND COALESCE(ts.tag_count, 0) <= 2
              THEN 15
            ELSE 0
          END
      ) AS score,
      ae.source_updated_at,
      ae.thumbnail_url,
      ae.thumbnail_bg_theme,
      COALESCE(spr.priority_score, 100) AS priority_score
    FROM articles_enriched ae
    JOIN source_targets st ON st.source_target_id = ae.source_target_id
    LEFT JOIN tag_stats ts
      ON ts.enriched_article_id = ae.enriched_article_id
    LEFT JOIN source_priority_rules spr
      ON spr.source_target_id = ae.source_target_id
      AND spr.usage_type = 'public_primary'
      AND spr.is_active = true
    WHERE ae.publish_candidate = true
      AND ae.dedupe_status = 'unique'
      AND ae.ai_processing_state = 'completed'
      AND COALESCE(ae.commercial_use_policy, 'permitted') != 'prohibited'
    ORDER BY COALESCE(spr.priority_score, 100) DESC, ae.processed_at DESC
  `) as PublishCandidate[]
}
