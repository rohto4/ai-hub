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
      domain,
      fetch_policy,
      summary_policy,
      observed_article_count,
      latest_article_url,
      last_seen_at
    FROM observed_article_domains
    ${onlyNeedsReview ? "WHERE fetch_policy = 'needs_review'" : ''}
    ORDER BY observed_article_count DESC, last_seen_at DESC, domain ASC
    LIMIT 200
  `)

  for (const row of result.rows) {
    console.log(
      `${row.domain} policy=${row.fetch_policy} summary=${row.summary_policy} count=${row.observed_article_count} last=${row.last_seen_at} url=${row.latest_article_url ?? ''}`,
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
