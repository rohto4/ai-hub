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
      st.source_key,
      st.is_active,
      st.fetch_kind,
      st.content_access_policy,
      COALESCE(raw_counts.raw_total, 0)::int AS raw_total,
      COALESCE(raw_counts.raw_processed, 0)::int AS raw_processed,
      COALESCE(enriched_counts.enriched_total, 0)::int AS enriched_total,
      COALESCE(enriched_counts.full_total, 0)::int AS full_total,
      COALESCE(enriched_counts.provisional_total, 0)::int AS provisional_total,
      enriched_counts.latest_processed_at
    FROM source_targets st
    LEFT JOIN (
      SELECT
        source_target_id,
        COUNT(*) AS raw_total,
        COUNT(*) FILTER (WHERE is_processed = true) AS raw_processed
      FROM articles_raw
      GROUP BY source_target_id
    ) raw_counts
      ON raw_counts.source_target_id = st.source_target_id
    LEFT JOIN (
      SELECT
        source_target_id,
        COUNT(*) AS enriched_total,
        COUNT(*) FILTER (WHERE content_path = 'full') AS full_total,
        COUNT(*) FILTER (WHERE is_provisional = true) AS provisional_total,
        MAX(processed_at) AS latest_processed_at
      FROM articles_enriched
      GROUP BY source_target_id
    ) enriched_counts
      ON enriched_counts.source_target_id = st.source_target_id
    ORDER BY st.is_active DESC, st.content_access_policy ASC, st.source_key ASC
  `)

  for (const row of result.rows) {
    console.log(
      `${row.source_key} active=${row.is_active} kind=${row.fetch_kind} policy=${row.content_access_policy} raw=${row.raw_processed}/${row.raw_total} enriched=${row.enriched_total} full=${row.full_total} provisional=${row.provisional_total} latest=${row.latest_processed_at ?? 'none'}`,
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
