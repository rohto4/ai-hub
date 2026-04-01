#!/usr/bin/env npx tsx
/**
 * public_article_sources のバックフィル
 * hourly-publish-sources.ts の bigint 型バグ修正後に全記事を再同期する
 * Usage: npx tsx scripts/backfill-public-article-sources.ts
 */
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

import { getSql } from '@/lib/db'
import { syncPublicArticleSources } from '@/lib/publish/hourly-publish-sources'
import type { PublishCandidate, UpsertedRow } from '@/lib/publish/hourly-publish-shared'

const CHUNK_SIZE = 200

async function backfillPublicArticleSources() {
  const sql = getSql()

  // 公開中の全記事と対応する enriched 情報を取得
  const rows = (await sql`
    SELECT
      pa.public_article_id,
      pa.canonical_url,
      ae.enriched_article_id,
      ae.source_target_id,
      st.source_key,
      st.display_name AS source_display_name,
      ae.source_category,
      ae.source_type,
      ae.content_language,
      ae.dedupe_group_key,
      ae.summary_input_basis,
      ae.publication_basis,
      ae.summary_100,
      ae.summary_200,
      ae.publication_text,
      ae.score,
      ae.source_updated_at,
      ae.thumbnail_url,
      ae.thumbnail_bg_theme
    FROM public_articles pa
    JOIN articles_enriched ae ON ae.enriched_article_id = pa.enriched_article_id
    JOIN source_targets st ON st.source_target_id = ae.source_target_id
    WHERE pa.visibility_status = 'published'
    ORDER BY pa.created_at DESC
  `) as Array<{
    public_article_id: string
    canonical_url: string
    enriched_article_id: string | number
    source_target_id: string
    source_key: string
    source_display_name: string
    source_category: string
    source_type: string
    content_language: 'ja' | 'en' | null
    dedupe_group_key: string | null
    summary_input_basis: string
    publication_basis: string
    summary_100: string
    summary_200: string | null
    publication_text: string | null
    score: string | number
    source_updated_at: string | null
    thumbnail_url: string | null
    thumbnail_bg_theme: string | null
  }>

  console.log(`対象記事: ${rows.length} 件`)

  let totalInserted = 0
  let chunkIndex = 0

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    chunkIndex++

    const upsertedRows: UpsertedRow[] = chunk.map((row) => ({
      public_article_id: row.public_article_id,
      canonical_url: row.canonical_url,
    }))

    const candidateByCanonical = new Map<string, PublishCandidate>(
      chunk.map((row) => [
        row.canonical_url,
        {
          enriched_article_id: Number(row.enriched_article_id),
          source_target_id: row.source_target_id,
          source_key: row.source_key,
          source_display_name: row.source_display_name,
          canonical_url: row.canonical_url,
          title: '',
          summary_100: row.summary_100,
          summary_200: row.summary_200,
          publication_text: row.publication_text,
          source_category: row.source_category,
          source_type: row.source_type,
          content_language: row.content_language,
          dedupe_group_key: row.dedupe_group_key,
          summary_input_basis: row.summary_input_basis,
          publication_basis: row.publication_basis,
          score: row.score,
          source_updated_at: row.source_updated_at,
          thumbnail_url: row.thumbnail_url,
          thumbnail_bg_theme: row.thumbnail_bg_theme,
          priority_score: null,
        },
      ]),
    )

    await syncPublicArticleSources(sql, upsertedRows, candidateByCanonical)
    totalInserted += chunk.length
    console.log(`chunk ${chunkIndex}: ${totalInserted}/${rows.length} 処理済み`)
  }

  const afterCount = (await sql`SELECT COUNT(*) AS cnt FROM public_article_sources`) as Array<{ cnt: string }>
  console.log(`完了: public_article_sources = ${afterCount[0]?.cnt ?? '?'} 件`)
  process.exit(0)
}

backfillPublicArticleSources().catch((error) => {
  console.error(error)
  process.exit(1)
})
