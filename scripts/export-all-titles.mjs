import { neon } from '@neondatabase/serverless'
import path from 'node:path'
import fs from 'node:fs'

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

loadEnvFile('.env.local')
loadEnvFile('.env')

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured')
}

const sql = neon(process.env.DATABASE_URL)

async function main() {
  const startBatch = parseInt(process.argv[2] || '2')
  const endBatch = parseInt(process.argv[3] || '20')

  console.log(`Exporting batches ${startBatch}-${endBatch}...\n`)

  const allTitles = []

  for (let batch = startBatch; batch <= endBatch; batch++) {
    const offset = (batch - 1) * 50
    const rows = await sql`
      SELECT
        raw_article_id,
        title
      FROM articles_raw
      WHERE title IS NOT NULL
      ORDER BY raw_article_id ASC
      LIMIT 50 OFFSET ${offset}
    `

    if (rows.length === 0) break

    allTitles.push(...rows.map(r => ({
      id: r.raw_article_id,
      en: r.title
    })))

    console.log(`Batch ${batch}: ${rows.length} rows`)
  }

  console.log(`\nTotal: ${allTitles.length} titles\n`)
  console.log(JSON.stringify(allTitles, null, 2))
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
