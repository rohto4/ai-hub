#!/usr/bin/env node
/**
 * Layer1 / Layer2 health check
 * Usage:
 *   node scripts/check-layer12.mjs
 *   node scripts/check-layer12.mjs --json
 */
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
const jsonMode = process.argv.includes('--json')

async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params)
  return result.rows[0] ?? null
}

async function queryMany(sql, params = []) {
  const result = await pool.query(sql, params)
  return result.rows
}

function toNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

function printSection(title) {
  console.log(`\n[${title}]`)
}

function printKeyValue(label, value) {
  console.log(`${label}: ${value}`)
}

async function run() {
  const [
    sourcePolicyCounts,
    sourceTargets,
    rawTotals,
    enrichedTotals,
    rawBySource,
    contentPathCounts,
    summaryBasisCounts,
    publicationBasisCounts,
    summaryInputBasisCounts,
    provisionalCounts,
    dedupeCounts,
    provisionalDomains,
    latestRawErrors,
    topCandidates,
    latestEnriched,
    latestJobRuns,
    latestEnrichDiagnostics,
    latestEnrichFailures,
  ] = await Promise.all([
    queryMany(`
      SELECT
        content_access_policy,
        COUNT(*)::int AS count
      FROM source_targets
      WHERE is_active = true
      GROUP BY content_access_policy
      ORDER BY count DESC, content_access_policy ASC
    `),
    queryOne(`
      SELECT COUNT(*)::int AS source_targets
      FROM source_targets
      WHERE is_active = true
    `),
    queryOne(`
      SELECT
        COUNT(*)::int AS raw_total,
        COUNT(*) FILTER (WHERE is_processed = true)::int AS raw_processed,
        COUNT(*) FILTER (WHERE is_processed = false)::int AS raw_unprocessed,
        COUNT(*) FILTER (WHERE last_error IS NOT NULL)::int AS raw_with_error
      FROM articles_raw
    `),
    queryOne(`
      SELECT
        COUNT(*)::int AS enriched_total,
        COUNT(*) FILTER (WHERE is_provisional = true)::int AS provisional_total,
        COUNT(*) FILTER (WHERE is_provisional = false)::int AS ready_total,
        (SELECT COUNT(*)::int FROM articles_enriched_tags) AS enriched_tags_total,
        (SELECT COUNT(*)::int FROM tag_candidate_pool) AS candidate_pool_total,
        (SELECT COUNT(*)::int FROM tag_candidate_pool WHERE seen_count >= 8) AS candidate_pool_over_threshold
      FROM articles_enriched
    `),
    queryMany(`
      SELECT
        st.source_key,
        COUNT(*)::int AS raw_total,
        COUNT(*) FILTER (WHERE ar.is_processed = true)::int AS raw_processed,
        COUNT(*) FILTER (WHERE ar.is_processed = false)::int AS raw_unprocessed
      FROM source_targets st
      LEFT JOIN articles_raw ar ON ar.source_target_id = st.id
      WHERE st.is_active = true
      GROUP BY st.source_key
      ORDER BY raw_unprocessed DESC, raw_total DESC, st.source_key ASC
      LIMIT 12
    `),
    queryMany(`
      SELECT content_path, COUNT(*)::int AS count
      FROM articles_enriched
      GROUP BY content_path
      ORDER BY count DESC
    `),
    queryMany(`
      SELECT summary_basis, COUNT(*)::int AS count
      FROM articles_enriched
      GROUP BY summary_basis
      ORDER BY count DESC, summary_basis ASC
    `),
    queryMany(`
      SELECT publication_basis, COUNT(*)::int AS count
      FROM articles_enriched
      GROUP BY publication_basis
      ORDER BY count DESC, publication_basis ASC
    `),
    queryMany(`
      SELECT summary_input_basis, COUNT(*)::int AS count
      FROM articles_enriched
      GROUP BY summary_input_basis
      ORDER BY count DESC, summary_input_basis ASC
    `),
    queryMany(`
      SELECT
        is_provisional,
        COALESCE(provisional_reason, 'none') AS provisional_reason,
        COUNT(*)::int AS count
      FROM articles_enriched
      GROUP BY is_provisional, COALESCE(provisional_reason, 'none')
      ORDER BY is_provisional DESC, count DESC
    `),
    queryMany(`
      SELECT dedupe_status, COUNT(*)::int AS count
      FROM articles_enriched
      GROUP BY dedupe_status
      ORDER BY count DESC
    `),
    queryMany(`
      SELECT
        lower(regexp_replace(split_part(split_part(coalesce(cited_url, canonical_url, normalized_url), '://', 2), '/', 1), '^www\\.', '')) AS domain,
        COALESCE(provisional_reason, 'snippet_only') AS provisional_reason,
        COUNT(*)::int AS count
      FROM articles_enriched
      WHERE is_provisional = true
      GROUP BY 1, 2
      ORDER BY count DESC, domain ASC
      LIMIT 10
    `),
    queryMany(`
      SELECT id, title, last_error, updated_at
      FROM articles_raw
      WHERE last_error IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `),
    queryMany(`
      SELECT candidate_key, display_name, seen_count, review_status
      FROM tag_candidate_pool
      ORDER BY seen_count DESC, last_seen_at DESC
      LIMIT 15
    `),
    queryMany(`
      SELECT id, title, summary_basis, summary_input_basis, content_path, is_provisional, provisional_reason, dedupe_status, publish_candidate, score, processed_at
      , publication_basis
      FROM articles_enriched
      ORDER BY processed_at DESC
      LIMIT 10
    `),
    queryMany(`
      SELECT job_name, status, started_at, finished_at, processed_count, success_count, failed_count, last_error
      FROM job_runs
      ORDER BY started_at DESC
      LIMIT 10
    `),
    queryMany(`
      SELECT
        detail->>'extractionStage' AS extraction_stage,
        COUNT(*)::int AS count,
        AVG(NULLIF(detail->>'extractedLength', '')::int)::int AS avg_extracted_length,
        AVG(NULLIF(detail->>'snippetLength', '')::int)::int AS avg_snippet_length,
        COUNT(*) FILTER (WHERE detail->>'extractionError' IS NOT NULL)::int AS error_count
      FROM job_run_items
      WHERE job_run_id = (
        SELECT id
        FROM job_runs
        WHERE job_name = 'daily-enrich'
          AND status = 'completed'
        ORDER BY started_at DESC
        LIMIT 1
      )
      GROUP BY 1
      ORDER BY count DESC
    `),
    queryMany(`
      SELECT
        item_key,
        detail->>'title' AS title,
        detail->>'extractionStage' AS extraction_stage,
        detail->>'extractionError' AS extraction_error
      FROM job_run_items
      WHERE job_run_id = (
        SELECT id
        FROM job_runs
        WHERE job_name = 'daily-enrich'
          AND status = 'completed'
        ORDER BY started_at DESC
        LIMIT 1
      )
        AND (
          detail->>'extractionStage' IN ('fetch_error', 'extracted_below_threshold', 'domain_snippet_only', 'feed_only_policy', 'domain_needs_review')
        )
      ORDER BY item_key DESC
      LIMIT 10
    `),
  ])

  const summary = {
    checkedAt: new Date().toISOString(),
    sourceTargets: toNumber(sourceTargets?.source_targets),
    sourcePolicyCounts,
    raw: {
      total: toNumber(rawTotals?.raw_total),
      processed: toNumber(rawTotals?.raw_processed),
      unprocessed: toNumber(rawTotals?.raw_unprocessed),
      withError: toNumber(rawTotals?.raw_with_error),
    },
    enriched: {
      total: toNumber(enrichedTotals?.enriched_total),
      readyTotal: toNumber(enrichedTotals?.ready_total),
      provisionalTotal: toNumber(enrichedTotals?.provisional_total),
      tagsTotal: toNumber(enrichedTotals?.enriched_tags_total),
      candidatePoolTotal: toNumber(enrichedTotals?.candidate_pool_total),
      candidatePoolOverThreshold: toNumber(enrichedTotals?.candidate_pool_over_threshold),
    },
    rawBySource,
    contentPathCounts,
    summaryBasisCounts,
    publicationBasisCounts,
    summaryInputBasisCounts,
    provisionalCounts,
    dedupeCounts,
    provisionalDomains,
    latestRawErrors,
    topCandidates,
    latestEnriched,
    latestJobRuns,
    latestEnrichDiagnostics,
    latestEnrichFailures,
  }

  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  printSection('Summary')
  printKeyValue('checked_at', summary.checkedAt)
  printKeyValue('source_targets', summary.sourceTargets)
  printKeyValue(
    'source_policy_counts',
    summary.sourcePolicyCounts.map((row) => `${row.content_access_policy}=${row.count}`).join(', ') || 'none',
  )
  printKeyValue('raw_total', summary.raw.total)
  printKeyValue('raw_processed', summary.raw.processed)
  printKeyValue('raw_unprocessed', summary.raw.unprocessed)
  printKeyValue('raw_with_error', summary.raw.withError)
  printKeyValue('enriched_total', summary.enriched.total)
  printKeyValue('enriched_ready_total', summary.enriched.readyTotal)
  printKeyValue('enriched_provisional_total', summary.enriched.provisionalTotal)
  printKeyValue('enriched_tags_total', summary.enriched.tagsTotal)
  printKeyValue('candidate_pool_total', summary.enriched.candidatePoolTotal)
  printKeyValue('candidate_pool_over_threshold(>=8)', summary.enriched.candidatePoolOverThreshold)

  printSection('Raw By Source')
  for (const row of summary.rawBySource) {
    console.log(`${row.source_key}: total=${row.raw_total} processed=${row.raw_processed} unprocessed=${row.raw_unprocessed}`)
  }

  printSection('Content Paths')
  for (const row of summary.contentPathCounts) {
    console.log(`${row.content_path}: ${row.count}`)
  }

  printSection('Summary Basis')
  for (const row of summary.summaryBasisCounts) {
    console.log(`${row.summary_basis}: ${row.count}`)
  }

  printSection('Publication Basis')
  for (const row of summary.publicationBasisCounts) {
    console.log(`${row.publication_basis}: ${row.count}`)
  }

  printSection('Summary Input Basis')
  for (const row of summary.summaryInputBasisCounts) {
    console.log(`${row.summary_input_basis}: ${row.count}`)
  }

  printSection('Dedupe Status')
  for (const row of summary.dedupeCounts) {
    console.log(`${row.dedupe_status}: ${row.count}`)
  }

  printSection('Provisional Status')
  for (const row of summary.provisionalCounts) {
    console.log(`provisional=${row.is_provisional} reason=${row.provisional_reason} count=${row.count}`)
  }

  printSection('Provisional Domains')
  if (summary.provisionalDomains.length === 0) {
    console.log('none')
  } else {
    for (const row of summary.provisionalDomains) {
      console.log(`${row.domain} ${row.provisional_reason}: ${row.count}`)
    }
  }

  printSection('Latest Enriched')
  for (const row of summary.latestEnriched) {
    console.log(
      `#${row.id} ${row.content_path} basis=${row.summary_basis} summaryInput=${row.summary_input_basis} publication=${row.publication_basis} provisional=${row.is_provisional}:${row.provisional_reason ?? 'none'} ${row.dedupe_status} publish=${row.publish_candidate} score=${row.score} ${row.title}`,
    )
  }

  printSection('Top Tag Candidates')
  for (const row of summary.topCandidates) {
    console.log(`${row.candidate_key}: seen=${row.seen_count} status=${row.review_status}`)
  }

  printSection('Latest Raw Errors')
  if (summary.latestRawErrors.length === 0) {
    console.log('none')
  } else {
    for (const row of summary.latestRawErrors) {
      console.log(`#${row.id} ${row.last_error} :: ${row.title}`)
    }
  }

  printSection('Latest Job Runs')
  for (const row of summary.latestJobRuns) {
    console.log(
      `${row.job_name} ${row.status} processed=${row.processed_count} success=${row.success_count} failed=${row.failed_count} started=${row.started_at}`,
    )
  }

  printSection('Latest Enrich Diagnostics')
  if (summary.latestEnrichDiagnostics.length === 0) {
    console.log('none')
  } else {
    for (const row of summary.latestEnrichDiagnostics) {
      console.log(
        `${row.extraction_stage}: count=${row.count} avg_extracted_length=${row.avg_extracted_length ?? 0} avg_snippet_length=${row.avg_snippet_length ?? 0} errors=${row.error_count ?? 0}`,
      )
    }
  }

  printSection('Latest Enrich Failures')
  if (summary.latestEnrichFailures.length === 0) {
    console.log('none')
  } else {
    for (const row of summary.latestEnrichFailures) {
      console.log(
        `raw#${row.item_key} ${row.extraction_stage} error=${row.extraction_error ?? 'none'} ${row.title ?? ''}`,
      )
    }
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
