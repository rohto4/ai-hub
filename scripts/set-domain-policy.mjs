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
const fetchPolicy = positionalArgs[1] ?? null
const summaryPolicy = positionalArgs[2] ?? null

const allowedFetchPolicies = new Set(['needs_review', 'fulltext_allowed', 'snippet_only', 'blocked'])
const allowedSummaryPolicies = new Set(['domain_default', 'summarize_full', 'summarize_snippet'])

async function run() {
  if (!domain || !fetchPolicy || !allowedFetchPolicies.has(fetchPolicy)) {
    throw new Error(
      'Usage: node scripts/set-domain-policy.mjs <domain> <needs_review|fulltext_allowed|snippet_only|blocked> [domain_default|summarize_full|summarize_snippet]',
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

  const result = await pool.query(
    `
      UPDATE observed_article_domains
      SET
        fetch_policy = $2,
        summary_policy = $3,
        updated_at = now()
      WHERE domain = $1
      RETURNING domain, fetch_policy, summary_policy, observed_article_count
    `,
    [domain, fetchPolicy, effectiveSummaryPolicy],
  )

  if (result.rowCount === 0) {
    throw new Error(`domain not found: ${domain}`)
  }

  const row = result.rows[0]
  console.log(
    `${row.domain} policy=${row.fetch_policy} summary=${row.summary_policy} count=${row.observed_article_count}`,
  )
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
