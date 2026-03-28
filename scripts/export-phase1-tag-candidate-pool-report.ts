#!/usr/bin/env npx tsx
import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSql } from '@/lib/db'
import {
  PHASE1_CATEGORY_CANDIDATE_KEYS,
  PHASE1_PRIMARY_TAG_EXCLUSION_KEYS,
  isPhase1ExcludedTagLikeValue,
} from '@/lib/tags/retag-phase1'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

type CandidateRow = {
  candidate_key: string
  display_name: string
  seen_count: number
  review_status: string
  manual_review_required: boolean
  latest_trends_score: number | null
  origin_title: string | null
  source_url: string | null
}

type ExistingTagRow = {
  tag_key: string
  display_name: string
}

const SHORTLIST_GENERIC_EXCLUSIONS = new Set([
  'llms',
  'transformer',
  'transformers',
  'arxiv',
  'ai',
  'rl',
  'chain-of-thought',
  'evolving',
  'driven',
  'automated',
  'diffusion models',
  'federated',
  'federated learning',
  'large language models',
  'domain',
  'machine',
  'information',
  'prediction',
  'continual',
  'continual learning',
  'dynamics',
  'generalized',
  'robust',
  'structure',
  'attention',
  'clustering',
  'responses',
  'adversarial',
  'distillation',
  'generalization',
  'latent',
])

function readArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function readIntArg(flag: string, fallback: number): number {
  const raw = readArg(flag, String(fallback))
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : fallback
}

async function main(): Promise<void> {
  const rootDir = readArg('--root', path.join(process.cwd(), 'af-20260326', 'phase1-retag'))
  const minSeen = readIntArg('--min-seen', 4)
  const outJsonPath = path.join(rootDir, 'candidate-pool-review.json')
  const outMdPath = path.join(rootDir, 'candidate-pool-review.md')
  const shortlistMdPath = path.join(rootDir, 'candidate-pool-shortlist.md')
  const curatedShortlistMdPath = path.join(rootDir, 'candidate-pool-curated-shortlist.md')

  fs.mkdirSync(rootDir, { recursive: true })

  const sql = getSql()
  const [candidates, existingTags] = await Promise.all([
    (sql`
      SELECT
        tcp.candidate_key,
        tcp.display_name,
        tcp.seen_count,
        tcp.review_status,
        tcp.manual_review_required,
        tcp.latest_trends_score,
        ar.title AS origin_title,
        ar.source_url
      FROM tag_candidate_pool tcp
      LEFT JOIN articles_raw ar ON ar.raw_article_id = tcp.latest_origin_raw_id::bigint
      WHERE tcp.seen_count >= ${minSeen}
        AND tcp.review_status IN ('candidate', 'trend_matched', 'manual_review')
      ORDER BY tcp.seen_count DESC, tcp.last_seen_at DESC, tcp.display_name ASC
    `) as unknown as Promise<CandidateRow[]>,
    (sql`
      SELECT tag_key, display_name
      FROM tags_master
      WHERE is_active = true
    `) as unknown as Promise<ExistingTagRow[]>,
  ])

  const existingComparable = new Set<string>()
  for (const tag of existingTags) {
    existingComparable.add(tag.tag_key)
    existingComparable.add(tag.display_name.trim().toLowerCase())
  }

  const filtered = candidates
    .filter((row) => !isPhase1ExcludedTagLikeValue(row.candidate_key))
    .filter((row) => !isPhase1ExcludedTagLikeValue(row.display_name))
    .filter((row) => !existingComparable.has(row.candidate_key))
    .filter((row) => !existingComparable.has(row.display_name.trim().toLowerCase()))
    .map((row) => ({
      candidateKey: row.candidate_key,
      displayName: row.display_name,
      seenCount: row.seen_count,
      reviewStatus: row.review_status,
      manualReviewRequired: row.manual_review_required,
      latestTrendsScore: row.latest_trends_score,
      categoryCandidate: PHASE1_CATEGORY_CANDIDATE_KEYS.includes(
        row.candidate_key as (typeof PHASE1_CATEGORY_CANDIDATE_KEYS)[number],
      ),
      originTitle: row.origin_title,
      sourceUrl: row.source_url,
    }))

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'tag_candidate_pool',
    minSeen,
    phase1PrimaryExclusions: PHASE1_PRIMARY_TAG_EXCLUSION_KEYS,
    phase1CategoryCandidates: PHASE1_CATEGORY_CANDIDATE_KEYS,
    totalCandidates: filtered.length,
    candidates: filtered,
  }

  fs.writeFileSync(outJsonPath, JSON.stringify(report, null, 2), 'utf8')

  const markdown = [
    '# Phase 1 Candidate Pool Review',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- source: ${report.source}`,
    `- minSeen: ${report.minSeen}`,
    `- totalCandidates: ${report.totalCandidates}`,
    `- excludedPrimaryTags: ${PHASE1_PRIMARY_TAG_EXCLUSION_KEYS.join(', ')}`,
    `- categoryCandidates: ${PHASE1_CATEGORY_CANDIDATE_KEYS.join(', ')}`,
    '',
    '## Candidates',
    ...filtered.map((candidate) => {
      const flags = [
        `seen=${candidate.seenCount}`,
        `status=${candidate.reviewStatus}`,
        candidate.categoryCandidate ? 'category-candidate' : null,
        candidate.manualReviewRequired ? 'manual-review' : null,
      ].filter(Boolean)
      const title = candidate.originTitle ? ` | title=${candidate.originTitle}` : ''
      return `- ${candidate.displayName} (${candidate.candidateKey}) | ${flags.join(', ')}${title}`
    }),
    '',
  ].join('\n')

  fs.writeFileSync(outMdPath, markdown, 'utf8')
  const shortlist = filtered.filter((candidate) => candidate.seenCount >= 7)
  const shortlistMarkdown = [
    '# Phase 1 Candidate Pool Shortlist',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- threshold: seen_count >= 7`,
    `- totalCandidates: ${shortlist.length}`,
    '',
    '## Shortlist',
    ...shortlist.map((candidate) => {
      const flags = [
        `seen=${candidate.seenCount}`,
        `status=${candidate.reviewStatus}`,
        candidate.categoryCandidate ? 'category-candidate' : null,
      ].filter(Boolean)
      const title = candidate.originTitle ? ` | title=${candidate.originTitle}` : ''
      return `- ${candidate.displayName} (${candidate.candidateKey}) | ${flags.join(', ')}${title}`
    }),
    '',
  ].join('\n')

  fs.writeFileSync(shortlistMdPath, shortlistMarkdown, 'utf8')
  const curatedShortlist = shortlist.filter(
    (candidate) => !SHORTLIST_GENERIC_EXCLUSIONS.has(candidate.candidateKey),
  )
  const curatedShortlistMarkdown = [
    '# Phase 1 Candidate Pool Curated Shortlist',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- threshold: seen_count >= 7`,
    `- totalCandidates: ${curatedShortlist.length}`,
    `- helperExclusions: ${[...SHORTLIST_GENERIC_EXCLUSIONS].join(', ')}`,
    '',
    '## Curated Shortlist',
    ...curatedShortlist.map((candidate) => {
      const flags = [
        `seen=${candidate.seenCount}`,
        `status=${candidate.reviewStatus}`,
        candidate.categoryCandidate ? 'category-candidate' : null,
      ].filter(Boolean)
      const title = candidate.originTitle ? ` | title=${candidate.originTitle}` : ''
      return `- ${candidate.displayName} (${candidate.candidateKey}) | ${flags.join(', ')}${title}`
    }),
    '',
  ].join('\n')

  fs.writeFileSync(curatedShortlistMdPath, curatedShortlistMarkdown, 'utf8')
  console.log(`outJsonPath=${outJsonPath}`)
  console.log(`outMdPath=${outMdPath}`)
  console.log(`shortlistMdPath=${shortlistMdPath}`)
  console.log(`curatedShortlistMdPath=${curatedShortlistMdPath}`)
  console.log(`totalCandidates=${filtered.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
