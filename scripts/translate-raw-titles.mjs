import { neon } from '@neondatabase/serverless'
import path from 'node:path'
import fs from 'node:fs'
import readline from 'node:readline'

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

async function fetchBatch(batchNum, offset) {
  const rows = await sql`
    SELECT
      raw_article_id,
      title
    FROM articles_raw
    WHERE title IS NOT NULL
    ORDER BY raw_article_id ASC
    LIMIT 50 OFFSET ${offset}
  `

  return rows
}

async function updateTitles(translations) {
  let updated = 0
  for (const item of translations) {
    await sql`
      UPDATE articles_raw
      SET title = ${item.ja}
      WHERE raw_article_id = ${item.id}
    `
    updated++
  }
  return updated
}

async function main() {
  const batchNum = parseInt(process.argv[2] || '1')
  const offset = (batchNum - 1) * 50

  console.log(`\n=== Batch ${batchNum}/20 (offset=${offset}) ===\n`)

  const rows = await fetchBatch(batchNum, offset)

  if (rows.length === 0) {
    console.log('✅ All titles translated!')
    process.exit(0)
  }

  console.log(`📋 Fetched ${rows.length} rows for translation:\n`)

  const titlesJson = rows.map(r => ({
    id: r.raw_article_id,
    en: r.title
  }))

  // Display titles to translate
  rows.forEach((row, idx) => {
    console.log(`${String(idx + 1).padStart(2)} [${String(row.raw_article_id).padStart(4)}] ${row.title}`)
  })

  console.log('\n📝 Waiting for translations (paste JSON array format)...\n')
  console.log('Expected format:')
  console.log('[{"id": <number>, "ja": "<japanese-title>"}, ...]')
  console.log('')

  // Read translations from stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  let input = ''
  rl.on('line', (line) => {
    input += line
  })

  rl.on('close', async () => {
    try {
      const translations = JSON.parse(input)

      if (!Array.isArray(translations)) {
        throw new Error('Input must be a JSON array')
      }

      const updated = await updateTitles(translations)
      console.log(`\n✅ Updated ${updated} titles in database`)
      console.log(`Next batch: npm run translate-raw-titles -- ${batchNum + 1}`)
    } catch (error) {
      console.error('❌ Error parsing translations:', error.message)
      process.exit(1)
    }
  })
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
