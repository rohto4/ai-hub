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
const args = process.argv.slice(2)
const onlyNeedsReview = args.includes('--needs-review')

async function run() {
  const result = await pool.query(`
    SELECT
      od.domain,
      od.fetch_policy,
      od.summary_policy,
      od.observed_article_count,
      od.latest_article_url,
      od.last_seen_at,
      COALESCE(domain_stats.provisional_count, 0)::int AS provisional_count,
      COALESCE(domain_stats.ready_count, 0)::int AS ready_count,
      COALESCE(domain_stats.source_keys, '') AS source_keys
    FROM observed_article_domains od
    LEFT JOIN (
      SELECT
        lower(regexp_replace(split_part(split_part(coalesce(ar.cited_url, ar.normalized_url), '://', 2), '/', 1), '^www\\.', '')) AS domain,
        COUNT(*) FILTER (WHERE ae.is_provisional = true) AS provisional_count,
        COUNT(*) FILTER (WHERE ae.is_provisional = false) AS ready_count,
        string_agg(DISTINCT st.source_key, ',' ORDER BY st.source_key) AS source_keys
      FROM articles_raw ar
      JOIN source_targets st ON st.id = ar.source_target_id
      LEFT JOIN articles_enriched ae ON ae.raw_article_id = ar.id
      GROUP BY 1
    ) domain_stats
      ON domain_stats.domain = od.domain
    ${onlyNeedsReview ? "WHERE fetch_policy = 'needs_review'" : ''}
    ORDER BY od.observed_article_count DESC, od.last_seen_at DESC, od.domain ASC
    LIMIT 200
  `)

  for (const row of result.rows) {
    console.log(
      `${row.domain} policy=${row.fetch_policy} summary=${row.summary_policy} count=${row.observed_article_count} provisional=${row.provisional_count} ready=${row.ready_count} sources=${row.source_keys || '-'} last=${row.last_seen_at} url=${row.latest_article_url ?? ''}`,
    )
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
