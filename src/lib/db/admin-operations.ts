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

export async function listTagCandidates(limit = 100): Promise<Array<{
  tagKey: string
  displayName: string
  seenCount: number
  reviewStatus: string
  firstSeenAt: string
  lastSeenAt: string
}>> {
  const sql = getSql()
  const rows = (await sql`
    SELECT candidate_key AS tag_key, display_name, seen_count, review_status,
           first_seen_at, last_seen_at
    FROM tag_candidate_pool
    WHERE review_status = 'candidate'
    ORDER BY seen_count DESC, last_seen_at DESC
    LIMIT ${limit}
  `) as Array<{
    tag_key: string
    display_name: string
    seen_count: string | number
    review_status: string
    first_seen_at: string
    last_seen_at: string
  }>
  return rows.map((row) => ({
    tagKey: row.tag_key,
    displayName: row.display_name,
    seenCount: Number(row.seen_count),
    reviewStatus: row.review_status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }))
}

export async function promoteTagToMaster(tagKey: string, displayName: string): Promise<string> {
  const sql = getSql()
  const rows = (await sql`
    INSERT INTO tags_master (tag_key, display_name)
    VALUES (${tagKey}, ${displayName})
    ON CONFLICT (tag_key) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()
    RETURNING tag_id::text
  `) as Array<{ tag_id: string }>
  // tag_candidate_pool の status を promoted に更新
  await sql`
    UPDATE tag_candidate_pool
    SET review_status = 'promoted'
    WHERE candidate_key = ${tagKey}
  `
  return rows[0]!.tag_id
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
