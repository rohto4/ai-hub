import { nanoid } from 'nanoid'
import { pickThumbnailEmoji } from '@/lib/publish/thumbnail-emoji'
import type { PublishCandidate, SqlClient, UpsertedRow } from '@/lib/publish/hourly-publish-shared'
import { syncPublicArticleAdjacentTagsBulk, syncPublicArticleAdjacentTagsOne } from '@/lib/publish/hourly-publish-adjacent-tags'
import { syncPublicArticleSources } from '@/lib/publish/hourly-publish-sources'
import { syncPublicArticleTagsBulk, syncPublicArticleTagsOne } from '@/lib/publish/hourly-publish-tags'

export async function bulkPublishBatch(
  sql: SqlClient,
  batch: PublishCandidate[],
): Promise<{ upserted: number; tagsUpdated: number }> {
  const canonicalUrls = batch.map((candidate) => candidate.canonical_url)
  const existingRows = (await sql`
    SELECT canonical_url, public_key
    FROM public_articles
    WHERE canonical_url = ANY(${canonicalUrls})
  `) as Array<{ canonical_url: string; public_key: string }>
  const existingKeyMap = new Map(existingRows.map((row) => [row.canonical_url, row.public_key]))

  const enrichedArticleIds: number[] = []
  const sourceTargetIds: (string | null)[] = []
  const publicKeys: string[] = []
  const nextCanonicalUrls: string[] = []
  const titles: string[] = []
  const summary100s: string[] = []
  const summary200s: (string | null)[] = []
  const thumbnailUrls: (string | null)[] = []
  const thumbnailEmojis: (string | null)[] = []
  const thumbnailBgThemes: (string | null)[] = []
  const sourceCategories: string[] = []
  const sourceTypes: string[] = []
  const contentLanguages: (string | null)[] = []
  const summaryInputBases: string[] = []
  const publicationBases: string[] = []
  const scores: number[] = []
  const publishedAts: (string | null)[] = []

  for (const candidate of batch) {
    const displaySummary = candidate.publication_text ?? candidate.summary_200 ?? candidate.summary_100
    enrichedArticleIds.push(Number(candidate.enriched_article_id))
    sourceTargetIds.push(candidate.source_target_id ?? null)
    publicKeys.push(existingKeyMap.get(candidate.canonical_url) ?? nanoid(11))
    nextCanonicalUrls.push(candidate.canonical_url)
    titles.push(candidate.title)
    summary100s.push(candidate.summary_100)
    summary200s.push(displaySummary ?? null)
    thumbnailUrls.push(candidate.thumbnail_url ?? null)
    thumbnailBgThemes.push(candidate.thumbnail_bg_theme ?? null)
    thumbnailEmojis.push(
      pickThumbnailEmoji({
        title: candidate.title,
        summary100: candidate.summary_100,
        summary200: displaySummary,
        sourceType: candidate.source_type,
        sourceCategory: candidate.source_category,
      }),
    )
    sourceCategories.push(candidate.source_category)
    sourceTypes.push(candidate.source_type)
    contentLanguages.push(candidate.content_language)
    summaryInputBases.push(candidate.summary_input_basis)
    publicationBases.push(candidate.publication_basis)
    scores.push(Number(candidate.score))
    publishedAts.push(candidate.source_updated_at ?? null)
  }

  const upsertedRows = (await sql`
    INSERT INTO public_articles (
      enriched_article_id, primary_source_target_id, public_key, canonical_url,
      display_title, display_summary_100, display_summary_200,
      thumbnail_url, thumbnail_emoji, thumbnail_bg_theme,
      source_category, source_type, content_language, summary_input_basis, publication_basis,
      content_score, original_published_at, visibility_status, public_refreshed_at
    )
    SELECT
      enriched_article_id::bigint,
      NULLIF(source_target_id, '')::uuid,
      public_key, canonical_url, title, summary_100, summary_200, thumbnail_url, thumbnail_emoji, thumbnail_bg_theme,
      source_category, source_type, content_language, summary_input_basis, publication_basis,
      score::numeric, NULLIF(published_at, '')::timestamptz,
      'published', now()
    FROM unnest(
      ${enrichedArticleIds}::bigint[],
      ${sourceTargetIds}::text[],
      ${publicKeys}::text[],
      ${nextCanonicalUrls}::text[],
      ${titles}::text[],
      ${summary100s}::text[],
      ${summary200s}::text[],
      ${thumbnailUrls}::text[],
      ${thumbnailEmojis}::text[],
      ${thumbnailBgThemes}::text[],
      ${sourceCategories}::text[],
      ${sourceTypes}::text[],
      ${contentLanguages}::text[],
      ${summaryInputBases}::text[],
      ${publicationBases}::text[],
      ${scores}::numeric[],
      ${publishedAts}::text[]
    ) AS t(enriched_article_id, source_target_id, public_key, canonical_url, title, summary_100, summary_200, thumbnail_url, thumbnail_emoji, thumbnail_bg_theme, source_category, source_type, content_language, summary_input_basis, publication_basis, score, published_at)
    ON CONFLICT (canonical_url) DO UPDATE SET
      enriched_article_id      = EXCLUDED.enriched_article_id,
      primary_source_target_id = EXCLUDED.primary_source_target_id,
      display_title            = EXCLUDED.display_title,
      display_summary_100      = EXCLUDED.display_summary_100,
      display_summary_200      = EXCLUDED.display_summary_200,
      thumbnail_url            = EXCLUDED.thumbnail_url,
      thumbnail_emoji          = EXCLUDED.thumbnail_emoji,
      thumbnail_bg_theme       = EXCLUDED.thumbnail_bg_theme,
      source_category          = EXCLUDED.source_category,
      source_type              = EXCLUDED.source_type,
      content_language         = EXCLUDED.content_language,
      summary_input_basis      = EXCLUDED.summary_input_basis,
      publication_basis        = EXCLUDED.publication_basis,
      content_score            = EXCLUDED.content_score,
      original_published_at    = EXCLUDED.original_published_at,
      visibility_status        = 'published',
      public_refreshed_at      = now(),
      updated_at               = now()
    RETURNING public_article_id, canonical_url
  `) as UpsertedRow[]

  const candidateByCanonical = new Map(batch.map((candidate) => [candidate.canonical_url, candidate]))
  const enrichedToPublic = new Map(
    upsertedRows.map((row) => {
      const candidate = candidateByCanonical.get(row.canonical_url)!
      return [candidate.enriched_article_id, row.public_article_id] as const
    }),
  )

  await syncPublicArticleSources(sql, upsertedRows, candidateByCanonical)

  const tagsUpdated = await syncPublicArticleTagsBulk(
    sql,
    enrichedToPublic,
    batch.map((candidate) => candidate.enriched_article_id),
    upsertedRows.map((row) => row.public_article_id),
  )
  const adjacentTagsUpdated = await syncPublicArticleAdjacentTagsBulk(
    sql,
    enrichedToPublic,
    batch.map((candidate) => candidate.enriched_article_id),
    upsertedRows.map((row) => row.public_article_id),
  )

  return { upserted: upsertedRows.length, tagsUpdated: tagsUpdated + adjacentTagsUpdated }
}

export async function publishOne(
  sql: SqlClient,
  candidate: PublishCandidate,
): Promise<number> {
  const existingRows = (await sql`
    SELECT public_article_id, public_key
    FROM public_articles
    WHERE canonical_url = ${candidate.canonical_url}
    LIMIT 1
  `) as Array<{ public_article_id: string; public_key: string }>

  const publicKey = existingRows[0]?.public_key ?? nanoid(11)
  const displaySummary = candidate.publication_text ?? candidate.summary_200 ?? candidate.summary_100
  const thumbnailEmoji = pickThumbnailEmoji({
    title: candidate.title,
    summary100: candidate.summary_100,
    summary200: displaySummary,
    sourceType: candidate.source_type,
    sourceCategory: candidate.source_category,
  })

  const upsertedRows = (await sql`
    INSERT INTO public_articles (
      enriched_article_id, primary_source_target_id, public_key, canonical_url,
      display_title, display_summary_100, display_summary_200,
      thumbnail_url, thumbnail_emoji, thumbnail_bg_theme, source_category, source_type,
      content_language, summary_input_basis, publication_basis, content_score,
      original_published_at, visibility_status, public_refreshed_at
    )
    VALUES (
      ${candidate.enriched_article_id}, ${candidate.source_target_id}, ${publicKey}, ${candidate.canonical_url},
      ${candidate.title}, ${candidate.summary_100}, ${displaySummary}, ${candidate.thumbnail_url}, ${thumbnailEmoji}, ${candidate.thumbnail_bg_theme},
      ${candidate.source_category}, ${candidate.source_type}, ${candidate.content_language}, ${candidate.summary_input_basis}, ${candidate.publication_basis},
      ${Number(candidate.score)}, ${candidate.source_updated_at}, 'published', now()
    )
    ON CONFLICT (canonical_url) DO UPDATE SET
      enriched_article_id      = EXCLUDED.enriched_article_id,
      primary_source_target_id = EXCLUDED.primary_source_target_id,
      display_title            = EXCLUDED.display_title,
      display_summary_100      = EXCLUDED.display_summary_100,
      display_summary_200      = EXCLUDED.display_summary_200,
      thumbnail_url            = EXCLUDED.thumbnail_url,
      thumbnail_emoji          = EXCLUDED.thumbnail_emoji,
      thumbnail_bg_theme       = EXCLUDED.thumbnail_bg_theme,
      source_category          = EXCLUDED.source_category,
      source_type              = EXCLUDED.source_type,
      content_language         = EXCLUDED.content_language,
      summary_input_basis      = EXCLUDED.summary_input_basis,
      publication_basis        = EXCLUDED.publication_basis,
      content_score            = EXCLUDED.content_score,
      original_published_at    = EXCLUDED.original_published_at,
      visibility_status        = 'published',
      public_refreshed_at      = now(),
      updated_at               = now()
    RETURNING public_article_id
  `) as Array<{ public_article_id: string }>

  const publicArticleId = upsertedRows[0].public_article_id
  await syncPublicArticleSources(
    sql,
    [{ public_article_id: publicArticleId, canonical_url: candidate.canonical_url }],
    new Map([[candidate.canonical_url, candidate]]),
  )

  const primaryTagCount = await syncPublicArticleTagsOne(sql, candidate.enriched_article_id, publicArticleId)
  const adjacentTagCount = await syncPublicArticleAdjacentTagsOne(sql, candidate.enriched_article_id, publicArticleId)
  return primaryTagCount + adjacentTagCount
}
