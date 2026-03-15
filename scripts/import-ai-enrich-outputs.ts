import fs from 'node:fs'
import path from 'node:path'
import {
  markRawProcessed,
  type DedupeStatus,
  upsertEnrichedArticle,
} from '@/lib/db/enrichment'
import { finishJobRun, recordJobRunItem, startJobRun } from '@/lib/db/job-runs'

type ExportedInputItem = {
  rawArticleId: number
  sourceTargetId: string
  sourceKey: string
  normalizedUrl: string
  citedUrl: string | null
  canonicalUrl: string
  sourceUpdatedAt: string | null
  title: string
  contentPath: 'full' | 'snippet'
  summaryBasis: 'full_content' | 'feed_snippet' | 'blocked_snippet' | 'fallback_snippet'
  provisionalBase: {
    isProvisional: boolean
    provisionalReason:
      | 'snippet_only'
      | 'domain_snippet_only'
      | 'fetch_error'
      | 'extracted_below_threshold'
      | 'feed_only_policy'
      | 'domain_needs_review'
      | null
  }
  dedupeStatus: DedupeStatus
  dedupeGroupKey: string | null
  isRelevant: boolean
  matchedTagIds: string[]
  candidateTags: Array<{ candidateKey: string; displayName: string }>
  publicationBasisIfSummaryExists: 'hold' | 'full_summary' | 'source_snippet'
}

type ExportedInputFile = {
  generatedAt: string
  sourceKey: string | null
  totalExported: number
  items: ExportedInputItem[]
}

type OutputItem = {
  rawArticleId: number
  titleJa: string
  summary100Ja: string
  summary200Ja: string
}

type OutputFile = {
  generatedAt?: string
  sourceKey?: string | null
  items: OutputItem[]
}

function readArg(flag: string, fallback: string | null = null): string | null {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback
  }
  return process.argv[index + 1]
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function truncate(value: string, maxLength: number): string {
  const normalized = normalizeWhitespace(value)
  if (normalized.length <= maxLength) {
    return normalized
  }
  return normalized.slice(0, maxLength).trim()
}

function scoreArticle(
  contentPath: 'full' | 'snippet',
  matchedTagCount: number,
  summarySource: 'manual_cli',
): { score: number; scoreReason: string } {
  const base = contentPath === 'full' ? 70 : 45
  const summaryBonus = summarySource === 'manual_cli' ? 6 : 0
  const score = Math.min(100, base + matchedTagCount * 8 + summaryBonus)
  const scoreReason =
    contentPath === 'full'
      ? `full extraction, ${matchedTagCount} matched tags, ${summarySource} summary`
      : `snippet fallback, ${matchedTagCount} matched tags, ${summarySource} summary`

  return { score, scoreReason }
}

const inputPath =
  readArg('--input') ??
  path.join(process.cwd(), 'artifacts', 'ai-enrich-inputs-official-remaining.json')
const outputPath =
  readArg('--output') ??
  path.join(process.cwd(), 'artifacts', 'ai-enrich-outputs-official-remaining.json')
const dryRun = process.argv.includes('--dry-run')
const writeTemplateOnly = process.argv.includes('--write-template-only')
const templatePath =
  readArg('--template-output') ??
  path.join(process.cwd(), 'artifacts', 'ai-enrich-output-template.json')

async function main(): Promise<void> {
  const inputFile = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as ExportedInputFile

  if (writeTemplateOnly) {
    const template: OutputFile = {
      generatedAt: new Date().toISOString(),
      sourceKey: inputFile.sourceKey,
      items: inputFile.items.map((item) => ({
        rawArticleId: item.rawArticleId,
        titleJa: '',
        summary100Ja: '',
        summary200Ja: '',
      })),
    }
    fs.mkdirSync(path.dirname(templatePath), { recursive: true })
    fs.writeFileSync(templatePath, JSON.stringify(template, null, 2), 'utf8')
    console.log(`template=${templatePath}`)
    console.log(`items=${template.items.length}`)
    return
  }

  const outputFile = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as OutputFile
  const outputMap = new Map<number, OutputItem>(
    outputFile.items.map((item) => [item.rawArticleId, item]),
  )

  const missing = inputFile.items
    .filter((item) => !outputMap.has(item.rawArticleId))
    .map((item) => item.rawArticleId)

  if (missing.length > 0) {
    throw new Error(`Missing output items for raw_article_id: ${missing.slice(0, 20).join(', ')}`)
  }

  const jobRunId = dryRun
    ? null
    : await startJobRun({
        jobName: 'manual-ai-enrich-import',
        metadata: {
          inputPath,
          outputPath,
          itemCount: inputFile.items.length,
        },
      })

  let processed = 0

  for (const inputItem of inputFile.items) {
    const outputItem = outputMap.get(inputItem.rawArticleId)
    if (!outputItem) {
      continue
    }

    const title = truncate(outputItem.titleJa, 200)
    const summary100 = truncate(outputItem.summary100Ja, 100)
    const summary200 = truncate(outputItem.summary200Ja, 200)

    if (!title || !summary100 || !summary200) {
      throw new Error(`Output item ${inputItem.rawArticleId} has empty title/summary`)
    }

    const publicationBasis = inputItem.publicationBasisIfSummaryExists
    const publicationText =
      publicationBasis === 'hold'
        ? null
        : summary200 || summary100
    const publishCandidate =
      publicationBasis !== 'hold' &&
      inputItem.dedupeStatus === 'unique' &&
      inputItem.isRelevant
    const finalIsProvisional =
      publicationBasis === 'source_snippet'
        ? false
        : inputItem.provisionalBase.isProvisional
    const finalProvisionalReason =
      publicationBasis === 'source_snippet'
        ? null
        : inputItem.provisionalBase.provisionalReason
    const { score, scoreReason } = scoreArticle(
      inputItem.contentPath,
      inputItem.matchedTagIds.length,
      'manual_cli',
    )
    const adjustedScore = inputItem.isRelevant ? score : Math.max(0, score - 25)
    const adjustedScoreReason = inputItem.isRelevant
      ? scoreReason
      : `${scoreReason}; low source relevance`

    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            rawArticleId: inputItem.rawArticleId,
            title,
            publicationBasis,
            publishCandidate,
            provisionalReason: finalProvisionalReason,
          },
          null,
          2,
        ),
      )
      processed += 1
      continue
    }

    await upsertEnrichedArticle({
      rawArticleId: inputItem.rawArticleId,
      sourceTargetId: inputItem.sourceTargetId,
      normalizedUrl: inputItem.normalizedUrl,
      citedUrl: inputItem.citedUrl,
      canonicalUrl: inputItem.canonicalUrl,
      title,
      summary100,
      summary200,
      summaryBasis: inputItem.summaryBasis,
      contentPath: inputItem.contentPath,
      isProvisional: finalIsProvisional,
      provisionalReason: finalProvisionalReason,
      dedupeStatus: inputItem.dedupeStatus,
      dedupeGroupKey: inputItem.dedupeGroupKey,
      publishCandidate,
      publicationBasis,
      publicationText,
      summaryInputBasis:
        inputItem.contentPath === 'full'
          ? 'full_content'
          : publicationBasis === 'source_snippet'
            ? 'source_snippet'
            : 'title_only',
      score: adjustedScore,
      scoreReason: adjustedScoreReason,
      aiProcessingState: 'completed',
      sourceUpdatedAt: inputItem.sourceUpdatedAt,
      matchedTagIds: inputItem.matchedTagIds,
      candidateTags: inputItem.candidateTags,
    })
    await markRawProcessed(inputItem.rawArticleId)
    await recordJobRunItem({
      jobRunId: jobRunId!,
      itemKey: String(inputItem.rawArticleId),
      itemStatus: 'processed',
      detail: {
        rawArticleId: inputItem.rawArticleId,
        sourceKey: inputItem.sourceKey,
        publicationBasis,
        publishCandidate,
      },
    })
    processed += 1
  }

  if (!dryRun) {
    await finishJobRun({
      jobRunId: jobRunId!,
      status: 'completed',
      processedCount: inputFile.items.length,
      successCount: processed,
      failedCount: 0,
      metadata: {
        inputPath,
        outputPath,
        itemCount: inputFile.items.length,
      },
      lastError: null,
    })
  }

  console.log(`processed=${processed}`)
  console.log(`dryRun=${dryRun}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
