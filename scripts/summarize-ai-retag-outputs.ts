#!/usr/bin/env npx tsx
import fs from 'node:fs'
import path from 'node:path'
import {
  PHASE1_CATEGORY_CANDIDATE_KEYS,
  PHASE1_PRIMARY_TAG_EXCLUSION_KEYS,
  isPhase1ExcludedTagLikeValue,
  normalizePhase1CandidateName,
} from '@/lib/tags/retag-phase1'

type OutputItem = {
  enrichedArticleId: number
  primaryTagKeys: string[]
  adjacentTagKeys: string[]
  primaryEvidenceKeywords: string[]
  adjacentEvidenceKeywords: string[]
  proposedPrimaryTags: Array<{
    displayName: string
    reason: string
    evidenceKeywords: string[]
  }>
  proposedAdjacentTags: Array<{
    displayName: string
    reason: string
    evidenceKeywords: string[]
  }>
  note?: string
}

type OutputFile = {
  generatedAt?: string
  total?: number
  items: OutputItem[]
}

function readArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function countMapToSorted(map: Map<string, number>) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
}

async function main(): Promise<void> {
  const rootDir = readArg('--root', path.join(process.cwd(), 'artifacts', 'ai-retag-all'))
  const outputsDir = path.join(rootDir, 'outputs')
  const summaryPath = path.join(rootDir, 'outputs-summary.json')

  const files = fs.existsSync(outputsDir)
    ? fs.readdirSync(outputsDir).filter((file) => file.endsWith('.json')).sort()
    : []

  if (files.length === 0) {
    throw new Error(`No output files found: ${outputsDir}`)
  }

  let totalItems = 0
  let primaryTagAssignments = 0
  let adjacentTagAssignments = 0
  const primaryTagKeyCount = new Map<string, number>()
  const adjacentTagKeyCount = new Map<string, number>()
  const primaryEvidenceCount = new Map<string, number>()
  const adjacentEvidenceCount = new Map<string, number>()
  const proposedPrimaryCount = new Map<string, number>()
  const proposedAdjacentCount = new Map<string, number>()
  const proposedPrimaryReasonSample = new Map<string, string>()
  const proposedAdjacentReasonSample = new Map<string, string>()

  for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(path.join(outputsDir, file), 'utf8')) as OutputFile
    for (const item of parsed.items ?? []) {
      totalItems += 1

      for (const key of item.primaryTagKeys ?? []) {
        primaryTagAssignments += 1
        primaryTagKeyCount.set(key, (primaryTagKeyCount.get(key) ?? 0) + 1)
      }
      for (const key of item.adjacentTagKeys ?? []) {
        adjacentTagAssignments += 1
        adjacentTagKeyCount.set(key, (adjacentTagKeyCount.get(key) ?? 0) + 1)
      }
      for (const keyword of item.primaryEvidenceKeywords ?? []) {
        primaryEvidenceCount.set(keyword, (primaryEvidenceCount.get(keyword) ?? 0) + 1)
      }
      for (const keyword of item.adjacentEvidenceKeywords ?? []) {
        adjacentEvidenceCount.set(keyword, (adjacentEvidenceCount.get(keyword) ?? 0) + 1)
      }

      for (const proposed of item.proposedPrimaryTags ?? []) {
        const normalized = normalizePhase1CandidateName(proposed.displayName)
        if (isPhase1ExcludedTagLikeValue(normalized)) continue
        proposedPrimaryCount.set(normalized, (proposedPrimaryCount.get(normalized) ?? 0) + 1)
        if (!proposedPrimaryReasonSample.has(normalized) && proposed.reason) {
          proposedPrimaryReasonSample.set(normalized, proposed.reason)
        }
      }
      for (const proposed of item.proposedAdjacentTags ?? []) {
        const normalized = normalizePhase1CandidateName(proposed.displayName)
        proposedAdjacentCount.set(normalized, (proposedAdjacentCount.get(normalized) ?? 0) + 1)
        if (!proposedAdjacentReasonSample.has(normalized) && proposed.reason) {
          proposedAdjacentReasonSample.set(normalized, proposed.reason)
        }
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    outputsDir: path.relative(process.cwd(), outputsDir).replace(/\\/g, '/'),
    totalItems,
    averagePrimaryTagsPerItem: totalItems > 0 ? primaryTagAssignments / totalItems : 0,
    averageAdjacentTagsPerItem: totalItems > 0 ? adjacentTagAssignments / totalItems : 0,
    phase1PrimaryExclusions: PHASE1_PRIMARY_TAG_EXCLUSION_KEYS,
    phase1CategoryCandidates: PHASE1_CATEGORY_CANDIDATE_KEYS,
    topPrimaryTagKeys: countMapToSorted(primaryTagKeyCount).slice(0, 100),
    topAdjacentTagKeys: countMapToSorted(adjacentTagKeyCount).slice(0, 100),
    topPrimaryEvidenceKeywords: countMapToSorted(primaryEvidenceCount).slice(0, 200),
    topAdjacentEvidenceKeywords: countMapToSorted(adjacentEvidenceCount).slice(0, 200),
    proposedPrimaryTags: countMapToSorted(proposedPrimaryCount).map((entry) => ({
      displayNameNormalized: entry.key,
      count: entry.count,
      sampleReason: proposedPrimaryReasonSample.get(entry.key) ?? '',
    })),
    proposedAdjacentTags: countMapToSorted(proposedAdjacentCount).map((entry) => ({
      displayNameNormalized: entry.key,
      count: entry.count,
      sampleReason: proposedAdjacentReasonSample.get(entry.key) ?? '',
    })),
  }

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`summaryPath=${summaryPath}`)
  console.log(`totalItems=${totalItems}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
