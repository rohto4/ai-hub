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

const CANDIDATE_KEYS = [
  'antigravity pro',
  'health risks',
  'vector search',
  'search',
  'risks',
  'governance',
  'pentagon',
  'maps',
  'former',
  'building',
  'microsoft',
  'agora',
  'severe',
  'solutions',
  'nikhil',
]

const DISPLAY_NAME_PATTERNS = [
  'Would %',
  'Can Now%',
  'You Can%',
  'Maps Gets%',
]

async function main() {
  const client = await pool.connect()

  try {
    const deletedByKey = await client.query(
      `
        DELETE FROM tag_candidate_pool
        WHERE candidate_key = ANY($1::text[])
        RETURNING candidate_key
      `,
      [CANDIDATE_KEYS],
    )

    const deletedByPattern = await client.query(
      `
        DELETE FROM tag_candidate_pool
        WHERE display_name ILIKE ANY($1::text[])
        RETURNING candidate_key
      `,
      [DISPLAY_NAME_PATTERNS],
    )

    const deletedKeys = [...deletedByKey.rows, ...deletedByPattern.rows].map((row) => row.candidate_key)

    console.log(JSON.stringify({
      deletedCount: deletedKeys.length,
      deletedKeys: Array.from(new Set(deletedKeys)).sort(),
    }, null, 2))
  } finally {
    client.release()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
  .finally(async () => {
    await pool.end()
  })
