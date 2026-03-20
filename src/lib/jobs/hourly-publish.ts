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

// チャンクサイズ設定
const BULK_CHUNK_SIZE = 200     // 通常処理: 200 件ずつ
const FALLBACK_BATCH_SIZE = 10  // Tier-2 フォールバック

type PublishCandidate = {
  enriched_article_id: number
  source_target_id: string
  source_key: string
  source_display_name: string
  canonical_url: string
  title: string
  summary_100: string
  summary_200: string | null
  publication_text: string | null
  source_category: string
  source_type: string
  dedupe_group_key: string | null
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

type RelatedSourceRow = {
  representative_enriched_article_id: number
  source_enriched_article_id: number
  source_target_id: string | null
  source_key: string | null
  source_display_name: string | null
  source_priority: string | number | null
  is_primary: boolean
  selection_status: 'selected' | 'supporting' | 'rejected'
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
      st.source_key,
      st.display_name AS source_display_name,
      ae.canonical_url,
      ae.title,
      ae.summary_100,
      ae.summary_200,
      ae.publication_text,
      ae.source_category,
      ae.source_type,
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

  let upserted = 0
  let tagsUpdated = 0
  let failed = 0

  async function syncPublicArticleSources(
    rows: UpsertedRow[],
    candidateByCanonical: Map<string, PublishCandidate>,
  ): Promise<void> {
    if (rows.length === 0) {
      return
    }

    const publicArticleIds = rows.map((row) => row.public_article_id)
    const representativeEnrichedIds = rows
      .map((row) => candidateByCanonical.get(row.canonical_url)?.enriched_article_id)
      .filter((value): value is number => typeof value === 'number')

    const representativeToPublic = new Map<number, string>()
    for (const row of rows) {
      const candidate = candidateByCanonical.get(row.canonical_url)
      if (candidate) {
        representativeToPublic.set(candidate.enriched_article_id, row.public_article_id)
      }
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
        if (!publicArticleId || !row.source_key || !row.source_display_name) {
          return null
        }
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

    if (insertRows.length === 0) {
      return
    }

    const rPaIds = insertRows.map(r => r.public_article_id)
    const rEaIds = insertRows.map(r => r.enriched_article_id)
    const rStIds = insertRows.map(r => r.source_target_id ?? null)
    const rSourceKeys = insertRows.map(r => r.source_key)
    const rSourceDisplayNames = insertRows.map(r => r.source_display_name)
    const rSourcePriorities = insertRows.map(r => r.source_priority)
    const rIsPrimaries = insertRows.map(r => r.is_primary)
    const rSelectionStatuses = insertRows.map(r => r.selection_status)

    await sql`
      INSERT INTO public_article_sources (
        public_article_id, enriched_article_id, source_target_id,
        source_key, source_display_name, source_priority, is_primary, selection_status
      )
      SELECT
        pa_id::uuid, ea_id::bigint, NULLIF(st_id, '')::uuid,
        sk, sdn, sp::numeric, ip, ss
      FROM unnest(
        ${rPaIds}::text[],
        ${rEaIds}::bigint[],
        ${rStIds}::text[],
        ${rSourceKeys}::text[],
        ${rSourceDisplayNames}::text[],
        ${rSourcePriorities}::numeric[],
        ${rIsPrimaries}::boolean[],
        ${rSelectionStatuses}::text[]
      ) AS t(pa_id, ea_id, st_id, sk, sdn, sp, ip, ss)
      ON CONFLICT (public_article_id, enriched_article_id) DO UPDATE SET
        source_target_id     = EXCLUDED.source_target_id,
        source_key           = EXCLUDED.source_key,
        source_display_name  = EXCLUDED.source_display_name,
        source_priority      = EXCLUDED.source_priority,
        is_primary           = EXCLUDED.is_primary,
        selection_status     = EXCLUDED.selection_status
    `
  }

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

    // unnest 用の列配列を準備
    const eaIds: number[] = []
    const stIds: (string | null)[] = []
    const pKeys: string[] = []
    const cUrls: string[] = []
    const titles: string[] = []
    const sum100s: string[] = []
    const sum200s: (string | null)[] = []
    const tUrls: (string | null)[] = []
    const tEmojis: (string | null)[] = []
    const sCats: string[] = []
    const sTypes: string[] = []
    const sibases: string[] = []
    const pbases: string[] = []
    const scores: number[] = []
    const pubAts: (string | null)[] = []

    for (const c of batch) {
      const displaySummary = c.publication_text ?? c.summary_200 ?? c.summary_100
      eaIds.push(Number(c.enriched_article_id))
      stIds.push(c.source_target_id ?? null)
      pKeys.push(existingKeyMap.get(c.canonical_url) ?? nanoid(11))
      cUrls.push(c.canonical_url)
      titles.push(c.title)
      sum100s.push(c.summary_100)
      sum200s.push(displaySummary ?? null)
      tUrls.push(c.thumbnail_url ?? null)
      tEmojis.push(pickThumbnailEmoji({
        title: c.title,
        summary100: c.summary_100,
        summary200: displaySummary,
        sourceType: c.source_type,
        sourceCategory: c.source_category,
      }))
      sCats.push(c.source_category)
      sTypes.push(c.source_type)
      sibases.push(c.summary_input_basis)
      pbases.push(c.publication_basis)
      scores.push(Number(c.score))
      pubAts.push(c.source_updated_at ?? null)
    }

    const upsertedRows = (await sql`
      INSERT INTO public_articles (
        enriched_article_id, primary_source_target_id, public_key, canonical_url,
        display_title, display_summary_100, display_summary_200,
        thumbnail_url, thumbnail_emoji,
        source_category, source_type, summary_input_basis, publication_basis,
        content_score, original_published_at, visibility_status, public_refreshed_at
      )
      SELECT
        ea_id::bigint,
        NULLIF(st_id, '')::uuid,
        pkey, curl, title, s100, s200, turl, temoji,
        scat, stype, sibasis, pbasis,
        score::numeric, NULLIF(pubat, '')::timestamptz,
        'published', now()
      FROM unnest(
        ${eaIds}::bigint[],
        ${stIds}::text[],
        ${pKeys}::text[],
        ${cUrls}::text[],
        ${titles}::text[],
        ${sum100s}::text[],
        ${sum200s}::text[],
        ${tUrls}::text[],
        ${tEmojis}::text[],
        ${sCats}::text[],
        ${sTypes}::text[],
        ${sibases}::text[],
        ${pbases}::text[],
        ${scores}::numeric[],
        ${pubAts}::text[]
      ) AS t(ea_id, st_id, pkey, curl, title, s100, s200, turl, temoji, scat, stype, sibasis, pbasis, score, pubat)
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

    await syncPublicArticleSources(upsertedRows, candidateByCanonical)

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
      const tPaIds = tagRows.map(r => r.public_article_id)
      const tTagIds = tagRows.map(r => String(r.tag_id))
      const tSortOrders = tagRows.map(r => r.sort_order)
      await sql`
        INSERT INTO public_article_tags (public_article_id, tag_id, sort_order)
        SELECT pa_id::uuid, tag_id::uuid, sort_order::int
        FROM unnest(
          ${tPaIds}::text[],
          ${tTagIds}::text[],
          ${tSortOrders}::int[]
        ) AS t(pa_id, tag_id, sort_order)
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

    await syncPublicArticleSources(
      [{ public_article_id: publicArticleId, canonical_url: c.canonical_url }],
      new Map([[c.canonical_url, c]]),
    )

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
  // Tier-1: BULK_CHUNK_SIZE (200) 件ずつ処理（デフォルト・通常ケース）
  // Tier-2: FALLBACK_BATCH_SIZE (10) 件ずつ（Tier-1 チャンクが失敗した場合）
  // Tier-3: 1件ずつ（Tier-2 でも失敗した記事を特定・隔離）
  for (const chunk of toChunks(candidates, BULK_CHUNK_SIZE)) {
    try {
      const result = await bulkBatch(chunk)
      upserted += result.upserted
      tagsUpdated += result.tagsUpdated
    } catch (tier1Error) {
      console.warn(
        `[hourly-publish] Tier-1 chunk failed (${chunk.length} articles, ids: ${chunk[0]?.enriched_article_id}-${chunk[chunk.length - 1]?.enriched_article_id}). Switching to batch-of-${FALLBACK_BATCH_SIZE}:`,
        tier1Error instanceof Error ? tier1Error.message : tier1Error,
      )

      for (const smallChunk of toChunks(chunk, FALLBACK_BATCH_SIZE)) {
        try {
          const result = await bulkBatch(smallChunk)
          upserted += result.upserted
          tagsUpdated += result.tagsUpdated
        } catch (tier2Error) {
          console.warn(
            `[hourly-publish] Tier-2 batch-of-${FALLBACK_BATCH_SIZE} failed (enriched_ids: ${smallChunk.map(c => c.enriched_article_id).join(',')}). Switching to per-article:`,
            tier2Error instanceof Error ? tier2Error.message : tier2Error,
          )

          for (const candidate of smallChunk) {
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
