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
    id: '7d4c0b20-1a1b-41d1-a111-000000000101',
    sourceKey: 'google-alerts-voice-ai-voice-agent',
    displayName: 'Google Alerts: Voice AI / Voice Agent',
    fetchKind: 'alerts',
    sourceCategory: 'voice',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/1546181015068281061',
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000102',
    sourceKey: 'google-alerts-ai-agents-coding-agents',
    displayName: 'Google Alerts: AI Agents / Coding Agents',
    fetchKind: 'alerts',
    sourceCategory: 'agent',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/16203284553843939981',
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000103',
    sourceKey: 'google-alerts-ai-regulation-policy',
    displayName: 'Google Alerts: AI Regulation / Policy',
    fetchKind: 'alerts',
    sourceCategory: 'policy',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/14504957906878978853',
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000104',
    sourceKey: 'google-alerts-ai-safety-alignment',
    displayName: 'Google Alerts: AI Safety / Alignment',
    fetchKind: 'alerts',
    sourceCategory: 'safety',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/6373579163630166292',
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000105',
    sourceKey: 'google-alerts-anthropic-claude-cowork',
    displayName: 'Google Alerts: Anthropic / Claude / Cowork',
    fetchKind: 'alerts',
    sourceCategory: 'llm',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/11283218415457465409',
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000106',
    sourceKey: 'google-alerts-antigravity',
    displayName: 'Google Alerts: Antigravity',
    fetchKind: 'alerts',
    sourceCategory: 'agent',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/13098842776851540914',
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000107',
    sourceKey: 'google-alerts-gemini-google-ai-studio',
    displayName: 'Google Alerts: Gemini / Google AI Studio',
    fetchKind: 'alerts',
    sourceCategory: 'llm',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/4650888718584175059',
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000108',
    sourceKey: 'google-alerts-openai-chatgpt-codex',
    displayName: 'Google Alerts: OpenAI / ChatGPT / Codex',
    fetchKind: 'alerts',
    sourceCategory: 'llm',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/4748134521054786223',
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000109',
    sourceKey: 'google-alerts-rag-retrieval-augmented-generation',
    displayName: 'Google Alerts: RAG / Retrieval-Augmented Generation',
    fetchKind: 'alerts',
    sourceCategory: 'search',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/13334698373516515488',
  },
]

const usageTypes = ['public_primary', 'public_secondary']

const tags = [
  { key: 'llm', displayName: 'LLM', trendKeyword: 'large language model' },
  { key: 'agent', displayName: 'Agent', trendKeyword: 'AI agent' },
  { key: 'coding-ai', displayName: 'Coding AI', trendKeyword: 'coding assistant' },
  { key: 'safety', displayName: 'Safety', trendKeyword: 'AI safety' },
  { key: 'rag', displayName: 'RAG', trendKeyword: 'retrieval augmented generation' },
  { key: 'voice-ai', displayName: 'Voice AI', trendKeyword: 'voice ai' },
  { key: 'google-ai', displayName: 'Google AI', trendKeyword: 'google ai' },
  { key: 'policy', displayName: 'Policy', trendKeyword: 'AI policy' },
]

async function run() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    for (const sourceTarget of sourceTargets) {
      await client.query(
        `
          INSERT INTO source_targets (
            id, source_key, display_name, fetch_kind, source_category, base_url,
            is_active, fetch_interval_minutes, supports_update_detection, requires_auth
          )
          VALUES ($1, $2, $3, $4, $5, $6, true, 60, true, false)
          ON CONFLICT (source_key) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            fetch_kind = EXCLUDED.fetch_kind,
            source_category = EXCLUDED.source_category,
            base_url = EXCLUDED.base_url,
            is_active = EXCLUDED.is_active,
            fetch_interval_minutes = EXCLUDED.fetch_interval_minutes,
            supports_update_detection = EXCLUDED.supports_update_detection,
            requires_auth = EXCLUDED.requires_auth
        `,
        [
          sourceTarget.id,
          sourceTarget.sourceKey,
          sourceTarget.displayName,
          sourceTarget.fetchKind,
          sourceTarget.sourceCategory,
          sourceTarget.baseUrl,
        ],
      )
    }

    for (const sourceTarget of sourceTargets) {
      for (const usageType of usageTypes) {
        await client.query(
          `
            INSERT INTO source_priority_rules (
              source_target_id, usage_type, priority_score, is_active, notes
            )
            VALUES ($1, $2, 100, true, $3)
            ON CONFLICT (source_target_id, usage_type) DO UPDATE SET
              priority_score = EXCLUDED.priority_score,
              is_active = EXCLUDED.is_active,
              notes = EXCLUDED.notes
          `,
          [
            sourceTarget.id,
            usageType,
            'Initial P0 seed. No source-specific priority difference yet.',
          ],
        )
      }
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

    await client.query('COMMIT')
    console.log(
      `Seeded ${sourceTargets.length} source targets, ${sourceTargets.length * usageTypes.length} source priority rules, and ${tags.length} tags.`,
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
