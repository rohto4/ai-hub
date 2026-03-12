#!/usr/bin/env node
/**
 * DB seed runner
 * Usage: node scripts/seed.mjs
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

const sourceTargets = [
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000101',
    sourceKey: 'google-ai-blog',
    displayName: 'Google AI Blog',
    fetchKind: 'rss',
    sourceCategory: 'official',
    baseUrl: 'https://blog.google/technology/ai/',
    supportsUpdateDetection: true,
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000102',
    sourceKey: 'anthropic-news',
    displayName: 'Anthropic News',
    fetchKind: 'rss',
    sourceCategory: 'official',
    baseUrl: 'https://www.anthropic.com/news',
    supportsUpdateDetection: true,
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000103',
    sourceKey: 'ai-news-roundup',
    displayName: 'AI News Roundup',
    fetchKind: 'alerts',
    sourceCategory: 'news',
    baseUrl: 'https://example.com/ai-news',
    supportsUpdateDetection: false,
  },
]

const priorityRules = [
  {
    sourceTargetId: '6d6f7c02-1a1b-41d1-a111-000000000101',
    usageType: 'public_primary',
    priorityScore: 100,
    notes: '公式一次情報を最優先',
  },
  {
    sourceTargetId: '6d6f7c02-1a1b-41d1-a111-000000000102',
    usageType: 'public_primary',
    priorityScore: 95,
    notes: '公式更新を高優先',
  },
  {
    sourceTargetId: '6d6f7c02-1a1b-41d1-a111-000000000103',
    usageType: 'public_secondary',
    priorityScore: 60,
    notes: 'まとめ記事は補助扱い',
  },
]

const tags = [
  { key: 'llm', displayName: 'LLM', trendKeyword: 'large language model' },
  { key: 'agent', displayName: 'Agent', trendKeyword: 'AI agent' },
  { key: 'coding-ai', displayName: 'Coding AI', trendKeyword: 'coding assistant' },
  { key: 'safety', displayName: 'Safety', trendKeyword: 'AI safety' },
  { key: 'rag', displayName: 'RAG', trendKeyword: 'retrieval augmented generation' },
  { key: 'voice-ai', displayName: 'Voice AI', trendKeyword: 'voice ai' },
  { key: 'google-ai', displayName: 'Google AI', trendKeyword: 'google ai' },
]

const rawRows = [
  {
    sourceTargetId: '6d6f7c02-1a1b-41d1-a111-000000000101',
    sourceItemId: 'seed-raw-001',
    sourceUrl: 'https://blog.google/technology/ai/gemini-2-flash-update',
    citedUrl: 'https://blog.google/technology/ai/gemini-2-flash-update',
    normalizedUrl: 'https://blog.google/technology/ai/gemini-2-flash-update',
    title: 'Gemini 2.0 Flash update',
    snippet: 'Google updates Gemini 2.0 Flash with clearer latency and cost guidance.',
    snippetHash: 'seed-hash-001',
    sourcePublishedAt: '2026-03-12T09:00:00+09:00',
    sourceUpdatedAt: '2026-03-12T09:00:00+09:00',
    sourceAuthor: 'Google AI',
    sourceMeta: { lang: 'en', genre: 'llm' },
    hasSourceUpdate: false,
  },
  {
    sourceTargetId: '6d6f7c02-1a1b-41d1-a111-000000000102',
    sourceItemId: 'seed-raw-002',
    sourceUrl: 'https://www.anthropic.com/news/claude-review-workflow',
    citedUrl: 'https://www.anthropic.com/news/claude-review-workflow',
    normalizedUrl: 'https://www.anthropic.com/news/claude-review-workflow',
    title: 'Claude review workflow',
    snippet: 'Claude is being used more often for review and specification checks.',
    snippetHash: 'seed-hash-002',
    sourcePublishedAt: '2026-03-12T10:00:00+09:00',
    sourceUpdatedAt: '2026-03-12T10:00:00+09:00',
    sourceAuthor: 'Anthropic',
    sourceMeta: { lang: 'en', genre: 'coding-ai' },
    hasSourceUpdate: false,
  },
  {
    sourceTargetId: '6d6f7c02-1a1b-41d1-a111-000000000103',
    sourceItemId: 'seed-raw-003',
    sourceUrl: 'https://example.com/ai-news/agent-observability',
    citedUrl: 'https://vendor.example.com/blog/agent-observability',
    normalizedUrl: 'https://vendor.example.com/blog/agent-observability',
    title: 'Agent observability becomes a core design topic',
    snippet: 'Observability, retries, and failure handling are now key agent design topics.',
    snippetHash: 'seed-hash-003',
    sourcePublishedAt: '2026-03-12T11:00:00+09:00',
    sourceUpdatedAt: null,
    sourceAuthor: 'AI News Roundup',
    sourceMeta: { lang: 'en', genre: 'agent' },
    hasSourceUpdate: false,
  },
]

const enrichedRows = [
  {
    sourceItemId: 'seed-raw-001',
    canonicalUrl: 'https://blog.google/technology/ai/gemini-2-flash-update',
    title: 'Gemini 2.0 Flash が軽量モデル更新を公開',
    summary100: 'Google が Gemini 2.0 Flash の更新内容を公開し、軽量用途での選定材料が増えた。',
    summary200: 'Google が Gemini 2.0 Flash の更新内容を整理し、速度とコストの見直しを公開した。軽量モデルを選ぶ際の比較材料として使いやすくなっている。',
    summary300: 'Google が Gemini 2.0 Flash の更新内容を整理し、速度とコストの見直しを公開した。評価条件や利用シーンも追いやすくなり、軽量モデルを採用する際の比較材料として使いやすくなっている。',
    contentPath: 'full',
    dedupeStatus: 'unique',
    dedupeGroupKey: 'gemini-flash-update',
    publishCandidate: true,
    score: 92.4,
    scoreReason: '公式一次情報かつ公開候補',
    tagKeys: ['llm', 'google-ai'],
  },
  {
    sourceItemId: 'seed-raw-002',
    canonicalUrl: 'https://www.anthropic.com/news/claude-review-workflow',
    title: 'Claude のレビュー支援が設計チェック用途で目立つ',
    summary100: 'Claude を設計レビュー補助に使う流れが強まり、チェック観点の整理に注目が集まっている。',
    summary200: 'Claude を使った設計レビュー補助が広がっており、差分確認や仕様チェックのテンプレート化に向いているという評価が増えている。',
    summary300: 'Claude を使った設計レビュー補助が広がっており、差分確認や仕様チェックのテンプレート化に向いているという評価が増えている。単なる文章生成ではなく、確認観点の整理役としての利用価値が高まっている。',
    contentPath: 'full',
    dedupeStatus: 'unique',
    dedupeGroupKey: 'claude-review',
    publishCandidate: true,
    score: 88.1,
    scoreReason: '設計レビュー用途で話題性あり',
    tagKeys: ['coding-ai'],
  },
  {
    sourceItemId: 'seed-raw-003',
    canonicalUrl: 'https://vendor.example.com/blog/agent-observability',
    title: 'Agent 設計で observability が重要論点になる',
    summary100: 'Agent 設計では observability と失敗時の扱いが中核論点として扱われ始めている。',
    summary200: 'Agent 設計では、タスク成功率だけでなく observability、再試行、失敗時処理の設計が重要だという議論が強まっている。',
    summary300: 'Agent 設計では、タスク成功率だけでなく observability、再試行、失敗時処理の設計が重要だという議論が強まっている。複数ツールをまたぐ構成では、挙動を後から追えることが品質確保の前提になりつつある。',
    contentPath: 'snippet',
    dedupeStatus: 'unique',
    dedupeGroupKey: 'agent-observability',
    publishCandidate: false,
    score: 71.5,
    scoreReason: 'snippet 要約のため一旦保留',
    tagKeys: ['agent'],
    candidateKeys: ['agent-observability'],
  },
]

async function run() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      DELETE FROM articles_enriched_tags
      WHERE enriched_article_id IN (
        SELECT ae.id
        FROM articles_enriched ae
        JOIN articles_raw ar ON ar.id = ae.raw_article_id
        WHERE ar.source_item_id LIKE 'seed-%'
      )
    `)

    await client.query(`
      DELETE FROM articles_enriched_history
      WHERE raw_article_id IN (
        SELECT id FROM articles_raw WHERE source_item_id LIKE 'seed-%'
      )
    `)

    await client.query(`
      DELETE FROM articles_enriched
      WHERE raw_article_id IN (
        SELECT id FROM articles_raw WHERE source_item_id LIKE 'seed-%'
      )
    `)

    await client.query(`
      DELETE FROM tag_candidate_pool
      WHERE candidate_key IN ('agent-observability')
    `)

    await client.query(`
      DELETE FROM articles_raw
      WHERE source_item_id LIKE 'seed-%'
    `)

    for (const sourceTarget of sourceTargets) {
      await client.query(
        `
          INSERT INTO source_targets (
            id, source_key, display_name, fetch_kind, source_category, base_url,
            is_active, fetch_interval_minutes, supports_update_detection, requires_auth
          )
          VALUES ($1, $2, $3, $4, $5, $6, true, 60, $7, false)
          ON CONFLICT (source_key) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            fetch_kind = EXCLUDED.fetch_kind,
            source_category = EXCLUDED.source_category,
            base_url = EXCLUDED.base_url,
            is_active = EXCLUDED.is_active,
            fetch_interval_minutes = EXCLUDED.fetch_interval_minutes,
            supports_update_detection = EXCLUDED.supports_update_detection
        `,
        [
          sourceTarget.id,
          sourceTarget.sourceKey,
          sourceTarget.displayName,
          sourceTarget.fetchKind,
          sourceTarget.sourceCategory,
          sourceTarget.baseUrl,
          sourceTarget.supportsUpdateDetection,
        ],
      )
    }

    for (const rule of priorityRules) {
      await client.query(
        `
          INSERT INTO source_priority_rules (
            source_target_id, usage_type, priority_score, is_active, notes
          )
          VALUES ($1, $2, $3, true, $4)
          ON CONFLICT (source_target_id, usage_type) DO UPDATE SET
            priority_score = EXCLUDED.priority_score,
            is_active = EXCLUDED.is_active,
            notes = EXCLUDED.notes
        `,
        [rule.sourceTargetId, rule.usageType, rule.priorityScore, rule.notes],
      )
    }

    for (const tag of tags) {
      await client.query(
        `
          INSERT INTO tags_master (
            tag_key, display_name, trend_keyword, is_active, article_count
          )
          VALUES ($1, $2, $3, true, 0)
          ON CONFLICT (tag_key) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            trend_keyword = EXCLUDED.trend_keyword,
            is_active = EXCLUDED.is_active
        `,
        [tag.key, tag.displayName, tag.trendKeyword],
      )
    }

    const rawIdBySourceItemId = new Map()

    for (const raw of rawRows) {
      const result = await client.query(
        `
          INSERT INTO articles_raw (
            source_target_id, source_item_id, source_url, cited_url, normalized_url,
            title, snippet, snippet_hash, source_published_at, source_updated_at,
            source_author, source_meta, has_source_update
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
          RETURNING id
        `,
        [
          raw.sourceTargetId,
          raw.sourceItemId,
          raw.sourceUrl,
          raw.citedUrl,
          raw.normalizedUrl,
          raw.title,
          raw.snippet,
          raw.snippetHash,
          raw.sourcePublishedAt,
          raw.sourceUpdatedAt,
          raw.sourceAuthor,
          JSON.stringify(raw.sourceMeta),
          raw.hasSourceUpdate,
        ],
      )

      rawIdBySourceItemId.set(raw.sourceItemId, result.rows[0].id)
    }

    for (const enriched of enrichedRows) {
      const rawId = rawIdBySourceItemId.get(enriched.sourceItemId)
      if (!rawId) {
        throw new Error(`Missing raw row for ${enriched.sourceItemId}`)
      }

      const raw = rawRows.find((item) => item.sourceItemId === enriched.sourceItemId)

      const enrichedResult = await client.query(
        `
          INSERT INTO articles_enriched (
            raw_article_id, source_target_id, normalized_url, cited_url, canonical_url,
            title, summary_100, summary_200, summary_300, content_path,
            dedupe_status, dedupe_group_key, publish_candidate, score, score_reason,
            source_updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING id
        `,
        [
          rawId,
          raw.sourceTargetId,
          raw.normalizedUrl,
          raw.citedUrl,
          enriched.canonicalUrl,
          enriched.title,
          enriched.summary100,
          enriched.summary200,
          enriched.summary300,
          enriched.contentPath,
          enriched.dedupeStatus,
          enriched.dedupeGroupKey,
          enriched.publishCandidate,
          enriched.score,
          enriched.scoreReason,
          raw.sourceUpdatedAt,
        ],
      )

      const enrichedId = enrichedResult.rows[0].id

      for (const tagKey of enriched.tagKeys ?? []) {
        await client.query(
          `
            INSERT INTO articles_enriched_tags (enriched_article_id, tag_id, tag_source, is_primary)
            SELECT $1, tm.id, 'master', false
            FROM tags_master tm
            WHERE tm.tag_key = $2
          `,
          [enrichedId, tagKey],
        )
      }

      for (const candidateKey of enriched.candidateKeys ?? []) {
        await client.query(
          `
            INSERT INTO tag_candidate_pool (
              candidate_key, display_name, seen_count, latest_origin_raw_id, review_status
            )
            VALUES ($1, $2, 1, $3, 'candidate')
            ON CONFLICT (candidate_key) DO UPDATE SET
              display_name = EXCLUDED.display_name,
              seen_count = tag_candidate_pool.seen_count + 1,
              latest_origin_raw_id = EXCLUDED.latest_origin_raw_id,
              last_seen_at = now()
          `,
          [candidateKey, candidateKey, rawId],
        )
      }

      await client.query(
        `
          UPDATE articles_raw
          SET is_processed = true,
              updated_at = now()
          WHERE id = $1
        `,
        [rawId],
      )
    }

    await client.query('COMMIT')
    console.log(
      `Seeded ${sourceTargets.length} source targets, ${tags.length} tags, ${rawRows.length} raw rows, ${enrichedRows.length} enriched rows.`,
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
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
