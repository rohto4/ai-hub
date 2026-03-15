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

function readArg(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] ?? fallback : fallback
}

async function run() {
  const staleMinutes = Math.max(5, Number(readArg('--minutes', '30')))
  const result = await pool.query(
    `
      UPDATE job_runs
      SET
        status = 'failed',
        finished_at = now(),
        last_error = COALESCE(last_error, 'stale_running_repaired'),
        updated_at = now()
      WHERE status = 'running'
        AND started_at <= now() - ($1::int * interval '1 minute')
      RETURNING job_run_id, job_name, started_at
    `,
    [staleMinutes],
  )

  console.log(`repaired=${result.rowCount} stale_minutes=${staleMinutes}`)
  for (const row of result.rows) {
    console.log(`#${row.job_run_id} ${row.job_name} started=${row.started_at}`)
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
