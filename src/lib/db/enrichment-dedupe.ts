import { getSql } from '@/lib/db'
import type { DuplicateMatch } from '@/lib/db/enrichment-types'
import { buildHeadlineSignature } from '@/lib/text/normalize'

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export async function findDuplicateMatch(
  normalizedUrl: string,
  citedUrl: string | null,
  currentRawArticleId: number,
): Promise<DuplicateMatch | null> {
  const sql = getSql()
  const rows = (await (citedUrl
    ? sql`
        SELECT enriched_article_id, normalized_url, cited_url, dedupe_group_key
        FROM articles_enriched
        WHERE raw_article_id <> ${currentRawArticleId}
          AND (normalized_url = ${normalizedUrl} OR cited_url = ${citedUrl})
        ORDER BY processed_at DESC, enriched_article_id DESC
        LIMIT 1
      `
    : sql`
        SELECT enriched_article_id, normalized_url, cited_url, dedupe_group_key
        FROM articles_enriched
        WHERE raw_article_id <> ${currentRawArticleId}
          AND normalized_url = ${normalizedUrl}
        ORDER BY processed_at DESC, enriched_article_id DESC
        LIMIT 1
      `)) as Array<{
    enriched_article_id: number
    normalized_url: string
    cited_url: string | null
    dedupe_group_key: string | null
  }>

  const row = rows[0]
  if (!row) return null

  if (row.normalized_url === normalizedUrl) {
    return {
      dedupeStatus: 'url_duplicate',
      dedupeGroupKey: row.dedupe_group_key ?? normalizedUrl,
    }
  }

  return {
    dedupeStatus: 'source_duplicate',
    dedupeGroupKey: row.dedupe_group_key ?? citedUrl ?? normalizedUrl,
  }
}

export async function findSimilarTitleDuplicate(
  title: string,
  currentRawArticleId: number,
): Promise<DuplicateMatch | null> {
  const signature = buildHeadlineSignature(title)
  if (signature.length < 12) return null

  const sql = getSql()
  const rows = (await sql`
    SELECT enriched_article_id, title, dedupe_group_key
    FROM articles_enriched
    WHERE raw_article_id <> ${currentRawArticleId}
    ORDER BY processed_at DESC, enriched_article_id DESC
    LIMIT 200
  `) as Array<{
    enriched_article_id: number
    title: string
    dedupe_group_key: string | null
  }>

  const matched = rows.find((row) => buildHeadlineSignature(row.title) === signature)
  if (!matched) return null

  return {
    dedupeStatus: 'similar_candidate',
    dedupeGroupKey: matched.dedupe_group_key ?? `title:${signature}`,
  }
}

export async function findSemanticDuplicate(
  embedding: number[] | null | undefined,
  currentRawArticleId: number,
  threshold = 0.92,
): Promise<DuplicateMatch | null> {
  if (!embedding || embedding.length === 0) return null

  const sql = getSql()
  const vectorLiteral = toVectorLiteral(embedding)
  const rows = (await sql`
    SELECT
      enriched_article_id,
      dedupe_group_key,
      1 - (summary_embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM articles_enriched
    WHERE raw_article_id <> ${currentRawArticleId}
      AND summary_embedding IS NOT NULL
    ORDER BY summary_embedding <=> ${vectorLiteral}::vector ASC
    LIMIT 1
  `) as Array<{
    enriched_article_id: number
    dedupe_group_key: string | null
    similarity: string | number
  }>

  const row = rows[0]
  if (!row) return null

  const similarity = Number(row.similarity ?? 0)
  if (!Number.isFinite(similarity) || similarity < threshold) return null

  return {
    dedupeStatus: 'similar_candidate',
    dedupeGroupKey: row.dedupe_group_key ?? `semantic:${row.enriched_article_id}`,
    similarityScore: similarity,
  }
}
