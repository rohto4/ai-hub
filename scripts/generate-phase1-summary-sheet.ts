#!/usr/bin/env npx tsx
import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSql } from '@/lib/db'
import { PHASE1_CATEGORY_CANDIDATE_KEYS } from '@/lib/tags/retag-phase1'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

const CURRENT_SOURCE_CATEGORY_KEYS = [
  'llm',
  'agent',
  'voice',
  'policy',
  'safety',
  'search',
  'news',
] as const

const CURRENT_SOURCE_TYPE_KEYS = [
  'official',
  'blog',
  'news',
  'video',
  'alerts',
  'paper',
] as const

type ExistingTagRow = {
  tag_key: string
  display_name: string
  article_count: number | null
}

type CountRow = {
  key: string
  count: number
}

type CandidateReviewCandidate = {
  candidateKey: string
  displayName: string
  seenCount: number
  reviewStatus: string
  manualReviewRequired: boolean
  latestTrendsScore: number | null
  categoryCandidate: boolean
  originTitle: string | null
  sourceUrl: string | null
}

type CandidateReviewFile = {
  generatedAt?: string
  totalCandidates: number
  candidates: CandidateReviewCandidate[]
}

function readArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function toCountMap(rows: CountRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.key, row.count] as const))
}

function formatTable(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const normalizedRows = rows.map((row) => row.map((value) => (value ?? '').toString()))
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...normalizedRows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

async function main(): Promise<void> {
  const rootDir = readArg('--root', path.join(process.cwd(), 'af-20260326', 'phase1-retag'))
  const candidateReviewPath = path.join(rootDir, 'candidate-pool-review.json')
  const outJsonPath = path.join(rootDir, 'summary-sheet.json')
  const outMdPath = path.join(rootDir, 'summary-sheet.md')

  if (!fs.existsSync(candidateReviewPath)) {
    throw new Error(`candidate review not found: ${candidateReviewPath}`)
  }

  const candidateReview = JSON.parse(
    fs.readFileSync(candidateReviewPath, 'utf8'),
  ) as CandidateReviewFile

  const sql = getSql()
  const [existingTags, sourceCategoryCountsRaw, sourceTypeCountsRaw] = await Promise.all([
    (sql`
      SELECT tag_key, display_name, article_count
      FROM tags_master
      WHERE is_active = true
      ORDER BY article_count DESC NULLS LAST, display_name ASC
    `) as unknown as Promise<ExistingTagRow[]>,
    (sql`
      SELECT source_category AS key, COUNT(*)::int AS count
      FROM public_articles
      WHERE visibility_status = 'published'
      GROUP BY source_category
      ORDER BY count DESC, source_category ASC
    `) as unknown as Promise<CountRow[]>,
    (sql`
      SELECT source_type AS key, COUNT(*)::int AS count
      FROM public_articles
      WHERE visibility_status = 'published'
      GROUP BY source_type
      ORDER BY count DESC, source_type ASC
    `) as unknown as Promise<CountRow[]>,
  ])

  const sourceCategoryCounts = toCountMap(sourceCategoryCountsRaw)
  const sourceTypeCounts = toCountMap(sourceTypeCountsRaw)
  const existingTagMap = new Map(
    existingTags.map((tag) => [
      tag.tag_key,
      {
        displayName: tag.display_name,
        articleCount: tag.article_count ?? 0,
      },
    ]),
  )
  const candidateMap = new Map(
    candidateReview.candidates.map((candidate) => [candidate.candidateKey, candidate]),
  )

  const categoryCandidates = PHASE1_CATEGORY_CANDIDATE_KEYS.map((key) => {
    const candidate = candidateMap.get(key)
    const existing = existingTagMap.get(key)
    return {
      key,
      candidateSeenCount: candidate?.seenCount ?? 0,
      candidateStatus: candidate?.reviewStatus ?? '',
      existingTagArticleCount: existing?.articleCount ?? 0,
      currentSourceCategoryCount: sourceCategoryCounts.get(key) ?? 0,
      currentSourceTypeCount: sourceTypeCounts.get(key) ?? 0,
    }
  })

  const summary = {
    generatedAt: new Date().toISOString(),
    rootDir: path.relative(process.cwd(), rootDir).replace(/\\/g, '/'),
    overview: {
      currentActiveTagCount: existingTags.length,
      newTagCandidateCount: candidateReview.totalCandidates,
      currentSourceCategoryCount: CURRENT_SOURCE_CATEGORY_KEYS.length,
      currentSourceTypeCount: CURRENT_SOURCE_TYPE_KEYS.length,
      phase1CategoryCandidateCount: PHASE1_CATEGORY_CANDIDATE_KEYS.length,
    },
    currentTags: existingTags.map((tag) => ({
      tagKey: tag.tag_key,
      displayName: tag.display_name,
      articleCount: tag.article_count ?? 0,
    })),
    newTagCandidates: candidateReview.candidates,
    currentCategories: {
      sourceCategory: CURRENT_SOURCE_CATEGORY_KEYS.map((key) => ({
        key,
        publishedArticleCount: sourceCategoryCounts.get(key) ?? 0,
      })),
      sourceType: CURRENT_SOURCE_TYPE_KEYS.map((key) => ({
        key,
        publishedArticleCount: sourceTypeCounts.get(key) ?? 0,
      })),
    },
    categoryCandidates,
    newTagAssignmentCounts: candidateReview.candidates.map((candidate) => ({
      candidateKey: candidate.candidateKey,
      displayName: candidate.displayName,
      seenCount: candidate.seenCount,
      reviewStatus: candidate.reviewStatus,
      manualReviewRequired: candidate.manualReviewRequired,
    })),
  }

  fs.writeFileSync(outJsonPath, JSON.stringify(summary, null, 2), 'utf8')

  const markdown = [
    '# Phase 1 Summary Sheet',
    '',
    `- generatedAt: ${summary.generatedAt}`,
    `- rootDir: ${summary.rootDir}`,
    '',
    '## Overview',
    `- currentActiveTagCount: ${summary.overview.currentActiveTagCount}`,
    `- newTagCandidateCount: ${summary.overview.newTagCandidateCount}`,
    `- currentSourceCategoryCount: ${summary.overview.currentSourceCategoryCount}`,
    `- currentSourceTypeCount: ${summary.overview.currentSourceTypeCount}`,
    `- phase1CategoryCandidateCount: ${summary.overview.phase1CategoryCandidateCount}`,
    '',
    '## Current Tags',
    formatTable(
      ['tag_key', 'display_name', 'article_count'],
      summary.currentTags.map((tag) => [tag.tagKey, tag.displayName, tag.articleCount]),
    ),
    '',
    '## New Tag Candidates',
    formatTable(
      ['candidate_key', 'display_name', 'seen_count', 'review_status', 'manual_review_required'],
      summary.newTagCandidates.map((candidate) => [
        candidate.candidateKey,
        candidate.displayName,
        candidate.seenCount,
        candidate.reviewStatus,
        candidate.manualReviewRequired ? 'true' : 'false',
      ]),
    ),
    '',
    '## Current Categories: source_category',
    formatTable(
      ['source_category', 'published_article_count'],
      summary.currentCategories.sourceCategory.map((category) => [
        category.key,
        category.publishedArticleCount,
      ]),
    ),
    '',
    '## Current Categories: source_type',
    formatTable(
      ['source_type', 'published_article_count'],
      summary.currentCategories.sourceType.map((category) => [
        category.key,
        category.publishedArticleCount,
      ]),
    ),
    '',
    '## Category Candidates',
    formatTable(
      [
        'candidate_key',
        'candidate_seen_count',
        'candidate_status',
        'existing_tag_article_count',
        'current_source_category_count',
        'current_source_type_count',
      ],
      summary.categoryCandidates.map((candidate) => [
        candidate.key,
        candidate.candidateSeenCount,
        candidate.candidateStatus,
        candidate.existingTagArticleCount,
        candidate.currentSourceCategoryCount,
        candidate.currentSourceTypeCount,
      ]),
    ),
    '',
    '## New Tag Assignment Counts',
    formatTable(
      ['candidate_key', 'display_name', 'seen_count', 'review_status', 'manual_review_required'],
      summary.newTagAssignmentCounts.map((candidate) => [
        candidate.candidateKey,
        candidate.displayName,
        candidate.seenCount,
        candidate.reviewStatus,
        candidate.manualReviewRequired ? 'true' : 'false',
      ]),
    ),
    '',
  ].join('\n')

  fs.writeFileSync(outMdPath, markdown, 'utf8')
  console.log(`outJsonPath=${outJsonPath}`)
  console.log(`outMdPath=${outMdPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
