import { nanoid } from 'nanoid'
import { getSql } from '@/lib/db'
import { finishJobRun, recordJobRunItem, startJobRun } from '@/lib/db/job-runs'
import { pickThumbnailEmoji } from '@/lib/publish/thumbnail-emoji'

export interface HourlyPublishResult {
  upserted: number
  hidden: number
  tagsUpdated: number
  failed: number
}

type PublishCandidate = {
  enriched_article_id: number
  source_target_id: string
  canonical_url: string
  title: string
  summary_100: string
  summary_200: string | null
  publication_text: string | null
  source_category: string
  source_type: string
  summary_input_basis: string
  publication_basis: string
  score: string | number
  source_updated_at: string | null
  thumbnail_url: string | null
  priority_score: string | number | null
}

type TagRow = {
  tag_id: string
  is_primary: boolean
}

type UpsertedRow = {
  public_article_id: string
}

export async function runHourlyPublish(): Promise<HourlyPublishResult> {
  const sql = getSql()
  const jobRunId = await startJobRun({
    jobName: 'hourly-publish',
    metadata: {},
  })

  // ── 1. 公開候補を全件取得（unique かつ AI 処理完了のみ）────────────
  const candidates = (await sql`
    SELECT
      ae.enriched_article_id,
      ae.source_target_id,
      ae.canonical_url,
      ae.title,
      ae.summary_100,
      ae.summary_200,
      ae.publication_text,
      ae.source_category,
      ae.source_type,
      ae.summary_input_basis,
      ae.publication_basis,
      ae.score,
      ae.source_updated_at,
      ae.thumbnail_url,
      COALESCE(spr.priority_score, 100) AS priority_score
    FROM articles_enriched ae
    LEFT JOIN source_priority_rules spr
      ON spr.source_target_id = ae.source_target_id
      AND spr.usage_type = 'public_primary'
      AND spr.is_active = true
    WHERE ae.publish_candidate = true
      AND ae.dedupe_status = 'unique'
      AND ae.ai_processing_state = 'completed'
    ORDER BY COALESCE(spr.priority_score, 100) DESC, ae.processed_at DESC
  `) as PublishCandidate[]

  let upserted = 0
  let tagsUpdated = 0
  let failed = 0

  // ── 2. 記事ごとに public_articles へ UPSERT ──────────────────────
  for (const candidate of candidates) {
    try {
      // 既存行の public_key を保持（URL が同じ記事の再公開時にキーを変えない）
      const existing = (await sql`
        SELECT public_article_id, public_key
        FROM public_articles
        WHERE canonical_url = ${candidate.canonical_url}
        LIMIT 1
      `) as Array<{ public_article_id: string; public_key: string }>

      const publicKey = existing[0]?.public_key ?? nanoid(11)
      // publication_text → summary_200 → summary_100 の優先順で表示用テキストを決定
      const displaySummary =
        candidate.publication_text ?? candidate.summary_200 ?? candidate.summary_100
      const thumbnailEmoji = pickThumbnailEmoji({
        title: candidate.title,
        summary100: candidate.summary_100,
        summary200: displaySummary,
        sourceType: candidate.source_type,
        sourceCategory: candidate.source_category,
      })

      const upsertedRow = (await sql`
        INSERT INTO public_articles (
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
          summary_input_basis,
          publication_basis,
          content_score,
          original_published_at,
          visibility_status,
          public_refreshed_at
        )
        VALUES (
          ${candidate.enriched_article_id},
          ${candidate.source_target_id},
          ${publicKey},
          ${candidate.canonical_url},
          ${candidate.title},
          ${candidate.summary_100},
          ${displaySummary},
          ${candidate.thumbnail_url},
          ${thumbnailEmoji},
          ${candidate.source_category},
          ${candidate.source_type},
          ${candidate.summary_input_basis},
          ${candidate.publication_basis},
          ${Number(candidate.score)},
          ${candidate.source_updated_at},
          'published',
          now()
        )
        ON CONFLICT (canonical_url) DO UPDATE SET
          enriched_article_id      = EXCLUDED.enriched_article_id,
          primary_source_target_id = EXCLUDED.primary_source_target_id,
          display_title            = EXCLUDED.display_title,
          display_summary_100      = EXCLUDED.display_summary_100,
          display_summary_200      = EXCLUDED.display_summary_200,
          thumbnail_url            = EXCLUDED.thumbnail_url,
          thumbnail_emoji          = EXCLUDED.thumbnail_emoji,
          source_category          = EXCLUDED.source_category,
          source_type              = EXCLUDED.source_type,
          summary_input_basis      = EXCLUDED.summary_input_basis,
          publication_basis        = EXCLUDED.publication_basis,
          content_score            = EXCLUDED.content_score,
          original_published_at    = EXCLUDED.original_published_at,
          visibility_status        = 'published',
          public_refreshed_at      = now(),
          updated_at               = now()
        RETURNING public_article_id
      `) as UpsertedRow[]

      const publicArticleId = upsertedRow[0].public_article_id

      // public_article_sources
      await sql`
        INSERT INTO public_article_sources (
          public_article_id, enriched_article_id, source_target_id,
          source_priority, is_primary
        )
        VALUES (
          ${publicArticleId},
          ${candidate.enriched_article_id},
          ${candidate.source_target_id},
          ${Number(candidate.priority_score ?? 100)},
          true
        )
        ON CONFLICT (public_article_id, enriched_article_id) DO UPDATE SET
          source_priority = EXCLUDED.source_priority
      `

      // public_article_tags: articles_enriched_tags から転写
      const tags = (await sql`
        SELECT tag_id, is_primary
        FROM articles_enriched_tags
        WHERE enriched_article_id = ${candidate.enriched_article_id}
        ORDER BY is_primary DESC
      `) as TagRow[]

      if (tags.length > 0) {
        await sql`DELETE FROM public_article_tags WHERE public_article_id = ${publicArticleId}`
        for (const [idx, tag] of tags.entries()) {
          await sql`
            INSERT INTO public_article_tags (public_article_id, tag_id, sort_order)
            VALUES (${publicArticleId}, ${tag.tag_id}, ${idx})
            ON CONFLICT (public_article_id, tag_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
          `
        }
        tagsUpdated += tags.length
      }

      upserted++
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown publish error'
      failed++
      await recordJobRunItem({
        jobRunId,
        itemKey: String(candidate.enriched_article_id),
        itemStatus: 'failed',
        detail: {
          enrichedArticleId: candidate.enriched_article_id,
          canonicalUrl: candidate.canonical_url,
        },
        errorMessage: message,
      })
    }
  }

  // ── 3. publish_candidate=false になった記事を hidden に ──────────
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
  `) as UpsertedRow[]

  const hidden = hiddenRows.length

  await finishJobRun({
    jobRunId,
    status: failed > 0 ? 'failed' : 'completed',
    processedCount: candidates.length,
    successCount: upserted,
    failedCount: failed,
    metadata: { upserted, hidden, tagsUpdated },
    lastError: null,
  })

  return { upserted, hidden, tagsUpdated, failed }
}
