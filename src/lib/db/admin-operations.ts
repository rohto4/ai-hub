import { getSql } from '@/lib/db'
import { hasThumbnailTagRegistryEntry } from '@/lib/publish/thumbnail-tag-registry'
import { buildInternalThumbnailUrl } from '@/lib/publish/thumbnail-template'

type LogOptions = {
  operatorId?: string
  operationType: string
  targetKind: string
  targetId?: string
  payload?: Record<string, unknown>
}

export async function logAdminOperation(options: LogOptions): Promise<void> {
  const sql = getSql()
  await sql`
    INSERT INTO admin_operation_logs (operator_id, operation_type, target_kind, target_id, payload)
    VALUES (
      ${options.operatorId ?? null},
      ${options.operationType},
      ${options.targetKind},
      ${options.targetId ?? null},
      ${JSON.stringify(options.payload ?? {})}
    )
  `
}

export async function hidePublicArticle(publicArticleId: string): Promise<boolean> {
  const sql = getSql()
  const rows = (await sql`
    UPDATE public_articles
    SET visibility_status = 'hidden', updated_at = now()
    WHERE public_article_id = ${publicArticleId}
      AND visibility_status = 'published'
    RETURNING public_article_id
  `) as Array<{ public_article_id: string }>
  return rows.length > 0
}

export async function unhidePublicArticle(publicArticleId: string): Promise<boolean> {
  const sql = getSql()
  const rows = (await sql`
    UPDATE public_articles
    SET visibility_status = 'published', updated_at = now()
    WHERE public_article_id = ${publicArticleId}
      AND visibility_status = 'hidden'
    RETURNING public_article_id
  `) as Array<{ public_article_id: string }>
  return rows.length > 0
}

export async function setSourceActive(sourceTargetId: string, isActive: boolean): Promise<boolean> {
  const sql = getSql()
  const rows = (await sql`
    UPDATE source_targets
    SET is_active = ${isActive}, updated_at = now()
    WHERE source_target_id = ${sourceTargetId}
    RETURNING source_target_id
  `) as Array<{ source_target_id: string }>
  return rows.length > 0
}

export type TagCandidateStatus = 'candidate' | 'manual_review'

export async function listTagCandidates(
  limit = 100,
  status: TagCandidateStatus = 'candidate',
): Promise<Array<{
  tagKey: string
  normalizedTagKey: string
  displayName: string
  seenCount: number
  reviewStatus: string
  firstSeenAt: string
  lastSeenAt: string
  originTitle: string | null
  originSnippet: string | null
  hasThumbnailAsset: boolean
}>> {
  const sql = getSql()
  const rows = (await sql`
    SELECT
      tcp.candidate_key AS tag_key,
      tcp.display_name,
      tcp.seen_count,
      tcp.review_status,
      tcp.first_seen_at,
      tcp.last_seen_at,
      ar.title AS origin_title,
      ar.snippet AS origin_snippet
    FROM tag_candidate_pool tcp
    LEFT JOIN articles_raw ar ON ar.raw_article_id = tcp.latest_origin_raw_id
    WHERE tcp.review_status = ${status}
      AND tcp.seen_count >= 4
    ORDER BY tcp.seen_count DESC, tcp.last_seen_at DESC
    LIMIT ${limit}
  `) as Array<{
    tag_key: string
    display_name: string
    seen_count: string | number
    review_status: string
    first_seen_at: string
    last_seen_at: string
    origin_title: string | null
    origin_snippet: string | null
  }>
  return rows.map((row) => ({
    tagKey: row.tag_key,
    normalizedTagKey: normalizeTagKey(row.tag_key),
    displayName: row.display_name,
    seenCount: Number(row.seen_count),
    reviewStatus: row.review_status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    originTitle: row.origin_title,
    originSnippet: row.origin_snippet,
    hasThumbnailAsset: hasThumbnailTagRegistryEntry(normalizeTagKey(row.tag_key)),
  }))
}

export async function setTagCandidateStatus(
  tagKey: string,
  status: 'candidate' | 'manual_review' | 'rejected',
): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE tag_candidate_pool
    SET review_status = ${status}
    WHERE candidate_key = ${tagKey}
  `
}

export async function promoteTagToMaster(
  tagKey: string,
  displayName: string,
): Promise<{
  tagId: string
  normalizedTagKey: string
  taggedEnrichedCount: number
  taggedPublicCount: number
  hasThumbnailAsset: boolean
}> {
  const sql = getSql()

  // スペースをハイフンに正規化（URL-safe な tag_key にする）
  const normalizedKey = normalizeTagKey(tagKey)

  // tags_master に昇格
  const rows = (await sql`
    INSERT INTO tags_master (tag_key, display_name)
    VALUES (${normalizedKey}, ${displayName})
    ON CONFLICT (tag_key) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()
    RETURNING tag_id::text
  `) as Array<{ tag_id: string }>
  const tagId = rows[0]!.tag_id

  // candidate_key（元の表記、スペースあり）を tag_keywords に登録（テキストマッチ用）
  await sql`
    INSERT INTO tag_keywords (tag_id, keyword)
    VALUES (${tagId}::uuid, ${tagKey})
    ON CONFLICT (tag_id, keyword) DO NOTHING
  `

  // tag_candidate_pool の status を promoted に更新
  await sql`
    UPDATE tag_candidate_pool
    SET review_status = 'promoted'
    WHERE candidate_key = ${tagKey}
  `

  // 根拠記事へのタグ付け: candidate_key を含む articles_enriched を対象
  const keyword = `%${tagKey}%`  // candidate_key（スペースあり）でマッチング
  const enrichedResult = (await sql`
    INSERT INTO articles_enriched_tags (enriched_article_id, tag_id, is_primary, tag_source)
    SELECT ae.enriched_article_id, ${tagId}::uuid, false, 'candidate_promoted'
    FROM articles_enriched ae
    WHERE ae.ai_processing_state = 'completed'
      AND (
        ae.title       ILIKE ${keyword}
        OR ae.summary_100  ILIKE ${keyword}
        OR ae.summary_200  ILIKE ${keyword}
      )
    ON CONFLICT (enriched_article_id, tag_id) DO NOTHING
    RETURNING enriched_article_id
  `) as Array<{ enriched_article_id: string }>

  // 公開記事の public_article_tags にも反映
  const publicResult = (await sql`
    INSERT INTO public_article_tags (public_article_id, tag_id, sort_order)
    SELECT
      pa.public_article_id,
      ${tagId}::uuid,
      COALESCE(
        (SELECT MAX(sort_order) + 1 FROM public_article_tags WHERE public_article_id = pa.public_article_id),
        0
      )
    FROM public_articles pa
    JOIN articles_enriched ae ON ae.enriched_article_id = pa.enriched_article_id
    WHERE pa.visibility_status = 'published'
      AND (
        ae.title       ILIKE ${keyword}
        OR ae.summary_100  ILIKE ${keyword}
        OR ae.summary_200  ILIKE ${keyword}
      )
    ON CONFLICT (public_article_id, tag_id) DO NOTHING
    RETURNING public_article_id
  `) as Array<{ public_article_id: string }>
  await refreshThumbnailUrlsForTagId(tagId)

  return {
    tagId,
    normalizedTagKey: normalizedKey,
    taggedEnrichedCount: enrichedResult.length,
    taggedPublicCount: publicResult.length,
    hasThumbnailAsset: hasThumbnailTagRegistryEntry(normalizedKey),
  }
}

function normalizeTagKey(tagKey: string): string {
  return tagKey
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export async function addTagKeyword(tagId: string, keyword: string): Promise<{
  taggedEnrichedCount: number
  taggedPublicCount: number
  refreshedEnrichedCount: number
  refreshedPublicCount: number
}> {
  const sql = getSql()
  const normalizedKeyword = keyword.trim()

  await sql`
    INSERT INTO tag_keywords (tag_id, keyword)
    VALUES (${tagId}, ${normalizedKeyword})
    ON CONFLICT (tag_id, keyword) DO NOTHING
  `

  const keywordPattern = `%${normalizedKeyword}%`
  const enrichedResult = (await sql`
    INSERT INTO articles_enriched_tags (enriched_article_id, tag_id, is_primary, tag_source)
    SELECT ae.enriched_article_id, ${tagId}::uuid, false, 'keyword_added'
    FROM articles_enriched ae
    WHERE ae.ai_processing_state = 'completed'
      AND (
        ae.title ILIKE ${keywordPattern}
        OR ae.summary_100 ILIKE ${keywordPattern}
        OR ae.summary_200 ILIKE ${keywordPattern}
      )
    ON CONFLICT (enriched_article_id, tag_id) DO NOTHING
    RETURNING enriched_article_id
  `) as Array<{ enriched_article_id: string }>

  const publicResult = (await sql`
    INSERT INTO public_article_tags (public_article_id, tag_id, sort_order)
    SELECT
      pa.public_article_id,
      ${tagId}::uuid,
      COALESCE(
        (SELECT MAX(sort_order) + 1 FROM public_article_tags WHERE public_article_id = pa.public_article_id),
        0
      )
    FROM public_articles pa
    JOIN articles_enriched ae ON ae.enriched_article_id = pa.enriched_article_id
    WHERE pa.visibility_status = 'published'
      AND (
        ae.title ILIKE ${keywordPattern}
        OR ae.summary_100 ILIKE ${keywordPattern}
        OR ae.summary_200 ILIKE ${keywordPattern}
      )
    ON CONFLICT (public_article_id, tag_id) DO NOTHING
    RETURNING public_article_id
  `) as Array<{ public_article_id: string }>

  const refreshed = await refreshThumbnailUrlsForTagId(tagId)

  return {
    taggedEnrichedCount: enrichedResult.length,
    taggedPublicCount: publicResult.length,
    refreshedEnrichedCount: refreshed.refreshedEnrichedCount,
    refreshedPublicCount: refreshed.refreshedPublicCount,
  }
}

type ThumbnailRefreshRow = {
  enriched_article_id: string | number
  canonical_url: string
  title: string
  summary_100: string
  summary_200: string | null
  source_type: 'official' | 'blog' | 'news' | 'video' | 'alerts' | 'paper'
  source_category: 'llm' | 'agent' | 'voice' | 'policy' | 'safety' | 'search' | 'news'
  content_language: 'ja' | 'en' | null
  thumbnail_bg_theme: string | null
  tag_key: string | null
  display_name: string | null
}

function groupThumbnailRefreshRows(rows: ThumbnailRefreshRow[]) {
  const grouped = new Map<number, {
    enrichedArticleId: number
    canonicalUrl: string
    title: string
    summary100: string
    summary200: string | null
    sourceType: ThumbnailRefreshRow['source_type']
    sourceCategory: ThumbnailRefreshRow['source_category']
    contentLanguage: ThumbnailRefreshRow['content_language']
    thumbnailBgTheme: string | null
    matchedTags: Array<{ tagKey: string; displayName: string }>
  }>()

  for (const row of rows) {
    const enrichedArticleId = Number(row.enriched_article_id)
    const existing = grouped.get(enrichedArticleId)
    if (existing) {
      if (row.tag_key && row.display_name) {
        existing.matchedTags.push({ tagKey: row.tag_key, displayName: row.display_name })
      }
      continue
    }

    grouped.set(enrichedArticleId, {
      enrichedArticleId,
      canonicalUrl: row.canonical_url,
      title: row.title,
      summary100: row.summary_100,
      summary200: row.summary_200,
      sourceType: row.source_type,
      sourceCategory: row.source_category,
      contentLanguage: row.content_language,
      thumbnailBgTheme: row.thumbnail_bg_theme,
      matchedTags: row.tag_key && row.display_name
        ? [{ tagKey: row.tag_key, displayName: row.display_name }]
        : [],
    })
  }

  return [...grouped.values()]
}

export async function refreshThumbnailUrlsForTagId(tagId: string): Promise<{
  refreshedEnrichedCount: number
  refreshedPublicCount: number
}> {
  const sql = getSql()
  const rows = (await sql`
    SELECT
      ae.enriched_article_id,
      ae.canonical_url,
      ae.title,
      ae.summary_100,
      ae.summary_200,
      ae.source_type,
      ae.source_category,
      ae.content_language,
      ae.thumbnail_bg_theme,
      tm.tag_key,
      tm.display_name
    FROM articles_enriched ae
    JOIN articles_enriched_tags aet_filter ON aet_filter.enriched_article_id = ae.enriched_article_id
      AND aet_filter.tag_id = ${tagId}::uuid
    LEFT JOIN articles_enriched_tags aet ON aet.enriched_article_id = ae.enriched_article_id
    LEFT JOIN tags_master tm ON tm.tag_id = aet.tag_id
    WHERE ae.ai_processing_state = 'completed'
      AND ae.dedupe_status = 'unique'
    ORDER BY ae.enriched_article_id ASC, aet.is_primary DESC, tm.display_name ASC
  `) as ThumbnailRefreshRow[]

  const articles = groupThumbnailRefreshRows(rows)
  for (const article of articles) {
    const thumbnailUrl = buildInternalThumbnailUrl({
      canonicalUrl: article.canonicalUrl,
      title: article.title,
      summary100: article.summary100,
      summary200: article.summary200,
      sourceType: article.sourceType,
      sourceCategory: article.sourceCategory,
      contentLanguage: article.contentLanguage,
      matchedTags: article.matchedTags,
      thumbnailBgTheme: article.thumbnailBgTheme,
    })

    await sql`
      UPDATE articles_enriched
      SET thumbnail_url = ${thumbnailUrl}, updated_at = now()
      WHERE enriched_article_id = ${article.enrichedArticleId}
    `
  }

  const enrichedArticleIds = articles.map((article) => article.enrichedArticleId)
  if (enrichedArticleIds.length === 0) {
    return { refreshedEnrichedCount: 0, refreshedPublicCount: 0 }
  }

  const synced = (await sql`
    UPDATE public_articles pa
    SET thumbnail_url = ae.thumbnail_url, updated_at = now()
    FROM articles_enriched ae
    WHERE ae.enriched_article_id = pa.enriched_article_id
      AND pa.enriched_article_id = ANY(${enrichedArticleIds}::bigint[])
      AND pa.thumbnail_url IS DISTINCT FROM ae.thumbnail_url
    RETURNING pa.public_article_id
  `) as Array<{ public_article_id: string }>

  return {
    refreshedEnrichedCount: articles.length,
    refreshedPublicCount: synced.length,
  }
}

export async function listAdminSources(): Promise<Array<{
  sourceTargetId: string
  sourceKey: string
  displayName: string
  sourceType: string
  isActive: boolean
  contentLanguage: string | null
  baseUrl: string | null
}>> {
  const sql = getSql()
  const rows = (await sql`
    SELECT source_target_id, source_key, display_name, source_type, is_active, content_language, base_url
    FROM source_targets
    ORDER BY source_type, display_name
  `) as Array<{
    source_target_id: string
    source_key: string
    display_name: string
    source_type: string
    is_active: boolean
    content_language: string | null
    base_url: string | null
  }>
  return rows.map((row) => ({
    sourceTargetId: row.source_target_id,
    sourceKey: row.source_key,
    displayName: row.display_name,
    sourceType: row.source_type,
    isActive: row.is_active,
    contentLanguage: row.content_language,
    baseUrl: row.base_url,
  }))
}
