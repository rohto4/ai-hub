import { getSql } from '@/lib/db'

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
  displayName: string
  seenCount: number
  reviewStatus: string
  firstSeenAt: string
  lastSeenAt: string
  originTitle: string | null
  originSnippet: string | null
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
    displayName: row.display_name,
    seenCount: Number(row.seen_count),
    reviewStatus: row.review_status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    originTitle: row.origin_title,
    originSnippet: row.origin_snippet,
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
): Promise<{ tagId: string; taggedEnrichedCount: number; taggedPublicCount: number }> {
  const sql = getSql()

  // tags_master に昇格
  const rows = (await sql`
    INSERT INTO tags_master (tag_key, display_name)
    VALUES (${tagKey}, ${displayName})
    ON CONFLICT (tag_key) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()
    RETURNING tag_id::text
  `) as Array<{ tag_id: string }>
  const tagId = rows[0]!.tag_id

  // candidate_key を tag_keywords に自動登録（将来の enrich でも使われる）
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
  const keyword = `%${tagKey}%`
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

  return {
    tagId,
    taggedEnrichedCount: enrichedResult.length,
    taggedPublicCount: publicResult.length,
  }
}

export async function addTagKeyword(tagId: string, keyword: string): Promise<void> {
  const sql = getSql()
  await sql`
    INSERT INTO tag_keywords (tag_id, keyword)
    VALUES (${tagId}, ${keyword})
    ON CONFLICT (tag_id, keyword) DO NOTHING
  `
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
