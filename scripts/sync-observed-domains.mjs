#!/usr/bin/env node
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

async function run() {
  const result = await pool.query(`
    INSERT INTO observed_article_domains (
      domain,
      fetch_policy,
      summary_policy,
      observed_article_count,
      latest_article_url,
      first_seen_at,
      last_seen_at
    )
    SELECT
      domain,
      CASE
        WHEN domain IN ('cdt.org', 'axios.com', 'bloomberg.com', 'youtube.com', 'm.youtube.com') THEN 'blocked'
        ELSE 'needs_review'
      END AS fetch_policy,
      CASE
        WHEN domain IN ('cdt.org', 'axios.com', 'bloomberg.com', 'youtube.com', 'm.youtube.com') THEN 'summarize_snippet'
        ELSE 'domain_default'
      END AS summary_policy,
      COUNT(*)::integer AS observed_article_count,
      (ARRAY_AGG(url ORDER BY seen_at DESC))[1] AS latest_article_url,
      MIN(seen_at) AS first_seen_at,
      MAX(seen_at) AS last_seen_at
    FROM (
      SELECT
        lower(regexp_replace(split_part(split_part(coalesce(cited_url, normalized_url), '://', 2), '/', 1), '^www\\.', '')) AS domain,
        coalesce(cited_url, normalized_url) AS url,
        created_at AS seen_at
      FROM articles_raw
      WHERE coalesce(cited_url, normalized_url) IS NOT NULL
    ) observed
    WHERE domain <> ''
    GROUP BY domain
    ON CONFLICT (domain) DO UPDATE SET
      observed_article_count = EXCLUDED.observed_article_count,
      latest_article_url = EXCLUDED.latest_article_url,
      first_seen_at = LEAST(observed_article_domains.first_seen_at, EXCLUDED.first_seen_at),
      last_seen_at = GREATEST(observed_article_domains.last_seen_at, EXCLUDED.last_seen_at),
      updated_at = now()
    RETURNING domain
  `)

  await pool.query(`
    UPDATE observed_article_domains od
    SET
      fetch_policy = 'fulltext_allowed',
      summary_policy = 'summarize_full',
      updated_at = now()
    FROM (
      SELECT DISTINCT
        lower(regexp_replace(split_part(split_part(coalesce(ar.cited_url, ar.normalized_url), '://', 2), '/', 1), '^www\\.', '')) AS article_domain
      FROM articles_raw ar
      JOIN source_targets st ON st.source_target_id = ar.source_target_id
      WHERE st.content_access_policy = 'fulltext_allowed'
        AND lower(regexp_replace(split_part(split_part(coalesce(ar.cited_url, ar.normalized_url), '://', 2), '/', 1), '^www\\.', '')) IN (
          lower(regexp_replace(split_part(split_part(st.base_url, '://', 2), '/', 1), '^www\\.', '')),
          CASE
            WHEN st.source_key = 'google-ai-blog' THEN 'research.google'
            WHEN st.source_key = 'anthropic-news' THEN 'anthropic.com'
            ELSE ''
          END
        )
    ) official_domains
    WHERE od.domain = official_domains.article_domain
  `)

  console.log(`synced_domains=${result.rowCount}`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
