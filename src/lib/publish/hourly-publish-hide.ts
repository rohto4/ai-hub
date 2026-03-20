import type { SqlClient } from '@/lib/publish/hourly-publish-shared'

export async function hideUnpublishedPublicArticles(sql: SqlClient): Promise<number> {
  const hiddenRows = (await sql`
    UPDATE public_articles pa
    SET visibility_status = 'hidden', updated_at = now()
    WHERE visibility_status = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM articles_enriched ae
        WHERE ae.enriched_article_id = pa.enriched_article_id
          AND ae.publish_candidate = true
          AND ae.dedupe_status = 'unique'
          AND ae.ai_processing_state = 'completed'
      )
    RETURNING public_article_id
  `) as Array<{ public_article_id: string }>

  return hiddenRows.length
}
