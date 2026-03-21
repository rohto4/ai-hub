import type { PublishCandidate, SqlClient } from '@/lib/publish/hourly-publish-shared'

export async function listPublishCandidates(sql: SqlClient): Promise<PublishCandidate[]> {
  return (await sql`
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
      ae.score,
      ae.source_updated_at,
      ae.thumbnail_url,
      COALESCE(spr.priority_score, 100) AS priority_score
    FROM articles_enriched ae
    JOIN source_targets st ON st.source_target_id = ae.source_target_id
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
