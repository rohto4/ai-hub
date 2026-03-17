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
    sourceType: 'official',
    baseUrl: 'https://blog.google/technology/ai/rss/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000104',
    sourceKey: 'anthropic-news',
    displayName: 'Anthropic News',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'official',
    baseUrl: 'https://www.anthropic.com/news/rss.xml',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000105',
    sourceKey: 'ai-news-roundup',
    displayName: 'AI News Roundup',
    fetchKind: 'rss',
    sourceCategory: 'news',
    sourceType: 'news',
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
    sourceType: 'official',
    baseUrl: 'https://openai.com/news/rss.xml',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000107',
    sourceKey: 'microsoft-foundry-blog',
    displayName: 'Microsoft Foundry Blog',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'official',
    baseUrl: 'https://devblogs.microsoft.com/foundry/feed/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000108',
    sourceKey: 'aws-machine-learning-blog',
    displayName: 'AWS Machine Learning Blog',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'official',
    baseUrl: 'https://aws.amazon.com/blogs/machine-learning/feed/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000109',
    sourceKey: 'huggingface-blog',
    displayName: 'Hugging Face Blog',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'official',
    baseUrl: 'https://huggingface.co/blog/feed.xml',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000110',
    sourceKey: 'nvidia-developer-blog',
    displayName: 'NVIDIA Developer Blog',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'official',
    baseUrl: 'https://developer.nvidia.com/blog/feed/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '6d6f7c02-1a1b-41d1-a111-000000000111',
    sourceKey: 'meta-ai-news',
    displayName: 'Meta AI News',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'official',
    baseUrl: 'https://about.fb.com/news/tag/ai/feed/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: '7d4c0b20-1a1b-41d1-a111-000000000101',
    sourceKey: 'google-alerts-voice-ai-voice-agent',
    displayName: 'Google Alerts: Voice AI / Voice Agent',
    fetchKind: 'alerts',
    sourceCategory: 'voice',
    sourceType: 'alerts',
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
    sourceType: 'alerts',
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
    sourceType: 'alerts',
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
    sourceType: 'alerts',
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
    sourceType: 'alerts',
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
    sourceType: 'alerts',
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
    sourceType: 'alerts',
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
    sourceType: 'alerts',
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
    sourceType: 'alerts',
    baseUrl: 'https://www.google.com/alerts/feeds/03032972658729420425/13334698373516515488',
    contentAccessPolicy: 'feed_only',
    isActive: true,
  },

  // ── 論文ソース（paper）──────────────────────────────────────────
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000001',
    sourceKey: 'huggingface-papers',
    displayName: 'Hugging Face Papers',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'paper',
    baseUrl: 'https://huggingface.co/papers.rss', // 404確認済み、代替URL調査中
    isActive: false,
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000002',
    sourceKey: 'arxiv-ai',
    displayName: 'arXiv AI / ML / NLP',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'paper',
    baseUrl: 'http://export.arxiv.org/rss/cs.AI+cs.LG+cs.CL',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000003',
    sourceKey: 'paperswithcode',
    displayName: 'Papers with Code',
    fetchKind: 'api',
    sourceCategory: 'llm',
    sourceType: 'paper',
    baseUrl: 'https://paperswithcode.com/latest.rss', // APIはCloudflare遮断、RSSはXML不正のため無効
    contentAccessPolicy: 'fulltext_allowed',
    isActive: false,
  },

  // ── ブログ・コミュニティ（blog）──────────────────────────────────
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000011',
    sourceKey: 'zenn-ai',
    displayName: 'Zenn AI',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'blog',
    baseUrl: 'https://zenn.dev/topics/ai/feed',
    contentAccessPolicy: 'feed_only',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000012',
    sourceKey: 'reddit-machinelearning',
    displayName: 'Reddit r/MachineLearning',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'blog',
    baseUrl: 'https://www.reddit.com/r/MachineLearning/.rss',
    contentAccessPolicy: 'feed_only',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000013',
    sourceKey: 'reddit-localllama',
    displayName: 'Reddit r/LocalLLaMA',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'blog',
    baseUrl: 'https://www.reddit.com/r/LocalLLaMA/.rss',
    contentAccessPolicy: 'feed_only',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000014',
    sourceKey: 'devto-ai',
    displayName: 'Dev.to AI',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'blog',
    baseUrl: 'https://dev.to/feed/tag/ai',
    contentAccessPolicy: 'feed_only',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000015',
    sourceKey: 'hackernews-ai',
    displayName: 'Hacker News AI',
    fetchKind: 'api',
    sourceCategory: 'llm',
    sourceType: 'blog',
    baseUrl: 'https://hacker-news.firebaseio.com/v0',
    contentAccessPolicy: 'feed_only',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000016',
    sourceKey: 'simonwillison-blog',
    displayName: 'Simon Willison\'s Blog',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'blog',
    baseUrl: 'https://simonwillison.net/atom/everything/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000017',
    sourceKey: 'the-gradient',
    displayName: 'The Gradient',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'blog',
    baseUrl: 'https://thegradient.pub/rss/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000018',
    sourceKey: 'last-week-in-ai',
    displayName: 'Last Week in AI',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'blog',
    baseUrl: 'https://lastweekin.ai/feed',
    contentAccessPolicy: 'feed_only',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000019',
    sourceKey: 'towards-data-science',
    displayName: 'Towards Data Science',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'blog',
    baseUrl: 'https://towardsdatascience.com/feed',
    contentAccessPolicy: 'feed_only',
  },

  // ── ニュースメディア（news）──────────────────────────────────────
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000021',
    sourceKey: 'venturebeat-ai',
    displayName: 'VentureBeat AI',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'news',
    baseUrl: 'https://venturebeat.com/category/ai/feed/',
    contentAccessPolicy: 'feed_only',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000022',
    sourceKey: 'mit-technology-review-ai',
    displayName: 'MIT Technology Review AI',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'news',
    baseUrl: 'https://www.technologyreview.com/feed/',
    contentAccessPolicy: 'feed_only',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000023',
    sourceKey: 'ledge-ai',
    displayName: 'Ledge.ai',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'news',
    baseUrl: 'https://ledge.ai/feed.xml', // feed URL要確認、現在無効
    contentAccessPolicy: 'feed_only',
    isActive: false,
  },

  // ── 公式プラットフォーム・研究機関（official）──────────────────
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000031',
    sourceKey: 'bair-blog',
    displayName: 'BAIR Blog (Berkeley AI)',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'official',
    baseUrl: 'https://bair.berkeley.edu/blog/feed.xml',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000032',
    sourceKey: 'langchain-blog',
    displayName: 'LangChain Blog',
    fetchKind: 'rss',
    sourceCategory: 'agent',
    sourceType: 'official',
    baseUrl: 'https://blog.langchain.com/rss/',
    contentAccessPolicy: 'fulltext_allowed',
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000033',
    sourceKey: 'mistral-ai-news',
    displayName: 'Mistral AI News',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'official',
    baseUrl: 'https://mistral.ai/news/rss.xml', // RSS非提供のため無効
    contentAccessPolicy: 'fulltext_allowed',
    isActive: false,
  },
  {
    id: 'ae1b2c3d-0001-4000-8000-000000000034',
    sourceKey: 'deepmind-research-blog',
    displayName: 'Google DeepMind Blog',
    fetchKind: 'rss',
    sourceCategory: 'llm',
    sourceType: 'official',
    baseUrl: 'https://deepmind.google/blog/rss.xml',
    contentAccessPolicy: 'fulltext_allowed',
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
  // 新規追加ソースの公式ドメイン
  { domain: 'arxiv.org', sourceKey: 'arxiv-ai' },
  { domain: 'paperswithcode.com', sourceKey: 'paperswithcode' },
  { domain: 'simonwillison.net', sourceKey: 'simonwillison-blog' },
  { domain: 'thegradient.pub', sourceKey: 'the-gradient' },
  { domain: 'bair.berkeley.edu', sourceKey: 'bair-blog' },
  { domain: 'blog.langchain.com', sourceKey: 'langchain-blog' },
  { domain: 'mistral.ai', sourceKey: 'mistral-ai-news' },
  { domain: 'deepmind.google', sourceKey: 'deepmind-research-blog' },
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
            source_target_id, source_key, display_name, fetch_kind, source_category, source_type, base_url,
            content_access_policy, is_active, fetch_interval_minutes, supports_update_detection, requires_auth
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 60, true, false)
          ON CONFLICT (source_key) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            fetch_kind = EXCLUDED.fetch_kind,
            source_category = EXCLUDED.source_category,
            source_type = EXCLUDED.source_type,
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
          sourceTarget.sourceType ?? 'news',
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
