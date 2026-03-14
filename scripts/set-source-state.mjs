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
const mode = positionalArgs[1] ?? null
const enable = args.includes('--enable') || mode === 'enable'
const disable = args.includes('--disable') || mode === 'disable'

async function run() {
  if (!sourceKey || (!enable && !disable)) {
    throw new Error('Usage: node scripts/set-source-state.mjs <source-key> --enable|--disable')
  }

  const result = await pool.query(
    `
      UPDATE source_targets
      SET
        is_active = $2,
        updated_at = now()
      WHERE source_key = $1
      RETURNING source_key, is_active, base_url
    `,
    [sourceKey, enable],
  )

  if (result.rowCount === 0) {
    throw new Error(`source_key not found: ${sourceKey}`)
  }

  const row = result.rows[0]
  console.log(`${row.source_key} active=${row.is_active} ${row.base_url ?? ''}`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
