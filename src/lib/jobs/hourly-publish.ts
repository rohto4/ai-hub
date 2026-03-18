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

// フォールバック時に試す束のサイズ。調整はここだけ。
const FALLBACK_BATCH_SIZE = 10

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

function toChunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
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

  // ── Tier-1 / Tier-2 共通: batch を bulk UPSERT する内部関数 ───────
  // 成功時は { upserted, tagsUpdated } を返す。失敗時は throw する。
  async function bulkBatch(
    batch: PublishCandidate[],
  ): Promise<{ upserted: number; tagsUpdated: number }> {
    const canonicalUrls = batch.map(c => c.canonical_url)
    const existingRows = (await sql`
      SELECT canonical_url, public_key
      FROM public_articles
      WHERE canonical_url = ANY(${canonicalUrls})
    `) as Array<{ canonical_url: string; public_key: string }>
    const existingKeyMap = new Map(existingRows.map(r => [r.canonical_url, r.public_key]))

    const now = new Date()
    const articleRows = batch.map(c => {
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

    const candidateByCanonical = new Map(batch.map(c => [c.canonical_url, c]))
    const enrichedToPublic = new Map(
      upsertedRows.map(r => {
        const c = candidateByCanonical.get(r.canonical_url)!
        return [c.enriched_article_id, r.public_article_id]
      }),
    )

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

    const enrichedIds = batch.map(c => c.enriched_article_id)
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
    }

    return { upserted: upsertedRows.length, tagsUpdated: tagRows.length }
  }

  // ── Tier-3: 記事単位の処理（壊れた1件を特定・隔離する最終手段）───
  async function publishOne(c: PublishCandidate): Promise<number> {
    const existing = (await sql`
      SELECT public_article_id, public_key
      FROM public_articles
      WHERE canonical_url = ${c.canonical_url}
      LIMIT 1
    `) as Array<{ public_article_id: string; public_key: string }>

    const publicKey = existing[0]?.public_key ?? nanoid(11)
    const displaySummary = c.publication_text ?? c.summary_200 ?? c.summary_100
    const thumbnailEmoji = pickThumbnailEmoji({
      title: c.title,
      summary100: c.summary_100,
      summary200: displaySummary,
      sourceType: c.source_type,
      sourceCategory: c.source_category,
    })

    const upsertedRow = (await sql`
      INSERT INTO public_articles (
        enriched_article_id, primary_source_target_id, public_key, canonical_url,
        display_title, display_summary_100, display_summary_200,
        thumbnail_url, thumbnail_emoji, source_category, source_type,
        summary_input_basis, publication_basis, content_score,
        original_published_at, visibility_status, public_refreshed_at
      )
      VALUES (
        ${c.enriched_article_id}, ${c.source_target_id}, ${publicKey}, ${c.canonical_url},
        ${c.title}, ${c.summary_100}, ${displaySummary}, ${c.thumbnail_url}, ${thumbnailEmoji},
        ${c.source_category}, ${c.source_type}, ${c.summary_input_basis}, ${c.publication_basis},
        ${Number(c.score)}, ${c.source_updated_at}, 'published', now()
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
    `) as Array<{ public_article_id: string }>

    const publicArticleId = upsertedRow[0].public_article_id

    await sql`
      INSERT INTO public_article_sources (
        public_article_id, enriched_article_id, source_target_id, source_priority, is_primary
      )
      VALUES (
        ${publicArticleId}, ${c.enriched_article_id},
        ${c.source_target_id}, ${Number(c.priority_score ?? 100)}, true
      )
      ON CONFLICT (public_article_id, enriched_article_id) DO UPDATE SET
        source_priority = EXCLUDED.source_priority
    `

    const tags = (await sql`
      SELECT tag_id, is_primary
      FROM articles_enriched_tags
      WHERE enriched_article_id = ${c.enriched_article_id}
      ORDER BY is_primary DESC
    `) as Array<{ tag_id: string; is_primary: boolean }>

    let articleTagsUpdated = 0
    if (tags.length > 0) {
      await sql`DELETE FROM public_article_tags WHERE public_article_id = ${publicArticleId}`
      for (const [idx, tag] of tags.entries()) {
        await sql`
          INSERT INTO public_article_tags (public_article_id, tag_id, sort_order)
          VALUES (${publicArticleId}, ${tag.tag_id}, ${idx})
          ON CONFLICT (public_article_id, tag_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
        `
      }
      articleTagsUpdated = tags.length
    }

    return articleTagsUpdated
  }

  // ── 2. 3段階フォールバック ─────────────────────────────────────────
  if (candidates.length > 0) {
    try {
      // Tier 1: 全件 bulk（通常ケース）
      const result = await bulkBatch(candidates)
      upserted += result.upserted
      tagsUpdated += result.tagsUpdated
    } catch (tier1Error) {
      // Tier 2: FALLBACK_BATCH_SIZE 件ずつの bulk
      // → 原因の束を FALLBACK_BATCH_SIZE 件以内に絞る
      console.warn(
        `[hourly-publish] Tier-1 bulk failed (${candidates.length} articles). Switching to batch-of-${FALLBACK_BATCH_SIZE}:`,
        tier1Error instanceof Error ? tier1Error.message : tier1Error,
      )

      for (const chunk of toChunks(candidates, FALLBACK_BATCH_SIZE)) {
        try {
          const result = await bulkBatch(chunk)
          upserted += result.upserted
          tagsUpdated += result.tagsUpdated
        } catch (tier2Error) {
          // Tier 3: このチャンク内を1件ずつ処理して壊れた記事を特定・隔離
          console.warn(
            `[hourly-publish] Tier-2 batch-of-${FALLBACK_BATCH_SIZE} failed (enriched_ids: ${chunk.map(c => c.enriched_article_id).join(',')}). Switching to per-article:`,
            tier2Error instanceof Error ? tier2Error.message : tier2Error,
          )

          for (const candidate of chunk) {
            try {
              const articleTagsUpdated = await publishOne(candidate)
              upserted++
              tagsUpdated += articleTagsUpdated
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
        }
      }
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
