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
  const result = await sql`
    UPDATE articles_raw r
    SET title = e.title
    FROM articles_enriched e
    WHERE r.raw_article_id = e.raw_article_id
    RETURNING r.raw_article_id
  `

  console.log(`✅ Restored ${result.length} titles in articles_raw from articles_enriched`)
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
