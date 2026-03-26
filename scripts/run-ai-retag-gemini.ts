#!/usr/bin/env npx tsx
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

type InputItem = {
  enrichedArticleId: number | string
  canonicalUrl: string
  contentLanguage: 'ja' | 'en' | null
  sourceType: string
  sourceCategory: string
  title: string
  summary100: string
  summary200: string | null
  existingPrimaryTagKeys: string[]
  existingAdjacentTagKeys: string[]
}

type InputFile = {
  generatedAt?: string
  total?: number
  items: InputItem[]
}

type MasterTag = {
  tag_key: string
  display_name: string
}

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
  generatedAt: string
  total: number
  items: OutputItem[]
}

type ManifestPart = {
  part: string
  inputPath: string
  outputPath: string
}

type ManifestFile = {
  parts: ManifestPart[]
}

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

function hasArg(flag: string): boolean {
  return process.argv.includes(flag)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function normalizeId(value: number | string): number {
  return typeof value === 'number' ? value : Number(value)
}

function uniqueStrings(values: unknown[], max: number): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string') continue
    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
    if (result.length >= max) break
  }
  return result
}

function extractFirstJsonObject(raw: string): unknown {
  const start = raw.indexOf('{')
  if (start === -1) {
    throw new Error('No JSON object found in Gemini response')
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') depth -= 1

    if (depth === 0) {
      const candidate = raw.slice(start, index + 1)
      return JSON.parse(candidate)
    }
  }

  throw new Error('Unterminated JSON object in Gemini response')
}

function buildPrompt(params: {
  primaryMaster: MasterTag[]
  adjacentMaster: MasterTag[]
  batchItems: InputItem[]
}): string {
  const primaryKeys = params.primaryMaster.map((item) => item.tag_key)
  const adjacentKeys = params.adjacentMaster.map((item) => item.tag_key)

  return [
    'You are assigning taxonomy tags for AI news articles.',
    'Return JSON only. No markdown.',
    '',
    'Task:',
    '- For each item, choose primaryTagKeys (0-5) from allowed primary tag keys.',
    '- For each item, choose adjacentTagKeys (0-2) from allowed adjacent tag keys.',
    '- adjacentTagKeys is optional and should be empty when there is no clear context.',
    '- Consider title, summary100, summary200, sourceCategory, existing tags.',
    '',
    'Hard constraints:',
    '- Output format: {"items":[...]}',
    '- Keep all enrichedArticleId values exactly as input.',
    '- Do not invent tag keys outside master lists.',
    '- primaryTagKeys max 5, adjacentTagKeys max 2.',
    '- Evidence arrays should contain concise keywords.',
    '',
    `Allowed primary tag keys (${primaryKeys.length}):`,
    JSON.stringify(primaryKeys),
    '',
    `Allowed adjacent tag keys (${adjacentKeys.length}):`,
    JSON.stringify(adjacentKeys),
    '',
    'Output item schema:',
    JSON.stringify(
      {
        enrichedArticleId: 123,
        primaryTagKeys: ['llm'],
        adjacentTagKeys: ['adj-enterprise'],
        primaryEvidenceKeywords: ['model update'],
        adjacentEvidenceKeywords: ['enterprise workflow'],
        proposedPrimaryTags: [
          {
            displayName: 'Example New Primary Tag',
            reason: 'Reason',
            evidenceKeywords: ['keyword'],
          },
        ],
        proposedAdjacentTags: [
          {
            displayName: 'Example New Adjacent Tag',
            reason: 'Reason',
            evidenceKeywords: ['keyword'],
          },
        ],
        note: '',
      },
      null,
      2,
    ),
    '',
    'Input items:',
    JSON.stringify(
      params.batchItems.map((item) => ({
        enrichedArticleId: normalizeId(item.enrichedArticleId),
        canonicalUrl: item.canonicalUrl,
        contentLanguage: item.contentLanguage,
        sourceType: item.sourceType,
        sourceCategory: item.sourceCategory,
        title: item.title,
        summary100: item.summary100,
        summary200: item.summary200,
        existingPrimaryTagKeys: item.existingPrimaryTagKeys,
        existingAdjacentTagKeys: item.existingAdjacentTagKeys,
      })),
      null,
      2,
    ),
  ].join('\n')
}

function validateAndNormalizeOutputs(
  requestedItems: InputItem[],
  raw: unknown,
  allowedPrimary: Set<string>,
  allowedAdjacent: Set<string>,
): OutputItem[] {
  const requestedIds = requestedItems.map((item) => normalizeId(item.enrichedArticleId))
  const requestedIdSet = new Set<number>(requestedIds)

  const parsedItems =
    typeof raw === 'object' && raw !== null && 'items' in raw && Array.isArray((raw as any).items)
      ? ((raw as any).items as any[])
      : []

  const byId = new Map<number, OutputItem>()
  for (const parsed of parsedItems) {
    const id = Number(parsed?.enrichedArticleId)
    if (!Number.isFinite(id) || !requestedIdSet.has(id) || byId.has(id)) continue

    const primary = uniqueStrings(parsed?.primaryTagKeys ?? [], 5).filter((key) =>
      allowedPrimary.has(key),
    )
    const adjacent = uniqueStrings(parsed?.adjacentTagKeys ?? [], 2).filter((key) =>
      allowedAdjacent.has(key),
    )

    const proposedPrimary = Array.isArray(parsed?.proposedPrimaryTags)
      ? parsed.proposedPrimaryTags
          .slice(0, 5)
          .map((item: any) => ({
            displayName: typeof item?.displayName === 'string' ? item.displayName.trim() : '',
            reason: typeof item?.reason === 'string' ? item.reason.trim() : '',
            evidenceKeywords: uniqueStrings(item?.evidenceKeywords ?? [], 8),
          }))
          .filter((item: any) => item.displayName.length > 0)
      : []
    const proposedAdjacent = Array.isArray(parsed?.proposedAdjacentTags)
      ? parsed.proposedAdjacentTags
          .slice(0, 5)
          .map((item: any) => ({
            displayName: typeof item?.displayName === 'string' ? item.displayName.trim() : '',
            reason: typeof item?.reason === 'string' ? item.reason.trim() : '',
            evidenceKeywords: uniqueStrings(item?.evidenceKeywords ?? [], 8),
          }))
          .filter((item: any) => item.displayName.length > 0)
      : []

    byId.set(id, {
      enrichedArticleId: id,
      primaryTagKeys: primary,
      adjacentTagKeys: adjacent,
      primaryEvidenceKeywords: uniqueStrings(parsed?.primaryEvidenceKeywords ?? [], 12),
      adjacentEvidenceKeywords: uniqueStrings(parsed?.adjacentEvidenceKeywords ?? [], 12),
      proposedPrimaryTags: proposedPrimary,
      proposedAdjacentTags: proposedAdjacent,
      note: typeof parsed?.note === 'string' ? parsed.note.trim() : '',
    })
  }

  return requestedIds.map((id) => {
    return (
      byId.get(id) ?? {
        enrichedArticleId: id,
        primaryTagKeys: [],
        adjacentTagKeys: [],
        primaryEvidenceKeywords: [],
        adjacentEvidenceKeywords: [],
        proposedPrimaryTags: [],
        proposedAdjacentTags: [],
        note: 'no_result_from_model',
      }
    )
  })
}

function runGemini(prompt: string, model: string): string {
  const commandArgs = ['-m', model, '--output-format', 'text']
  const result = spawnSync('gemini', commandArgs, {
    input: prompt,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: process.platform === 'win32',
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(
      `gemini command failed (status=${result.status}): ${(result.stderr || '').slice(0, 800)}`,
    )
  }
  return result.stdout ?? ''
}

async function main(): Promise<void> {
  const rootDir = readArg('--root', path.join(process.cwd(), 'artifacts', 'ai-retag-all'))
  const model = readArg('--model', 'gemini-2.5-flash')
  const batchSize = readIntArg('--batch-size', 50)
  const delayMs = readIntArg('--delay-ms', 800)
  const retries = readIntArg('--retries', 2)
  const limitBatches = Number(readArg('--limit-batches', '0'))
  const overwrite = hasArg('--overwrite')
  const onlyPart = readArg('--part', '')

  const manifestPath = path.join(rootDir, 'manifest.json')
  const primaryMasterPath = path.join(rootDir, 'prompts', 'primary-tag-master.json')
  const adjacentMasterPath = path.join(rootDir, 'prompts', 'adjacent-tag-master.json')
  const outputsDir = path.join(rootDir, 'outputs')
  const logsDir = path.join(rootDir, 'logs')
  fs.mkdirSync(outputsDir, { recursive: true })
  fs.mkdirSync(logsDir, { recursive: true })

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ManifestFile
  const primaryMaster = JSON.parse(fs.readFileSync(primaryMasterPath, 'utf8')) as MasterTag[]
  const adjacentMaster = JSON.parse(fs.readFileSync(adjacentMasterPath, 'utf8')) as MasterTag[]
  const allowedPrimary = new Set(primaryMaster.map((item) => item.tag_key))
  const allowedAdjacent = new Set(adjacentMaster.map((item) => item.tag_key))

  const targetParts = manifest.parts.filter((part) => !onlyPart || part.part === `part-${onlyPart}`)
  if (targetParts.length === 0) {
    throw new Error(`No target parts found. --part=${onlyPart}`)
  }

  for (const part of targetParts) {
    const inputPath = path.join(rootDir, part.inputPath)
    const outputPath = path.join(rootDir, part.outputPath)
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input not found: ${inputPath}`)
    }
    if (fs.existsSync(outputPath) && !overwrite) {
      console.log(`[skip] ${part.part} output exists: ${path.relative(process.cwd(), outputPath)}`)
      continue
    }

    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as InputFile
    const batches = toChunks(input.items ?? [], batchSize)
    const outputItems: OutputItem[] = []

    console.log(`[start] ${part.part} items=${input.items.length} batches=${batches.length}`)

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      if (limitBatches > 0 && batchIndex >= limitBatches) break
      const batch = batches[batchIndex]
      const prompt = buildPrompt({
        primaryMaster,
        adjacentMaster,
        batchItems: batch,
      })

      let attempt = 0
      let lastError: Error | null = null
      let normalized: OutputItem[] | null = null

      while (attempt <= retries && normalized === null) {
        attempt += 1
        try {
          const rawText = runGemini(prompt, model)
          const logPath = path.join(
            logsDir,
            `${part.part}-batch-${String(batchIndex + 1).padStart(3, '0')}-attempt-${attempt}.txt`,
          )
          fs.writeFileSync(logPath, rawText, 'utf8')
          const parsed = extractFirstJsonObject(rawText)
          normalized = validateAndNormalizeOutputs(batch, parsed, allowedPrimary, allowedAdjacent)
        } catch (error) {
          lastError = error as Error
          if (attempt <= retries) {
            await sleep(delayMs)
          }
        }
      }

      if (!normalized) {
        throw new Error(
          `[${part.part}] batch ${batchIndex + 1} failed after ${retries + 1} attempts: ${
            lastError?.message ?? 'unknown error'
          }`,
        )
      }

      outputItems.push(...normalized)
      console.log(
        `[done] ${part.part} batch=${batchIndex + 1}/${batches.length} items=${outputItems.length}`,
      )
      await sleep(delayMs)
    }

    const output: OutputFile = {
      generatedAt: new Date().toISOString(),
      total: outputItems.length,
      items: outputItems,
    }
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8')
    console.log(`[write] ${path.relative(process.cwd(), outputPath)} total=${output.total}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
