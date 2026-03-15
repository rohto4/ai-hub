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

function unwrapGoogleRedirectUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    if (url.hostname !== 'www.google.com' || url.pathname !== '/url') {
      return rawUrl
    }

    const target = url.searchParams.get('url')
    return target ? decodeURIComponent(target) : rawUrl
  } catch {
    return rawUrl
  }
}

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(unwrapGoogleRedirectUrl(rawUrl))
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref', 'source', 'from']) {
      url.searchParams.delete(key)
    }
    url.hash = ''
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }
    if (url.protocol === 'http:') {
      url.protocol = 'https:'
    }
    return url.toString()
  } catch {
    return rawUrl
  }
}

async function main() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const rawRows = await client.query(`
      SELECT raw_article_id, source_url, cited_url
      FROM articles_raw
      WHERE source_url LIKE 'https://www.google.com/url%'
         OR cited_url LIKE 'https://www.google.com/url%'
    `)

    let rawUpdated = 0
    let enrichedUpdated = 0

    for (const row of rawRows.rows) {
      const nextCitedUrl = unwrapGoogleRedirectUrl(row.cited_url ?? row.source_url)
      const nextNormalizedUrl = normalizeUrl(nextCitedUrl)

      await client.query(
        `
          UPDATE articles_raw
          SET cited_url = $2,
              normalized_url = $3,
              updated_at = now()
          WHERE raw_article_id = $1
        `,
        [row.raw_article_id, nextCitedUrl, nextNormalizedUrl],
      )
      rawUpdated += 1

      const enrichedResult = await client.query(
        `
          UPDATE articles_enriched
          SET cited_url = $2,
              normalized_url = $3,
              canonical_url = $2,
              dedupe_group_key = CASE
                WHEN dedupe_status = 'unique' THEN $2
                ELSE dedupe_group_key
              END,
              updated_at = now()
          WHERE raw_article_id = $1
        `,
        [row.raw_article_id, nextCitedUrl, nextNormalizedUrl],
      )
      enrichedUpdated += enrichedResult.rowCount ?? 0
    }

    await client.query('COMMIT')
    console.log(JSON.stringify({ rawUpdated, enrichedUpdated }, null, 2))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
  .finally(async () => {
    await pool.end()
  })
