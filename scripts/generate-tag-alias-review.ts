#!/usr/bin/env npx tsx
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildAliasReviewGroups, type AliasReviewEntry } from '@/lib/tags/alias-review'

type SummaryTag = {
  tagKey: string
  displayName: string
  articleCount: number
}

type SummaryCandidate = {
  candidateKey: string
  displayName: string
  seenCount: number
  reviewStatus: string
  manualReviewRequired: boolean
  originTitle: string | null
}

type SummarySheet = {
  currentTags: SummaryTag[]
  newTagCandidates: SummaryCandidate[]
}

type AliasAiStatus = 'alias' | 'separate' | 'review' | 'error'
type AliasAiConfidence = 'high' | 'medium' | 'low'

type AliasAiEvaluation = {
  status: AliasAiStatus
  confidence: AliasAiConfidence
  recommendedCanonicalKey: string | null
  recommendedCanonicalLabel: string | null
  rationaleJa: string
  cautionJa: string
}

type AliasReviewReport = {
  generatedAt: string
  sourceSummaryPath: string
  totalGroups: number
  groups: Array<{
    groupId: string
    comparableKey: string
    heuristics: string[]
    suggestedCanonicalKey: string
    suggestedCanonicalLabel: string
    aiEvaluation: AliasAiEvaluation
    terms: AliasReviewEntry[]
  }>
}

function readArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function readBoolArg(flag: string): boolean {
  return process.argv.includes(flag)
}

function extractJsonObject(raw: string): string {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`JSON object not found in Gemini output: ${raw.slice(0, 300)}`)
  }
  return raw.slice(start, end + 1)
}

function resolveGeminiInvocation(): { command: string; argsPrefix: string[] } {
  if (process.platform !== 'win32') {
    return { command: 'gemini', argsPrefix: [] }
  }

  const psProbe = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      "(Get-Command gemini).Path",
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 10000,
    },
  )

  const psPath = psProbe.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean)

  if (psPath) {
    return {
      command: 'powershell.exe',
      argsPrefix: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath],
    }
  }

  return { command: 'gemini.cmd', argsPrefix: [] }
}

function buildPrompt(
  groupId: string,
  group: ReturnType<typeof buildAliasReviewGroups>[number],
  concise = false,
): string {
  if (concise) {
    return [
      'タグ alias 候補を判定してください。',
      'alias は表記ゆれのみです。意味違い・関連語・上位下位は alias にしません。',
      'JSON のみを返してください。',
      '{"status":"alias|separate|review","confidence":"high|medium|low","recommendedCanonicalKey":string|null,"recommendedCanonicalLabel":string|null,"rationaleJa":string,"cautionJa":string}',
      `groupId=${groupId}`,
      `comparableKey=${group.comparableKey}`,
      ...group.terms.map((term) => `${term.key} | ${term.label} | ${term.sourceType}`),
    ].join('\n')
  }

  return [
    '以下は AI Trend Hub のタグ alias 候補グループです。',
    '目的は「表記ゆれとして同一グループで扱ってよいか」を判定することです。',
    '表記ゆれ alias と見なす基準:',
    '- 空白・ハイフン・大文字小文字の差',
    '- 単数形/複数形の差',
    '- 明らかな綴りゆれ',
    '別扱いにすべきもの:',
    '- 意味が違うもの',
    '- 上位概念/下位概念の関係',
    '- 単なる関連語',
    '- 略称だが曖昧で誤統合リスクが高いもの',
    '',
    'JSON のみを返してください。説明文やコードフェンスは不要です。',
    '出力スキーマ:',
    '{',
    '  "status": "alias" | "separate" | "review",',
    '  "confidence": "high" | "medium" | "low",',
    '  "recommendedCanonicalKey": string | null,',
    '  "recommendedCanonicalLabel": string | null,',
    '  "rationaleJa": string,',
    '  "cautionJa": string',
    '}',
    '',
    `groupId: ${groupId}`,
    `comparableKey: ${group.comparableKey}`,
    `heuristics: ${group.heuristics.join(', ')}`,
    `suggestedCanonicalKey: ${group.suggestedCanonicalKey}`,
    `suggestedCanonicalLabel: ${group.suggestedCanonicalLabel}`,
    'terms:',
    ...group.terms.map((term, index) => {
      const counts = [
        term.articleCount ? `articleCount=${term.articleCount}` : null,
        term.seenCount ? `seenCount=${term.seenCount}` : null,
      ]
        .filter(Boolean)
        .join(', ')
      return `${index + 1}. key=${term.key} | label=${term.label} | sourceType=${term.sourceType}${counts ? ` | ${counts}` : ''}${term.note ? ` | note=${term.note}` : ''}`
    }),
  ].join('\n')
}

function runGeminiPrompt(prompt: string, model: string) {
  const invocation = resolveGeminiInvocation()
  return spawnSync(
    invocation.command,
    [...invocation.argsPrefix, '-m', model, '-p', '.', '--output-format', 'text'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: prompt,
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 2,
    },
  )
}

function evaluateWithGemini(
  groupId: string,
  group: ReturnType<typeof buildAliasReviewGroups>[number],
  model: string,
): AliasAiEvaluation {
  const attempts = [buildPrompt(groupId, group, false), buildPrompt(groupId, group, true)]
  let lastFailure: AliasAiEvaluation | null = null

  for (const prompt of attempts) {
    const result = runGeminiPrompt(prompt, model)

    if (result.error) {
      lastFailure = {
        status: 'error',
        confidence: 'low',
        recommendedCanonicalKey: null,
        recommendedCanonicalLabel: null,
        rationaleJa: `Gemini 実行失敗: ${result.error.message}`,
        cautionJa: 'CLI 実行エラーのため手動確認が必要です。',
      }
      continue
    }

    if (result.status !== 0) {
      lastFailure = {
        status: 'error',
        confidence: 'low',
        recommendedCanonicalKey: null,
        recommendedCanonicalLabel: null,
        rationaleJa: `Gemini 終了コード異常: ${result.status}`,
        cautionJa: (result.stderr || result.stdout || 'unknown error').slice(0, 300),
      }
      continue
    }

    try {
      const parsed = JSON.parse(extractJsonObject(result.stdout)) as AliasAiEvaluation
      return {
        status: parsed.status ?? 'review',
        confidence: parsed.confidence ?? 'low',
        recommendedCanonicalKey: parsed.recommendedCanonicalKey ?? null,
        recommendedCanonicalLabel: parsed.recommendedCanonicalLabel ?? null,
        rationaleJa: parsed.rationaleJa ?? '',
        cautionJa: parsed.cautionJa ?? '',
      }
    } catch (error) {
      lastFailure = {
        status: 'error',
        confidence: 'low',
        recommendedCanonicalKey: null,
        recommendedCanonicalLabel: null,
        rationaleJa: `Gemini JSON parse failure: ${error instanceof Error ? error.message : String(error)}`,
        cautionJa: result.stdout.slice(0, 300),
      }
    }
  }

  return (
    lastFailure ?? {
      status: 'error',
      confidence: 'low',
      recommendedCanonicalKey: null,
      recommendedCanonicalLabel: null,
      rationaleJa: 'Gemini evaluation failed for unknown reason.',
      cautionJa: '手動確認が必要です。',
    }
  )
}

function toMarkdown(report: AliasReviewReport): string {
  const lines = [
    '# Tag Alias Review',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- sourceSummaryPath: ${report.sourceSummaryPath}`,
    `- totalGroups: ${report.totalGroups}`,
    '',
  ]

  for (const group of report.groups) {
    lines.push(`## ${group.groupId}: ${group.comparableKey}`)
    lines.push('')
    lines.push(`- heuristics: ${group.heuristics.join(', ')}`)
    lines.push(`- suggestedCanonicalKey: ${group.suggestedCanonicalKey}`)
    lines.push(`- suggestedCanonicalLabel: ${group.suggestedCanonicalLabel}`)
    lines.push(`- ai.status: ${group.aiEvaluation.status}`)
    lines.push(`- ai.confidence: ${group.aiEvaluation.confidence}`)
    lines.push(
      `- ai.recommended: ${group.aiEvaluation.recommendedCanonicalKey ?? '-'} / ${group.aiEvaluation.recommendedCanonicalLabel ?? '-'}`,
    )
    lines.push(`- ai.rationaleJa: ${group.aiEvaluation.rationaleJa}`)
    lines.push(`- ai.cautionJa: ${group.aiEvaluation.cautionJa}`)
    lines.push('')
    lines.push('| key | label | source_type | article_count | seen_count | note |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    for (const term of group.terms) {
      lines.push(
        `| ${term.key} | ${term.label} | ${term.sourceType} | ${term.articleCount ?? ''} | ${term.seenCount ?? ''} | ${(term.note ?? '').replace(/\|/g, '/')} |`,
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

async function main(): Promise<void> {
  const rootDir = readArg('--root', path.join(process.cwd(), 'af-20260326', 'phase1-retag'))
  const summaryPath = readArg('--summary', path.join(rootDir, 'summary-sheet.json'))
  const model = readArg('--model', 'gemini-2.5-flash')
  const skipAi = readBoolArg('--skip-ai')
  const outJsonPath = path.join(rootDir, 'tag-alias-review.json')
  const outMdPath = path.join(rootDir, 'tag-alias-review.md')

  if (!fs.existsSync(summaryPath)) {
    throw new Error(`summary sheet not found: ${summaryPath}`)
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as SummarySheet
  const entries: AliasReviewEntry[] = [
    ...summary.currentTags.map((tag) => ({
      key: tag.tagKey,
      label: tag.displayName,
      sourceType: 'current-tag' as const,
      articleCount: tag.articleCount,
    })),
    ...summary.newTagCandidates.map((candidate) => ({
      key: candidate.candidateKey,
      label: candidate.displayName,
      sourceType: 'new-tag-candidate' as const,
      seenCount: candidate.seenCount,
      note: candidate.originTitle ?? undefined,
    })),
  ]

  const groups = buildAliasReviewGroups(entries)
  const report: AliasReviewReport = {
    generatedAt: new Date().toISOString(),
    sourceSummaryPath: path.relative(process.cwd(), summaryPath).replace(/\\/g, '/'),
    totalGroups: groups.length,
    groups: groups.map((group, index) => {
      const groupId = `alias-group-${String(index + 1).padStart(3, '0')}`
      const aiEvaluation: AliasAiEvaluation = skipAi
        ? {
            status: 'review',
            confidence: 'low',
            recommendedCanonicalKey: group.suggestedCanonicalKey,
            recommendedCanonicalLabel: group.suggestedCanonicalLabel,
            rationaleJa: 'AI 判定は未実行です。',
            cautionJa: '手動確認が必要です。',
          }
        : evaluateWithGemini(groupId, group, model)

      return {
        groupId,
        comparableKey: group.comparableKey,
        heuristics: group.heuristics,
        suggestedCanonicalKey: group.suggestedCanonicalKey,
        suggestedCanonicalLabel: group.suggestedCanonicalLabel,
        aiEvaluation,
        terms: group.terms,
      }
    }),
  }

  fs.writeFileSync(outJsonPath, JSON.stringify(report, null, 2), 'utf8')
  fs.writeFileSync(outMdPath, toMarkdown(report), 'utf8')
  console.log(`outJsonPath=${outJsonPath}`)
  console.log(`outMdPath=${outMdPath}`)
  console.log(`totalGroups=${report.totalGroups}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
