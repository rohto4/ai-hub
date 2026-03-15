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
const positionalArgs = args.filter((arg) => !arg.startsWith('--'))
const sourceKey = positionalArgs[0] ?? null
const policy = positionalArgs[1] ?? null
const requeue = args.includes('--requeue')

const allowedPolicies = new Set(['feed_only', 'fulltext_allowed', 'blocked_snippet_only'])

async function run() {
  if (!sourceKey || !policy || !allowedPolicies.has(policy)) {
    throw new Error(
      'Usage: node scripts/set-source-policy.mjs <source-key> <feed_only|fulltext_allowed|blocked_snippet_only> [--requeue]',
    )
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const updated = await client.query(
      `
        UPDATE source_targets
        SET
          content_access_policy = $2,
          updated_at = now()
        WHERE source_key = $1
        RETURNING source_target_id, source_key, content_access_policy, is_active
      `,
      [sourceKey, policy],
    )

    if (updated.rowCount === 0) {
      throw new Error(`source_key not found: ${sourceKey}`)
    }

    let requeuedCount = 0
    if (requeue) {
      const requeued = await client.query(
        `
          UPDATE articles_raw
          SET
            is_processed = false,
            has_source_update = true,
            process_after = now(),
            last_error = null,
            updated_at = now()
          WHERE source_target_id = $1
          RETURNING raw_article_id
        `,
        [updated.rows[0].source_target_id],
      )
      requeuedCount = requeued.rowCount
    }

    await client.query('COMMIT')
    const row = updated.rows[0]
    console.log(
      `${row.source_key} policy=${row.content_access_policy} active=${row.is_active} requeued=${requeuedCount}`,
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
