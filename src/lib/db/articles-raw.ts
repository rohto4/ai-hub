import { createHash } from 'crypto'
import { getSql } from '@/lib/db'
import { normalizeUrl } from '@/lib/rss/normalize'
import type { CollectedItem, SourceTarget } from '@/lib/collectors/types'

type ExistingRawRow = {
  id: number
  source_updated_at: string | null
  snippet_hash: string | null
}

export type PersistRawResult = 'inserted' | 'updated' | 'skipped'

export interface PersistRawItemInput {
  sourceTarget: SourceTarget
  item: CollectedItem
  fetchRunAt?: string
}

function buildSnippetHash(item: CollectedItem): string {
  const base = `${item.title ?? ''}\n${item.snippet ?? ''}`.trim()
  return createHash('sha256').update(base).digest('hex')
}

function isNewerSourceUpdate(nextUpdatedAt: string | null, currentUpdatedAt: string | null): boolean {
  if (!nextUpdatedAt) {
    return false
  }
  if (!currentUpdatedAt) {
    return true
  }
  return new Date(nextUpdatedAt).getTime() > new Date(currentUpdatedAt).getTime()
}

export async function persistCollectedItem({
  sourceTarget,
  item,
  fetchRunAt = new Date().toISOString(),
}: PersistRawItemInput): Promise<PersistRawResult> {
  const sql = getSql()
  const normalizedUrl = normalizeUrl(item.citedUrl ?? item.sourceUrl)
  const snippetHash = buildSnippetHash(item)

  const existingRows = (await sql`
    SELECT id, source_updated_at, snippet_hash
    FROM articles_raw
    WHERE source_target_id = ${sourceTarget.id}
      AND normalized_url = ${normalizedUrl}
    ORDER BY fetch_run_at DESC, id DESC
    LIMIT 1
  `) as ExistingRawRow[]

  const existing = existingRows[0]
  const snippetChanged = existing ? existing.snippet_hash !== snippetHash : false
  const sourceUpdated = existing && sourceTarget.supportsUpdateDetection
    ? isNewerSourceUpdate(item.sourceUpdatedAt, existing.source_updated_at)
    : false
  const hasSourceUpdate = existing ? sourceUpdated || snippetChanged : false

  if (existing && !hasSourceUpdate) {
    return 'skipped'
  }

  await sql`
    INSERT INTO articles_raw (
      source_target_id,
      source_item_id,
      source_url,
      cited_url,
      normalized_url,
      title,
      snippet,
      snippet_hash,
      source_published_at,
      source_updated_at,
      source_author,
      source_meta,
      fetch_run_at,
      is_processed,
      has_source_update,
      process_after,
      last_error
    )
    VALUES (
      ${sourceTarget.id},
      ${item.sourceItemId},
      ${item.sourceUrl},
      ${item.citedUrl},
      ${normalizedUrl},
      ${item.title},
      ${item.snippet},
      ${snippetHash},
      ${item.sourcePublishedAt},
      ${item.sourceUpdatedAt},
      ${item.sourceAuthor},
      ${JSON.stringify(item.sourceMeta)}::jsonb,
      ${fetchRunAt},
      false,
      ${hasSourceUpdate},
      ${fetchRunAt},
      null
    )
  `

  return existing ? 'updated' : 'inserted'
}

export async function markLatestRawError(
  sourceTargetId: string,
  normalizedUrl: string,
  errorMessage: string,
): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE articles_raw
    SET last_error = ${errorMessage}
    WHERE id = (
      SELECT id
      FROM articles_raw
      WHERE source_target_id = ${sourceTargetId}
        AND normalized_url = ${normalizedUrl}
      ORDER BY fetch_run_at DESC, id DESC
      LIMIT 1
    )
  `
}
