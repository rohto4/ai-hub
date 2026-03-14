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
    SELECT
      lower(regexp_replace(split_part(split_part(coalesce(cited_url, canonical_url, normalized_url), '://', 2), '/', 1), '^www\\.', '')) AS domain,
      coalesce(provisional_reason, 'snippet_only') AS provisional_reason,
      COUNT(*)::int AS article_count,
      MAX(processed_at) AS latest_processed_at
    FROM articles_enriched
    WHERE is_provisional = true
    GROUP BY 1, 2
    ORDER BY article_count DESC, latest_processed_at DESC
    LIMIT 30
  `)

  for (const row of result.rows) {
    console.log(`${row.domain} ${row.provisional_reason} count=${row.article_count} latest=${row.latest_processed_at}`)
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
