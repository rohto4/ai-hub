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

function readArg(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] ?? null : null
}

async function run() {
  const positional = args.find((arg) => !arg.startsWith('--')) ?? null
  const rawId = readArg('--raw-id') ?? (positional && /^\d+$/.test(positional) ? positional : null)
  const sourceKey = readArg('--source-key')
  const limit = Number(readArg('--limit') ?? '20')

  if (!rawId && !sourceKey) {
    throw new Error('Specify --raw-id <id> or --source-key <key>')
  }

  let sql
  let params

  if (rawId) {
    sql = `
      UPDATE articles_raw
      SET
        is_processed = false,
        has_source_update = true,
        process_after = now(),
        last_error = null,
        updated_at = now()
      WHERE id = $1
      RETURNING id, normalized_url
    `
    params = [Number(rawId)]
  } else {
    sql = `
      WITH target_rows AS (
        SELECT ar.id
        FROM articles_raw ar
        JOIN source_targets st ON st.id = ar.source_target_id
        WHERE st.source_key = $1
        ORDER BY ar.created_at DESC
        LIMIT $2
      )
      UPDATE articles_raw ar
      SET
        is_processed = false,
        has_source_update = true,
        process_after = now(),
        last_error = null,
        updated_at = now()
      FROM target_rows tr
      WHERE ar.id = tr.id
      RETURNING ar.id, ar.normalized_url
    `
    params = [sourceKey, Number.isFinite(limit) ? Math.max(1, limit) : 20]
  }

  const result = await pool.query(sql, params)
  console.log(`requeued=${result.rowCount}`)
  for (const row of result.rows.slice(0, 20)) {
    console.log(`#${row.id} ${row.normalized_url}`)
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
