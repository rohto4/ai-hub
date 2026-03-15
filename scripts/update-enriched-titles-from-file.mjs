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
  const filePath = process.argv[2]
  if (!filePath) {
    throw new Error('Usage: node update-enriched-titles-from-file.mjs <json-file>')
  }

  const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  let updated = 0

  for (const item of translations) {
    await sql`
      UPDATE articles_enriched
      SET title = ${item.ja}
      WHERE enriched_article_id = ${parseInt(item.id)}
    `
    updated++
  }

  console.log(`✅ Updated ${updated} titles in articles_enriched`)
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
