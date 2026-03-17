#!/usr/bin/env node
/**
 * L2 記事タグ一括再付与スクリプト
 * Usage: node scripts/backfill-article-tags.mjs [--limit N] [--dry-run]
 *
 * articles_enriched の既存レコードに対して tag_keywords を使ったタグマッチを再実行し、
 * articles_enriched_tags を最新の tags_master に合わせて更新する。
 *
 * AI 再呼び出しは不要。title + summary_200 に対するキーワードマッチのみ実行する。
 *
 * 想定ユースケース:
 *   - 新しいタグ・キーワードを tags_master / tag_keywords に追加した後の一括反映
 *   - hourly-publish 実行前の事前整合
 */
import { Pool } from '@neondatabase/serverless'
import nextEnv from '@next/env'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const { loadEnvConfig } = nextEnv
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectDir = join(__dirname, '..')
loadEnvConfig(projectDir)

if (!process.env.DATABASE_URL_UNPOOLED) {
  console.error('ERROR: DATABASE_URL_UNPOOLED is not configured')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED })

function readArg(flag, fallback = null) {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

const limitArg = readArg('--limit')
const limit = limitArg ? parseInt(limitArg, 10) : null
const dryRun = process.argv.includes('--dry-run')
const BATCH_SIZE = 100

/**
 * tag_keywords を使って title + summary_200 をキーワードマッチする。
 * daily-enrich の matchTagsFromKeywords() と同ロジック。
 */
function matchTagsFromKeywords(keywords, title, summary) {
  const text = `${title ?? ''} ${summary ?? ''}`
  const textLower = text.toLowerCase()
  const matchedIds = new Set()

  for (const kw of keywords) {
    const haystack = kw.is_case_sensitive ? text : textLower
    const needle = kw.is_case_sensitive ? kw.keyword : kw.keyword.toLowerCase()
    if (needle.length >= 2 && haystack.includes(needle)) {
      matchedIds.add(kw.tag_id)
    }
  }

  return Array.from(matchedIds)
}

async function run() {
  const client = await pool.connect()

  try {
    // ── 1. tag_keywords（収集フィルタ用）を全件ロード ───────────────────
    const kwResult = await client.query(`
      SELECT tag_id, keyword, is_case_sensitive
      FROM tag_keywords
      WHERE use_for_collection = true
      ORDER BY tag_id, keyword
    `)
    const tagKeywords = kwResult.rows
    console.log(`tag_keywords loaded: ${tagKeywords.length} 件`)

    // ── 2. source_category → tag_id マップを構築 ──────────────────────
    const tagResult = await client.query(`
      SELECT tag_id, tag_key FROM tags_master WHERE is_active = true
    `)
    const tagKeyToId = new Map(tagResult.rows.map((r) => [r.tag_key, r.tag_id]))
    const paperTagId = tagKeyToId.get('paper') ?? null

    // ── 3. articles_enriched を batch で処理 ──────────────────────────
    const countResult = await client.query(`
      SELECT COUNT(*) FROM articles_enriched WHERE publish_candidate = true
    `)
    const total = parseInt(countResult.rows[0].count, 10)
    const target = limit ? Math.min(limit, total) : total
    console.log(`対象記事: ${target} 件 (全 publish_candidate=true: ${total} 件)`)

    let offset = 0
    let processed = 0
    let totalTagsAdded = 0

    while (processed < target) {
      const batchLimit = Math.min(BATCH_SIZE, target - processed)
      const articles = await client.query(
        `
        SELECT enriched_article_id, title, summary_200, source_category, source_type
        FROM articles_enriched
        WHERE publish_candidate = true
        ORDER BY enriched_article_id ASC
        LIMIT $1 OFFSET $2
        `,
        [batchLimit, offset],
      )

      if (articles.rows.length === 0) break

      for (const article of articles.rows) {
        const matchedTagIds =
          article.source_type === 'paper'
            ? paperTagId
              ? [paperTagId]
              : []
            : matchTagsFromKeywords(
                tagKeywords,
                article.title,
                article.summary_200,
              )

        // source_category を Tier 1 タグとして自動付与。ただし paper は paper タグだけに限定する。
        if (article.source_type !== 'paper') {
          const sourceCategoryTagId = tagKeyToId.get(article.source_category)
          if (sourceCategoryTagId && !matchedTagIds.includes(sourceCategoryTagId)) {
            matchedTagIds.push(sourceCategoryTagId)
          }
        }

        if (!dryRun && matchedTagIds.length > 0) {
          // 既存タグを削除して再挿入
          await client.query(
            `DELETE FROM articles_enriched_tags WHERE enriched_article_id = $1`,
            [article.enriched_article_id],
          )

          for (let i = 0; i < matchedTagIds.length; i++) {
            await client.query(
              `
              INSERT INTO articles_enriched_tags (enriched_article_id, tag_id, tag_source, is_primary)
              VALUES ($1, $2, 'master', $3)
              ON CONFLICT (enriched_article_id, tag_id) DO NOTHING
              `,
              [article.enriched_article_id, matchedTagIds[i], i === 0],
            )
          }

          totalTagsAdded += matchedTagIds.length
        } else if (dryRun) {
          console.log(`[dry-run] article=${article.enriched_article_id} title="${article.title?.slice(0, 40)}" → ${matchedTagIds.length} タグ`)
        }
      }

      processed += articles.rows.length
      offset += articles.rows.length
      process.stdout.write(`\r進捗: ${processed}/${target}`)
    }

    console.log(`\n完了: ${processed} 件処理, ${totalTagsAdded} タグ付与${dryRun ? ' [dry-run]' : ''}`)

    // ── 4. tags_master.article_count を更新 ──────────────────────────
    if (!dryRun) {
      await client.query(`
        UPDATE tags_master tm
        SET
          article_count = COALESCE(counts.article_count, 0),
          last_seen_at  = CASE WHEN COALESCE(counts.article_count, 0) > 0 THEN now() ELSE tm.last_seen_at END,
          updated_at    = now()
        FROM (
          SELECT tag_id, COUNT(*)::integer AS article_count
          FROM articles_enriched_tags
          GROUP BY tag_id
        ) counts
        WHERE tm.tag_id = counts.tag_id
      `)

      await client.query(`
        UPDATE tags_master
        SET article_count = 0, updated_at = now()
        WHERE tag_id NOT IN (SELECT DISTINCT tag_id FROM articles_enriched_tags)
          AND article_count <> 0
      `)

      console.log('tags_master.article_count 更新完了')
    }
  } finally {
    client.release()
  }
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
