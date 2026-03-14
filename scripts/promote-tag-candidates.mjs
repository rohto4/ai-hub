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

function hasFlag(name) {
  return args.includes(name)
}

function readArg(name, defaultValue) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] ?? defaultValue : defaultValue
}

function normalizeTagKey(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim()
}

async function run() {
  const positionalArgs = args.filter((arg) => !arg.startsWith('--'))
  const minSeenArg = positionalArgs.find((arg) => /^\d+$/.test(arg)) ?? null
  const apply = hasFlag('--apply') || positionalArgs.includes('apply')
  const minSeen = Math.max(1, Number(readArg('--min-seen', minSeenArg ?? '8')))
  const limit = Math.max(1, Number(readArg('--limit', '20')))
  const candidates = await pool.query(
    `
      SELECT id, candidate_key, display_name, seen_count, review_status
      FROM tag_candidate_pool
      WHERE seen_count >= $1
        AND review_status IN ('candidate', 'trend_matched', 'manual_review')
        AND manual_review_required = false
      ORDER BY seen_count DESC, last_seen_at DESC
      LIMIT $2
    `,
    [minSeen, limit],
  )

  if (!apply) {
    console.log(`dry-run candidates=${candidates.rowCount} min_seen=${minSeen}`)
    for (const row of candidates.rows) {
      console.log(`${row.candidate_key} seen=${row.seen_count} status=${row.review_status}`)
    }
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const row of candidates.rows) {
      const tagKey = normalizeTagKey(row.candidate_key)
      const inserted = await client.query(
        `
          INSERT INTO tags_master (tag_key, display_name, description, is_active)
          VALUES ($1, $2, $3, true)
          ON CONFLICT (tag_key) DO UPDATE
            SET display_name = EXCLUDED.display_name,
                updated_at = now()
          RETURNING id
        `,
        [tagKey, row.display_name, 'Promoted from tag_candidate_pool'],
      )

      const tagId = inserted.rows[0].id
      await client.query(
        `
          UPDATE tag_candidate_pool
          SET
            review_status = 'promoted',
            promoted_tag_id = $2,
            updated_at = now()
          WHERE id = $1
        `,
        [row.id, tagId],
      )
    }

    await client.query('COMMIT')
    console.log(`promoted=${candidates.rowCount} min_seen=${minSeen}`)
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
