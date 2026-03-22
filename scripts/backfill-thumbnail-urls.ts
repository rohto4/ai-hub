#!/usr/bin/env npx tsx
/**
 * thumbnail_url のバックフィル
 *
 * 方針:
 * - AI は使わない
 * - 既存の title / summary / source_* / content_language / tags から再計算する
 * - articles_enriched.thumbnail_url を更新した後、public_articles.thumbnail_url へ同期する
 *
 * Usage:
 *   npx tsx scripts/backfill-thumbnail-urls.ts
 */
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

import { getSql } from '@/lib/db'
import { buildInternalThumbnailUrl } from '@/lib/publish/thumbnail-template'

type SourceType = 'official' | 'blog' | 'news' | 'video' | 'alerts' | 'paper'
type SourceCategory = 'llm' | 'agent' | 'voice' | 'policy' | 'safety' | 'search' | 'news'
type ContentLanguage = 'ja' | 'en' | null

type EnrichedThumbnailRow = {
  enriched_article_id: string | number
  canonical_url: string
  title: string
  summary_100: string
  summary_200: string | null
  source_type: SourceType
  source_category: SourceCategory
  content_language: ContentLanguage
  tag_key: string | null
  display_name: string | null
}

type ThumbnailRecord = {
  enrichedArticleId: number
  canonicalUrl: string
  title: string
  summary100: string
  summary200: string | null
  sourceType: SourceType
  sourceCategory: SourceCategory
  contentLanguage: ContentLanguage
  matchedTags: Array<{ tagKey: string; displayName: string }>
}

const CHUNK_SIZE = 200

function groupRows(rows: EnrichedThumbnailRow[]): ThumbnailRecord[] {
  const grouped = new Map<number, ThumbnailRecord>()

  for (const row of rows) {
    const enrichedArticleId = Number(row.enriched_article_id)
    const existing = grouped.get(enrichedArticleId)
    if (existing) {
      if (row.tag_key && row.display_name) {
        existing.matchedTags.push({
          tagKey: row.tag_key,
          displayName: row.display_name,
        })
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
      matchedTags: row.tag_key && row.display_name
        ? [{ tagKey: row.tag_key, displayName: row.display_name }]
        : [],
    })
  }

  return [...grouped.values()]
}

async function backfillThumbnailUrls() {
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
      tm.tag_key,
      tm.display_name
    FROM articles_enriched ae
    LEFT JOIN articles_enriched_tags aet ON aet.enriched_article_id = ae.enriched_article_id
    LEFT JOIN tags_master tm ON tm.tag_id = aet.tag_id
    WHERE ae.ai_processing_state = 'completed'
      AND ae.dedupe_status = 'unique'
    ORDER BY ae.enriched_article_id ASC, aet.is_primary DESC, tm.display_name ASC
  `) as EnrichedThumbnailRow[]

  const articles = groupRows(rows)
  console.log(`thumbnail backfill 対象: ${articles.length} 件`)

  let updatedEnriched = 0
  for (let index = 0; index < articles.length; index += CHUNK_SIZE) {
    const chunk = articles.slice(index, index + CHUNK_SIZE)

    for (const article of chunk) {
      const thumbnailUrl = buildInternalThumbnailUrl({
        canonicalUrl: article.canonicalUrl,
        title: article.title,
        summary100: article.summary100,
        summary200: article.summary200,
        sourceType: article.sourceType,
        sourceCategory: article.sourceCategory,
        contentLanguage: article.contentLanguage,
        matchedTags: article.matchedTags,
      })

      await sql`
        UPDATE articles_enriched
        SET thumbnail_url = ${thumbnailUrl}, updated_at = now()
        WHERE enriched_article_id = ${article.enrichedArticleId}
      `
      updatedEnriched += 1
    }

    console.log(`articles_enriched: ${Math.min(index + CHUNK_SIZE, articles.length)}/${articles.length}`)
  }

  const publicResult = (await sql`
    UPDATE public_articles pa
    SET
      thumbnail_url = ae.thumbnail_url,
      updated_at = now()
    FROM articles_enriched ae
    WHERE ae.enriched_article_id = pa.enriched_article_id
      AND pa.thumbnail_url IS DISTINCT FROM ae.thumbnail_url
    RETURNING pa.public_article_id
  `) as Array<{ public_article_id: string }>

  console.log(`articles_enriched 更新: ${updatedEnriched} 件`)
  console.log(`public_articles 同期: ${publicResult.length} 件`)
}

backfillThumbnailUrls().catch((error) => {
  console.error(error)
  process.exit(1)
})
