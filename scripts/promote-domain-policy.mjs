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
const positionalArgs = args.filter((arg) => !arg.startsWith('--'))
const domain = (positionalArgs[0] ?? '').toLowerCase().replace(/^www\./, '')
const fetchPolicy = positionalArgs[1] ?? 'fulltext_allowed'
const summaryPolicy = positionalArgs[2] ?? null
const limitArg = args.includes('--limit') ? args[args.indexOf('--limit') + 1] : null
const limit = Number.isFinite(Number(limitArg)) ? Math.max(1, Number(limitArg)) : 50
const provisionalOnly = !args.includes('--all')

const allowedFetchPolicies = new Set(['needs_review', 'fulltext_allowed', 'snippet_only', 'blocked'])
const allowedSummaryPolicies = new Set(['domain_default', 'summarize_full', 'summarize_snippet'])

async function run() {
  if (!domain || !allowedFetchPolicies.has(fetchPolicy)) {
    throw new Error(
      'Usage: node scripts/promote-domain-policy.mjs <domain> [fulltext_allowed|snippet_only|blocked|needs_review] [domain_default|summarize_full|summarize_snippet] [--limit 50] [--all]',
    )
  }

  const effectiveSummaryPolicy =
    summaryPolicy && allowedSummaryPolicies.has(summaryPolicy)
      ? summaryPolicy
      : fetchPolicy === 'fulltext_allowed'
        ? 'summarize_full'
        : fetchPolicy === 'needs_review'
          ? 'domain_default'
          : 'summarize_snippet'

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const domainUpdate = await client.query(
      `
        UPDATE observed_article_domains
        SET
          fetch_policy = $2,
          summary_policy = $3,
          updated_at = now()
        WHERE domain = $1
        RETURNING domain, fetch_policy, summary_policy
      `,
      [domain, fetchPolicy, effectiveSummaryPolicy],
    )

    if (domainUpdate.rowCount === 0) {
      throw new Error(`domain not found: ${domain}`)
    }

    const requeue = await client.query(
      `
        WITH target_rows AS (
          SELECT ar.raw_article_id
          FROM articles_raw ar
          ${provisionalOnly ? 'JOIN articles_enriched ae ON ae.raw_article_id = ar.raw_article_id' : ''}
          WHERE lower(regexp_replace(split_part(split_part(coalesce(ar.cited_url, ar.normalized_url), '://', 2), '/', 1), '^www\\.', '')) = $1
            ${provisionalOnly ? 'AND ae.is_provisional = true' : ''}
          ORDER BY ar.created_at DESC
          LIMIT $2
        )
        UPDATE articles_raw ar
        SET
          is_processed = false,
          has_source_update = true,
          process_after = now(),
          last_error = null,
          updated_at = now()
        FROM target_rows tr
        WHERE ar.raw_article_id = tr.raw_article_id
        RETURNING ar.raw_article_id
      `,
      [domain, limit],
    )

    await client.query('COMMIT')
    const row = domainUpdate.rows[0]
    console.log(
      `${row.domain} policy=${row.fetch_policy} summary=${row.summary_policy} requeued=${requeue.rowCount} provisional_only=${provisionalOnly}`,
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
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
