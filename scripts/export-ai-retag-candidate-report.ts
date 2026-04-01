#!/usr/bin/env npx tsx
import fs from 'node:fs'
import path from 'node:path'
import {
  PHASE1_CATEGORY_CANDIDATE_KEYS,
  PHASE1_PRIMARY_TAG_EXCLUSION_KEYS,
} from '@/lib/tags/retag-phase1'

type SummaryEntry = {
  key?: string
  count: number
}

type ProposedEntry = {
  displayNameNormalized: string
  count: number
  sampleReason?: string
}

type SummaryFile = {
  generatedAt?: string
  totalItems: number
  averagePrimaryTagsPerItem?: number
  averageAdjacentTagsPerItem?: number
  topPrimaryTagKeys?: SummaryEntry[]
  topAdjacentTagKeys?: SummaryEntry[]
  proposedPrimaryTags?: ProposedEntry[]
  proposedAdjacentTags?: ProposedEntry[]
}

function readArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function formatTop(entries: SummaryEntry[] | undefined, limit: number): string {
  return (entries ?? [])
    .slice(0, limit)
    .map((entry) => `- ${entry.key}: ${entry.count}`)
    .join('\n')
}

function formatCandidates(entries: ProposedEntry[] | undefined, limit: number): string {
  return (entries ?? [])
    .slice(0, limit)
    .map((entry) => {
      const reason = entry.sampleReason ? ` | ${entry.sampleReason}` : ''
      return `- ${entry.displayNameNormalized}: ${entry.count}${reason}`
    })
    .join('\n')
}

async function main(): Promise<void> {
  const rootDir = readArg('--root', path.join(process.cwd(), 'artifacts', 'ai-retag-all'))
  const summaryPath = path.join(rootDir, 'outputs-summary.json')
  const reviewJsonPath = path.join(rootDir, 'candidate-review.json')
  const reviewMdPath = path.join(rootDir, 'candidate-review.md')

  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Summary file not found: ${summaryPath}`)
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as SummaryFile
  const review = {
    generatedAt: new Date().toISOString(),
    rootDir: path.relative(process.cwd(), rootDir).replace(/\\/g, '/'),
    totalItems: summary.totalItems,
    averagePrimaryTagsPerItem: summary.averagePrimaryTagsPerItem ?? 0,
    averageAdjacentTagsPerItem: summary.averageAdjacentTagsPerItem ?? 0,
    phase1PrimaryExclusions: PHASE1_PRIMARY_TAG_EXCLUSION_KEYS,
    phase1CategoryCandidates: PHASE1_CATEGORY_CANDIDATE_KEYS,
    topPrimaryTagKeys: (summary.topPrimaryTagKeys ?? []).slice(0, 50),
    topAdjacentTagKeys: (summary.topAdjacentTagKeys ?? []).slice(0, 50),
    proposedPrimaryTags: (summary.proposedPrimaryTags ?? []).filter((entry) => entry.count >= 2),
    proposedAdjacentTags: (summary.proposedAdjacentTags ?? []).filter((entry) => entry.count >= 2),
  }

  fs.writeFileSync(reviewJsonPath, JSON.stringify(review, null, 2), 'utf8')

  const markdown = [
    '# AI Retag Phase 1 Candidate Review',
    '',
    `- generatedAt: ${review.generatedAt}`,
    `- rootDir: ${review.rootDir}`,
    `- totalItems: ${review.totalItems}`,
    `- averagePrimaryTagsPerItem: ${review.averagePrimaryTagsPerItem.toFixed(2)}`,
    `- averageAdjacentTagsPerItem: ${review.averageAdjacentTagsPerItem.toFixed(2)}`,
    '',
    '## Phase 1 fixed rules',
    `- excludedPrimaryTags: ${PHASE1_PRIMARY_TAG_EXCLUSION_KEYS.join(', ')}`,
    `- categoryCandidates: ${PHASE1_CATEGORY_CANDIDATE_KEYS.join(', ')}`,
    '',
    '## Top Primary Tag Keys',
    formatTop(review.topPrimaryTagKeys, 30) || '- none',
    '',
    '## Top Adjacent Tag Keys',
    formatTop(review.topAdjacentTagKeys, 20) || '- none',
    '',
    '## Proposed Primary Tags',
    formatCandidates(review.proposedPrimaryTags, 200) || '- none',
    '',
    '## Proposed Adjacent Tags',
    formatCandidates(review.proposedAdjacentTags, 100) || '- none',
    '',
  ].join('\n')

  fs.writeFileSync(reviewMdPath, markdown, 'utf8')
  console.log(`reviewJsonPath=${reviewJsonPath}`)
  console.log(`reviewMdPath=${reviewMdPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
