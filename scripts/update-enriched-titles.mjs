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
  const translationFiles = [
    './translations-batch-2-5.json',
    './translations-batch-6-10.json',
    './translations-batch-11-15.json',
    './translations-batch-16-20.json',
  ]

  let totalUpdated = 0

  for (const filePath of translationFiles) {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`)
      continue
    }

    console.log(`\n📄 Processing ${path.basename(filePath)}...`)

    const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'))

    for (const item of translations) {
      const { id, ja } = item

      await sql`
        UPDATE articles_enriched
        SET title = ${ja}
        WHERE raw_article_id = ${parseInt(id)}
      `

      totalUpdated++
    }

    console.log(`✅ Updated ${translations.length} titles`)
  }

  console.log(`\n✨ Total updated: ${totalUpdated} titles in articles_enriched`)
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
