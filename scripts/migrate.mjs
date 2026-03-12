#!/usr/bin/env node
/**
 * DB migration runner
 * Usage: node scripts/migrate.mjs
 */
import { Pool } from '@neondatabase/serverless'
import nextEnv from '@next/env'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const { loadEnvConfig } = nextEnv

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectDir = join(__dirname, '..')
const MIGRATIONS_DIR = join(projectDir, 'migrations')

loadEnvConfig(projectDir)

if (!process.env.DATABASE_URL_UNPOOLED) {
  console.error('ERROR: DATABASE_URL_UNPOOLED is not configured')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED })

function stripBom(text) {
  return text.replace(/^\uFEFF/, '')
}

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migration_history (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const appliedRows = await pool.query('SELECT filename FROM migration_history')
  const applied = new Set(appliedRows.rows.map((row) => row.filename))

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  let count = 0
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`SKIP  ${file}`)
      continue
    }

    const rawContent = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    const content = stripBom(rawContent).trim()
    const client = await pool.connect()

    try {
      console.log(`RUN   ${file}`)
      await client.query('BEGIN')
      await client.query(content)
      await client.query('INSERT INTO migration_history (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`DONE  ${file}`)
      count++
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  console.log(`\n${count} migration(s) applied.`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
