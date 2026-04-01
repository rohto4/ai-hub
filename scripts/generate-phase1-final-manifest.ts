#!/usr/bin/env npx tsx
import fs from 'node:fs'
import path from 'node:path'
import {
  buildPhase1DecisionManifest,
  parsePhase1DecisionMarkdown,
  type Phase1AliasDecisionRow,
} from '@/lib/tags/phase1-decisions'

function readArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function toMarkdown(manifest: ReturnType<typeof buildPhase1DecisionManifest>): string {
  const lines: string[] = [
    '# Phase 1 Final Manifest',
    '',
    `- generatedAt: ${manifest.generatedAt}`,
    `- judgeMarkdown: ${manifest.source.judgeMarkdown}`,
    `- aliasPolicy: ${manifest.source.aliasPolicy}`,
    '',
  ]

  const sections = [
    ['## Current Tags: Keep As Primary Tags', manifest.currentTags.keepAsPrimaryTags],
    ['## Current Tags: Move To Category', manifest.currentTags.moveToCategory],
    ['## Current Tags: Deprecate', manifest.currentTags.deprecate],
    ['## Current Tags: Hold', manifest.currentTags.hold],
    ['## New Tag Candidates: Adopt As Primary Tags', manifest.newTagCandidates.adoptAsPrimaryTags],
    ['## New Tag Candidates: Move To Category', manifest.newTagCandidates.moveToCategory],
    ['## New Tag Candidates: Reject', manifest.newTagCandidates.reject],
    ['## New Tag Candidates: Hold', manifest.newTagCandidates.hold],
    ['## New Tag Candidates: Deprecate', manifest.newTagCandidates.deprecate],
    ['## Current Categories: Keep', manifest.currentCategories.keep],
    ['## Current Categories: Deprecate', manifest.currentCategories.deprecate],
    ['## Current Categories: Hold', manifest.currentCategories.hold],
  ] as const

  for (const [title, items] of sections) {
    lines.push(title)
    lines.push('')
    lines.push('| key | label | item_type | counts | note |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const item of items) {
      lines.push(
        `| ${item.key} | ${item.label} | ${item.itemType} | ${JSON.stringify(item.counts).replace(/\|/g, '/')} | ${(item.note || '').replace(/\|/g, '/')} |`,
      )
    }
    lines.push('')
  }

  lines.push('## Aliases: Deprecate')
  lines.push('')
  lines.push('| group_id | comparable_key | canonical_key | terms | decision |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const item of manifest.aliases.deprecate) {
    lines.push(
      `| ${item.groupId} | ${item.comparableKey} | ${item.recommendedCanonicalKey} | ${item.terms.join(', ')} | ${item.decision} |`,
    )
  }
  lines.push('')

  return lines.join('\n')
}

async function main(): Promise<void> {
  const rootDir = readArg('--root', path.join(process.cwd(), 'af-20260326', 'phase1-retag'))
  const judgePath = readArg('--judge', path.join(rootDir, 'outputs', 'judge.md'))
  const aliasReviewPath = readArg('--alias-review', path.join(rootDir, 'tag-alias-review.json'))
  const outJsonPath = path.join(rootDir, 'outputs', 'final-tag-decisions.json')
  const outMdPath = path.join(rootDir, 'outputs', 'final-tag-decisions.md')

  if (!fs.existsSync(judgePath)) {
    throw new Error(`judge markdown not found: ${judgePath}`)
  }

  const judgeMarkdown = fs.readFileSync(judgePath, 'utf8')
  const decisionRows = parsePhase1DecisionMarkdown(judgeMarkdown)

  const aliasRows: Phase1AliasDecisionRow[] = fs.existsSync(aliasReviewPath)
    ? (JSON.parse(fs.readFileSync(aliasReviewPath, 'utf8')) as {
        groups: Array<{
          groupId: string
          comparableKey: string
          suggestedCanonicalKey: string
          aiEvaluation?: { recommendedCanonicalKey?: string | null }
          terms: Array<{ key: string }>
        }>
      }).groups.map((group) => ({
        groupId: group.groupId,
        comparableKey: group.comparableKey,
        decision: '廃止',
        recommendedCanonicalKey:
          group.aiEvaluation?.recommendedCanonicalKey ?? group.suggestedCanonicalKey,
        terms: group.terms.map((term) => term.key),
      }))
    : []

  const manifest = buildPhase1DecisionManifest({
    decisionRows,
    aliasRows,
    judgeMarkdownPath: path.relative(process.cwd(), judgePath).replace(/\\/g, '/'),
  })

  fs.mkdirSync(path.dirname(outJsonPath), { recursive: true })
  fs.writeFileSync(outJsonPath, JSON.stringify(manifest, null, 2), 'utf8')
  fs.writeFileSync(outMdPath, toMarkdown(manifest), 'utf8')

  console.log(`outJsonPath=${outJsonPath}`)
  console.log(`outMdPath=${outMdPath}`)
  console.log(`currentTagKeep=${manifest.currentTags.keepAsPrimaryTags.length}`)
  console.log(`currentTagDeprecate=${manifest.currentTags.deprecate.length}`)
  console.log(`newTagAdopt=${manifest.newTagCandidates.adoptAsPrimaryTags.length}`)
  console.log(`newTagReject=${manifest.newTagCandidates.reject.length}`)
  console.log(`aliasDeprecate=${manifest.aliases.deprecate.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
