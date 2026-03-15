import path from 'node:path'
import fs from 'node:fs'
import { neon } from '@neondatabase/serverless'

function loadEnvFile(fileName) {
  const fullPath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(fullPath)) return

  for (const rawLine of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    if (!rawLine || rawLine.trim().startsWith('#')) continue
    const separatorIndex = rawLine.indexOf('=')
    if (separatorIndex === -1) continue
    const key = rawLine.slice(0, separatorIndex)
    const value = rawLine.slice(separatorIndex + 1)
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function readArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) {
    return null
  }
  return process.argv[index + 1]
}

loadEnvFile('.env.local')
loadEnvFile('.env')

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured')
}

const throughRawId = Number(readArg('--through-raw-id'))
if (!Number.isInteger(throughRawId) || throughRawId <= 0) {
  throw new Error('Usage: npm run db:skip-raw-backlog -- --through-raw-id <raw_article_id>')
}

const reason =
  readArg('--reason') ??
  `skipped_backlog_before_raw_id_${throughRawId}_due_to_raw_title_pollution`

const sql = neon(process.env.DATABASE_URL)

async function main() {
  const preview = await sql`
    SELECT
      st.source_key,
      COUNT(*)::int AS skipped_count
    FROM articles_raw ar
    JOIN source_targets st ON st.source_target_id = ar.source_target_id
    WHERE ar.is_processed = false
      AND ar.raw_article_id <= ${throughRawId}
    GROUP BY st.source_key
    ORDER BY skipped_count DESC, st.source_key ASC
  `

  const updated = await sql`
    UPDATE articles_raw
    SET
      is_processed = true,
      has_source_update = false,
      process_after = now(),
      last_error = ${reason},
      updated_at = now()
    WHERE is_processed = false
      AND raw_article_id <= ${throughRawId}
    RETURNING raw_article_id
  `

  console.log(`skipped=${updated.length} through_raw_id=${throughRawId}`)
  console.log(`reason=${reason}`)
  for (const row of preview) {
    console.log(`${row.source_key}: ${row.skipped_count}`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
