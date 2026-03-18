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
  enriched_article_id: number
  tag_id: string
  is_primary: boolean
}

type UpsertedRow = {
  public_article_id: string
  canonical_url: string
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

  if (candidates.length > 0) {
    try {
      // ── 2. 既存 public_key を一括 SELECT ──────────────────────────────
      const canonicalUrls = candidates.map(c => c.canonical_url)
      const existingRows = (await sql`
        SELECT canonical_url, public_key
        FROM public_articles
        WHERE canonical_url = ANY(${canonicalUrls})
      `) as Array<{ canonical_url: string; public_key: string }>
      const existingKeyMap = new Map(existingRows.map(r => [r.canonical_url, r.public_key]))

      // ── 3. public_articles 行を準備 ────────────────────────────────
      const now = new Date()
      const articleRows = candidates.map(c => {
        const displaySummary = c.publication_text ?? c.summary_200 ?? c.summary_100
        return {
          enriched_article_id: c.enriched_article_id,
          primary_source_target_id: c.source_target_id,
          public_key: existingKeyMap.get(c.canonical_url) ?? nanoid(11),
          canonical_url: c.canonical_url,
          display_title: c.title,
          display_summary_100: c.summary_100,
          display_summary_200: displaySummary,
          thumbnail_url: c.thumbnail_url ?? null,
          thumbnail_emoji: pickThumbnailEmoji({
            title: c.title,
            summary100: c.summary_100,
            summary200: displaySummary,
            sourceType: c.source_type,
            sourceCategory: c.source_category,
          }),
          source_category: c.source_category,
          source_type: c.source_type,
          summary_input_basis: c.summary_input_basis,
          publication_basis: c.publication_basis,
          content_score: Number(c.score),
          original_published_at: c.source_updated_at ?? null,
          visibility_status: 'published',
          public_refreshed_at: now,
        }
      })

      // ── 4. public_articles を一括 UPSERT ──────────────────────────────
      const upsertedRows = (await sql`
        INSERT INTO public_articles ${sql(
          articleRows,
          'enriched_article_id',
          'primary_source_target_id',
          'public_key',
          'canonical_url',
          'display_title',
          'display_summary_100',
          'display_summary_200',
          'thumbnail_url',
          'thumbnail_emoji',
          'source_category',
          'source_type',
          'summary_input_basis',
          'publication_basis',
          'content_score',
          'original_published_at',
          'visibility_status',
          'public_refreshed_at',
        )}
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
        RETURNING public_article_id, canonical_url
      `) as UpsertedRow[]
      upserted = upsertedRows.length

      // ── 5. canonical_url / enriched_article_id → public_article_id マップ ──
      const candidateByCanonical = new Map(candidates.map(c => [c.canonical_url, c]))
      const enrichedToPublic = new Map(
        upsertedRows.map(r => {
          const c = candidateByCanonical.get(r.canonical_url)!
          return [c.enriched_article_id, r.public_article_id]
        }),
      )

      // ── 6. public_article_sources を一括 UPSERT ───────────────────────
      const sourceRows = upsertedRows.map(r => {
        const c = candidateByCanonical.get(r.canonical_url)!
        return {
          public_article_id: r.public_article_id,
          enriched_article_id: c.enriched_article_id,
          source_target_id: c.source_target_id,
          source_priority: Number(c.priority_score ?? 100),
          is_primary: true,
        }
      })
      await sql`
        INSERT INTO public_article_sources ${sql(
          sourceRows,
          'public_article_id',
          'enriched_article_id',
          'source_target_id',
          'source_priority',
          'is_primary',
        )}
        ON CONFLICT (public_article_id, enriched_article_id) DO UPDATE SET
          source_priority = EXCLUDED.source_priority
      `

      // ── 7. タグを一括転写 ──────────────────────────────────────────────
      const enrichedIds = candidates.map(c => c.enriched_article_id)
      const allTags = (await sql`
        SELECT enriched_article_id, tag_id, is_primary
        FROM articles_enriched_tags
        WHERE enriched_article_id = ANY(${enrichedIds})
        ORDER BY enriched_article_id, is_primary DESC, tag_id
      `) as TagRow[]

      const publicIds = upsertedRows.map(r => r.public_article_id)
      await sql`DELETE FROM public_article_tags WHERE public_article_id = ANY(${publicIds})`

      const tagCountByEnriched = new Map<number, number>()
      const tagRows = allTags
        .map(t => {
          const publicArticleId = enrichedToPublic.get(t.enriched_article_id)
          if (!publicArticleId) return null
          const sortOrder = tagCountByEnriched.get(t.enriched_article_id) ?? 0
          tagCountByEnriched.set(t.enriched_article_id, sortOrder + 1)
          return { public_article_id: publicArticleId, tag_id: t.tag_id, sort_order: sortOrder }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)

      if (tagRows.length > 0) {
        await sql`
          INSERT INTO public_article_tags ${sql(tagRows, 'public_article_id', 'tag_id', 'sort_order')}
          ON CONFLICT (public_article_id, tag_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
        `
        tagsUpdated = tagRows.length
      }
    } catch (error) {
      // bulk 失敗時はバッチ全体を failed として記録
      const message = error instanceof Error ? error.message : 'Unknown bulk publish error'
      failed = candidates.length
      for (const candidate of candidates) {
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
  }

  // ── 8. publish_candidate=false になった記事を hidden に ──────────
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
