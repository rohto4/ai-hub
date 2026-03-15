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
    id: '6d6f7c02-1a1b-41d1-a111-000000000103',
    sourceKey: 'google-ai-blog',
    displayName: 'Google AI Blog',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    baseUrl: 'https://blog.google/technology/ai/rss/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000104',
    sourceKey: 'anthropic-news',
    displayName: 'Anthropic News',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    baseUrl: 'https://www.anthropic.com/news/rss.xml',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000105',
    sourceKey: 'ai-news-roundup',
    displayName: 'AI News Roundup',
    fetchKind: 'rss',
    sourceCategory: 'news',
    baseUrl: 'https://example.com/ai-news',
    contentAccessPolicy: 'feed_only',
    isActive: false,
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000106',
    sourceKey: 'openai-news',
    displayName: 'OpenAI News',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    baseUrl: 'https://openai.com/news/rss.xml',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000107',
    sourceKey: 'microsoft-foundry-blog',
    displayName: 'Microsoft Foundry Blog',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    baseUrl: 'https://devblogs.microsoft.com/foundry/feed/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000108',
    sourceKey: 'aws-machine-learning-blog',
    displayName: 'AWS Machine Learning Blog',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    baseUrl: 'https://aws.amazon.com/blogs/machine-learning/feed/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000109',
    sourceKey: 'huggingface-blog',
    displayName: 'Hugging Face Blog',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    baseUrl: 'https://huggingface.co/blog/feed.xml',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000110',
    sourceKey: 'nvidia-developer-blog',
    displayName: 'NVIDIA Developer Blog',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    baseUrl: 'https://developer.nvidia.com/blog/feed/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000111',
    sourceKey: 'meta-ai-news',
    displayName: 'Meta AI News',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    baseUrl: 'https://about.fb.com/news/tag/ai/feed/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000101',
    sourceKey: 'google-alerts-voice-ai-voice-agent',
    displayName: 'Google Alerts: Voice AI / Voice Agent',
    fetchKind: 'alerts',
    sourceCategory: 'voice',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/1546181015068281061',
    contentAccessPolicy: 'feed_only',
    isActive: true,
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000102',
    sourceKey: 'google-alerts-ai-agents-coding-agents',
    displayName: 'Google Alerts: AI Agents / Coding Agents',
    fetchKind: 'alerts',
    sourceCategory: 'agent',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/16203284553843939981',
    contentAccessPolicy: 'feed_only',
    isActive: true,
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000103',
    sourceKey: 'google-alerts-ai-regulation-policy',
    displayName: 'Google Alerts: AI Regulation / Policy',
    fetchKind: 'alerts',
    sourceCategory: 'policy',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/14504957906878978853',
    contentAccessPolicy: 'feed_only',
    isActive: true,
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000104',
    sourceKey: 'google-alerts-ai-safety-alignment',
    displayName: 'Google Alerts: AI Safety / Alignment',
    fetchKind: 'alerts',
    sourceCategory: 'safety',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/6373579163630166292',
    contentAccessPolicy: 'feed_only',
    isActive: true,
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000105',
    sourceKey: 'google-alerts-anthropic-claude-cowork',
    displayName: 'Google Alerts: Anthropic / Claude / Cowork',
    fetchKind: 'alerts',
    sourceCategory: 'llm',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/11283218415457465409',
    contentAccessPolicy: 'feed_only',
    isActive: true,
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000106',
    sourceKey: 'google-alerts-antigravity',
    displayName: 'Google Alerts: Antigravity',
    fetchKind: 'alerts',
    sourceCategory: 'agent',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/13098842776851540914',
    contentAccessPolicy: 'feed_only',
    isActive: true,
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000107',
    sourceKey: 'google-alerts-gemini-google-ai-studio',
    displayName: 'Google Alerts: Gemini / Google AI Studio',
    fetchKind: 'alerts',
    sourceCategory: 'llm',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/4650888718584175059',
    contentAccessPolicy: 'feed_only',
    isActive: true,
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000108',
    sourceKey: 'google-alerts-openai-chatgpt-codex',
    displayName: 'Google Alerts: OpenAI / ChatGPT / Codex',
    fetchKind: 'alerts',
    sourceCategory: 'llm',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/4748134521054786223',
    contentAccessPolicy: 'feed_only',
    isActive: true,
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000109',
    sourceKey: 'google-alerts-rag-retrieval-augmented-generation',
    displayName: 'Google Alerts: RAG / Retrieval-Augmented Generation',
    fetchKind: 'alerts',
    sourceCategory: 'search',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/13334698373516515488',
    contentAccessPolicy: 'feed_only',
    isActive: true,
  },
]

const usageTypes = ['public_primary', 'public_secondary']

const officialDomains = [
  { domain: 'anthropic.com', sourceKey: 'anthropic-news' },
  { domain: 'blog.google', sourceKey: 'google-ai-blog' },
  { domain: 'research.google', sourceKey: 'google-ai-blog' },
  { domain: 'openai.com', sourceKey: 'openai-news' },
  { domain: 'devblogs.microsoft.com', sourceKey: 'microsoft-foundry-blog' },
  { domain: 'aws.amazon.com', sourceKey: 'aws-machine-learning-blog' },
  { domain: 'huggingface.co', sourceKey: 'huggingface-blog' },
  { domain: 'developer.nvidia.com', sourceKey: 'nvidia-developer-blog' },
  { domain: 'about.fb.com', sourceKey: 'meta-ai-news' },
]

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
    const effectiveSourceTargetIds = new Map()

    for (const sourceTarget of sourceTargets) {
      const upsertedSourceTarget = await client.query(
        `
          INSERT INTO source_targets (
            source_target_id, source_key, display_name, fetch_kind, source_category, base_url,
            content_access_policy, is_active, fetch_interval_minutes, supports_update_detection, requires_auth
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 60, true, false)
          ON CONFLICT (source_key) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            fetch_kind = EXCLUDED.fetch_kind,
            source_category = EXCLUDED.source_category,
            base_url = EXCLUDED.base_url,
            content_access_policy = EXCLUDED.content_access_policy,
            is_active = EXCLUDED.is_active,
            fetch_interval_minutes = EXCLUDED.fetch_interval_minutes,
            supports_update_detection = EXCLUDED.supports_update_detection,
            requires_auth = EXCLUDED.requires_auth
          RETURNING source_target_id, source_key
        `,
        [
          sourceTarget.id,
          sourceTarget.sourceKey,
          sourceTarget.displayName,
          sourceTarget.fetchKind,
          sourceTarget.sourceCategory,
          sourceTarget.baseUrl,
          sourceTarget.contentAccessPolicy,
          sourceTarget.isActive ?? true,
        ],
      )

      effectiveSourceTargetIds.set(
        sourceTarget.sourceKey,
        upsertedSourceTarget.rows[0].source_target_id,
      )
    }

    for (const sourceTarget of sourceTargets) {
      const effectiveSourceTargetId = effectiveSourceTargetIds.get(sourceTarget.sourceKey)

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
            effectiveSourceTargetId,
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

    for (const officialDomain of officialDomains) {
      await client.query(
        `
          INSERT INTO observed_article_domains (
            domain,
            fetch_policy,
            summary_policy,
            observed_article_count,
            latest_article_url,
            first_seen_at,
            last_seen_at,
            notes
          )
          VALUES (
            $1,
            'fulltext_allowed',
            'summarize_full',
            0,
            null,
            now(),
            now(),
            $2
          )
          ON CONFLICT (domain) DO UPDATE SET
            fetch_policy = 'fulltext_allowed',
            summary_policy = 'summarize_full',
            notes = EXCLUDED.notes,
            updated_at = now()
        `,
        [officialDomain.domain, `Seeded official domain for ${officialDomain.sourceKey}`],
      )
    }

    await client.query('COMMIT')
    console.log(
      `Seeded ${sourceTargets.length} source targets, ${sourceTargets.length * usageTypes.length} source priority rules, ${tags.length} tags, and ${officialDomains.length} official domains.`,
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
