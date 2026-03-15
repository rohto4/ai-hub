import fs from 'node:fs'
import path from 'node:path'
import * as cheerio from 'cheerio'
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

function readArg(flag, fallback = null) {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback
  }
  return process.argv[index + 1]
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function decodeHtml(value) {
  return cheerio.load(`<div>${value}</div>`).text()
}

const PUBLISHER_SUFFIX_PATTERNS = [
  /\s[-|]\s[^-|]{2,60}$/,
  /\s[|・]\s[^|・]{2,60}$/,
]

function looksLikePublisherSuffix(value) {
  const normalized = value.trim()
  if (!normalized) {
    return false
  }

  const wordCount = normalized.split(/\s+/).length
  return wordCount <= 6 && normalized.length <= 40
}

function normalizeHeadline(rawTitle) {
  let title = normalizeWhitespace(decodeHtml(rawTitle))

  for (const pattern of PUBLISHER_SUFFIX_PATTERNS) {
    const match = title.match(pattern)
    if (!match) continue

    const suffix = match[0]
    const cleanedSuffix = suffix.replace(/^\s*[-|・]\s*/, '')
    if (looksLikePublisherSuffix(cleanedSuffix)) {
      title = title.slice(0, title.length - suffix.length).trim()
    }
  }

  return title
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Referer: 'https://www.google.com/',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  })

  const html = await response.text()
  if (!response.ok) {
    throw new Error(`fetch failed ${response.status}`)
  }

  return html
}

function parseTitle(html) {
  const $ = cheerio.load(html)

  const candidates = [
    $('meta[property="og:title"]').attr('content'),
    $('meta[name="twitter:title"]').attr('content'),
    $('meta[name="title"]').attr('content'),
    $('article h1').first().text(),
    $('main h1').first().text(),
    $('h1').first().text(),
    $('title').first().text(),
  ]
    .map((value) => (typeof value === 'string' ? normalizeHeadline(value) : ''))
    .filter(Boolean)

  const best = candidates.find((value) => value.length >= 12) ?? candidates[0] ?? null
  if (!best) {
    throw new Error('title not found')
  }

  return best
}

loadEnvFile('.env.local')
loadEnvFile('.env')

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured')
}

const sourceKey = readArg('--source-key')
const limit = Math.max(1, Number(readArg('--limit', '50')))
const dryRun = process.argv.includes('--dry-run')

if (!sourceKey) {
  throw new Error('Usage: npm run db:repair-raw-titles-from-url -- --source-key <source-key> [--limit <n>] [--dry-run]')
}

const sql = neon(process.env.DATABASE_URL)

async function main() {
  const rows = await sql`
    SELECT
      ar.raw_article_id,
      ar.cited_url,
      ar.source_url,
      ar.title,
      ar.last_error
    FROM articles_raw ar
    JOIN source_targets st ON st.source_target_id = ar.source_target_id
    WHERE st.source_key = ${sourceKey}
      AND st.content_access_policy = 'fulltext_allowed'
      AND ar.is_processed = false
    ORDER BY ar.raw_article_id ASC
    LIMIT ${limit}
  `

  let updated = 0
  let failed = 0

  for (const row of rows) {
    const targetUrl = row.cited_url || row.source_url

    try {
      const html = await fetchHtml(targetUrl)
      const repairedTitle = parseTitle(html)

      if (dryRun) {
        console.log(`[dry-run] raw#${row.raw_article_id} ${row.title} -> ${repairedTitle}`)
        continue
      }

      await sql`
        UPDATE articles_raw
        SET
          title = ${repairedTitle},
          last_error = null,
          updated_at = now()
        WHERE raw_article_id = ${row.raw_article_id}
      `
      updated += 1
      console.log(`updated raw#${row.raw_article_id}: ${repairedTitle}`)
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      console.log(`failed raw#${row.raw_article_id}: ${message}`)
    }
  }

  console.log(`source=${sourceKey} scanned=${rows.length} updated=${updated} failed=${failed} dryRun=${dryRun}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
