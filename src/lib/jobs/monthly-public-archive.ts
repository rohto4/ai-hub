import { getSql } from '@/lib/db'
import { finishJobRun, startJobRun } from '@/lib/db/job-runs'

export interface MonthlyPublicArchiveOptions {
  limit?: number
  ageMonths?: number
}

export interface MonthlyPublicArchiveResult {
  archived: number
  limit: number
  ageMonths: number
  oldestArchivedAt: string | null
  newestArchivedAt: string | null
}

type ArchiveSummaryRow = {
  archived_count: number | string
  oldest_archived_at: string | null
  newest_archived_at: string | null
}

export async function runMonthlyPublicArchive(
  options: MonthlyPublicArchiveOptions = {},
): Promise<MonthlyPublicArchiveResult> {
  const sql = getSql()
  const limit = Math.max(1, Math.min(10000, options.limit ?? 5000))
  const ageMonths = Math.max(1, Math.min(24, options.ageMonths ?? 6))

  const jobRunId = await startJobRun({
    jobName: 'monthly-public-archive',
    metadata: { limit, ageMonths, archiveReason: 'age_out' },
  })

  try {
    await sql`BEGIN`

    const summaryRows = (await sql`
      WITH archive_candidates AS (
        SELECT
          pa.public_article_id,
          pa.enriched_article_id,
          pa.primary_source_target_id,
          pa.public_key,
          pa.canonical_url,
          pa.display_title,
          pa.display_summary_100,
          pa.display_summary_200,
          pa.thumbnail_url,
          pa.thumbnail_emoji,
          pa.source_category,
          pa.source_type,
          pa.content_language,
          pa.summary_input_basis,
          pa.publication_basis,
          pa.content_score,
          pa.critique,
          pa.topic_group_id,
          pa.original_published_at,
          pa.visibility_status,
          pa.public_refreshed_at,
          pa.created_at,
          pa.updated_at,
          COALESCE(pa.original_published_at, pa.created_at) AS archive_basis_at
        FROM public_articles pa
        WHERE COALESCE(pa.original_published_at, pa.created_at)
          < now() - make_interval(months => ${ageMonths})
        ORDER BY COALESCE(pa.original_published_at, pa.created_at) ASC, pa.public_article_id ASC
        LIMIT ${limit}
      ),
      inserted_history AS (
        INSERT INTO public_articles_history (
          public_article_id,
          enriched_article_id,
          primary_source_target_id,
          public_key,
          canonical_url,
          display_title,
          display_summary_100,
          display_summary_200,
          thumbnail_url,
          thumbnail_emoji,
          source_category,
          source_type,
          content_language,
          summary_input_basis,
          publication_basis,
          content_score,
          critique,
          topic_group_id,
          original_published_at,
          visibility_status,
          public_refreshed_at,
          created_at,
          updated_at,
          archive_reason,
          archived_at
        )
        SELECT
          public_article_id,
          enriched_article_id,
          primary_source_target_id,
          public_key,
          canonical_url,
          display_title,
          display_summary_100,
          display_summary_200,
          thumbnail_url,
          thumbnail_emoji,
          source_category,
          source_type,
          content_language,
          summary_input_basis,
          publication_basis,
          content_score,
          critique,
          topic_group_id,
          original_published_at,
          visibility_status,
          public_refreshed_at,
          created_at,
          updated_at,
          'age_out',
          now()
        FROM archive_candidates
        RETURNING public_article_id
      ),
      deleted_rows AS (
        DELETE FROM public_articles pa
        USING inserted_history ih
        WHERE pa.public_article_id = ih.public_article_id
        RETURNING COALESCE(pa.original_published_at, pa.created_at) AS archive_basis_at
      )
      SELECT
        COUNT(*)::int AS archived_count,
        MIN(archive_basis_at)::text AS oldest_archived_at,
        MAX(archive_basis_at)::text AS newest_archived_at
      FROM deleted_rows
    `) as ArchiveSummaryRow[]

    await sql`COMMIT`

    const summary = summaryRows[0]
    const result: MonthlyPublicArchiveResult = {
      archived: Number(summary?.archived_count ?? 0),
      limit,
      ageMonths,
      oldestArchivedAt: summary?.oldest_archived_at ?? null,
      newestArchivedAt: summary?.newest_archived_at ?? null,
    }

    await finishJobRun({
      jobRunId,
      status: 'completed',
      processedCount: result.archived,
      successCount: result.archived,
      failedCount: 0,
      metadata: {
        archived: result.archived,
        limit: result.limit,
        ageMonths: result.ageMonths,
        oldestArchivedAt: result.oldestArchivedAt,
        newestArchivedAt: result.newestArchivedAt,
      },
      lastError: null,
    })

    return result
  } catch (error) {
    await sql`ROLLBACK`
    const message = error instanceof Error ? error.message : 'Unknown monthly public archive error'
    await finishJobRun({
      jobRunId,
      status: 'failed',
      processedCount: 0,
      successCount: 0,
      failedCount: 1,
      metadata: { limit, ageMonths },
      lastError: message,
    })
    throw error
  }
}
