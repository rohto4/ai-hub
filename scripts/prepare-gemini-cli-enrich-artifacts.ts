import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import {
  findDuplicateMatch,
  findSimilarTitleDuplicate,
  listRawArticlesForEnrichment,
  type DedupeStatus,
  type RawArticleForEnrichment,
} from '@/lib/db/enrichment'
import { listActiveTagReferences } from '@/lib/db/tags'
import { resolveArticleContent } from '@/lib/extractors/content'
import {
  chunkItems,
  determineProvisionalState,
  determineSummaryBasis,
  determineSummaryInput,
  isSnippetPublicationEligible,
} from '@/lib/enrich/enrich-worker-shared'
import { assessSourceTargetRelevance } from '@/lib/relevance/source-target'
import { matchTags } from '@/lib/tags/match'
import { decodeAndNormalizeText, normalizeHeadline } from '@/lib/text/normalize'

type PolicyMode = 'all' | 'fulltext_only'
type ExportMode = 'full' | 'seed_only'

type ExportedItem = {
  rawArticleId: number
  sourceTargetId: string
  sourceKey: string
  sourceDisplayName: string
  sourceCategory: string
  sourceType: string
  contentLanguage: 'ja' | 'en' | null
  normalizedUrl: string
  citedUrl: string | null
  canonicalUrl: string
  sourceUrl: string
  sourceUpdatedAt: string | null
  title: string
  normalizedSnippet: string
  contentPath: 'full' | 'snippet'
  extractionStage:
    | 'extracted'
    | 'extracted_below_threshold'
    | 'fetch_error'
    | 'domain_snippet_only'
    | 'feed_only_policy'
    | 'domain_needs_review'
  extractionError: string | null
  extractedLength: number
  snippetLength: number
  content: string
  summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
  summaryInputText: string
  summaryInputTextForPrompt: string
  needsTitleTranslation: boolean
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
  dedupeGroupKey: string
  isRelevant: boolean
  relevanceMatchedKeyword: string | null
  snippetPublishable: boolean
  publicationBasisIfSummaryExists: 'hold' | 'full_summary' | 'source_snippet'
  matchedTagIds: string[]
  candidateTags: Array<{ candidateKey: string; displayName: string }>
  promptInput: {
    rawArticleId: number
    title: string
    content: string
    summaryInputBasis: 'full_content' | 'source_snippet' | 'title_only'
    contentLanguage: 'ja' | 'en' | null
    needsTitleTranslation: boolean
  }
}

type ChunkManifestItem = {
  index: number
  itemCount: number
  inputPath: string
  outputTemplatePath: string
  outputPath: string
  promptPath: string
}

function readArg(flag: string, fallback: string | null = null): string | null {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback
  }
  return process.argv[index + 1]
}

function readIntArg(flag: string, fallback: number): number {
  const value = readArg(flag)
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.trunc(parsed))
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
}

function truncateForPrompt(value: string, maxLength = 5000): string {
  return value.trim().slice(0, maxLength)
}

function determineSeedOnlyContentState(
  contentAccessPolicy: 'feed_only' | 'fulltext_allowed' | 'blocked_snippet_only',
  observedDomainFetchPolicy: 'needs_review' | 'fulltext_allowed' | 'snippet_only' | 'blocked' | null,
) {
  if (contentAccessPolicy === 'feed_only') {
    return {
      content: '',
      contentPath: 'snippet' as const,
      extractionStage: 'feed_only_policy' as const,
      extractionError: 'feed_only_policy',
      extractedLength: 0,
      snippetLength: 0,
    }
  }

  if (contentAccessPolicy === 'blocked_snippet_only' || observedDomainFetchPolicy === 'blocked') {
    return {
      content: '',
      contentPath: 'snippet' as const,
      extractionStage: 'domain_snippet_only' as const,
      extractionError: 'domain_snippet_only',
      extractedLength: 0,
      snippetLength: 0,
    }
  }

  if (observedDomainFetchPolicy === 'snippet_only') {
    return {
      content: '',
      contentPath: 'snippet' as const,
      extractionStage: 'domain_snippet_only' as const,
      extractionError: 'domain_snippet_only',
      extractedLength: 0,
      snippetLength: 0,
    }
  }

  if (observedDomainFetchPolicy === 'needs_review') {
    return {
      content: '',
      contentPath: 'snippet' as const,
      extractionStage: 'domain_needs_review' as const,
      extractionError: 'domain_needs_review',
      extractedLength: 0,
      snippetLength: 0,
    }
  }

  return {
    content: '',
    contentPath: 'snippet' as const,
    extractionStage: 'feed_only_policy' as const,
    extractionError: 'seed_only_export',
    extractedLength: 0,
    snippetLength: 0,
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  async function runNext(): Promise<void> {
    const index = cursor
    cursor += 1
    if (index >= items.length) {
      return
    }
    results[index] = await worker(items[index], index)
    await runNext()
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runNext())
  await Promise.all(workers)
  return results
}

function buildPrompt(params: {
  sourceKey: string | null
  totalItems: number
  chunkIndex: number
  chunkCount: number
  inputFileName: string
  outputFileName: string
}): string {
  return [
    'あなたは AI Trend Hub の Layer2 enrich 専用バッチです。',
    `対象 sourceKey: ${params.sourceKey ?? 'mixed'}`,
    `この chunk: ${params.chunkIndex}/${params.chunkCount} (${params.totalItems} 件)`,
    '',
    `入力ファイル: ${params.inputFileName}`,
    `出力先の想定ファイル名: ${params.outputFileName}`,
    '',
    '目的:',
    '- items[].promptInput を使って、日本語タイトルと日本語要約を作る',
    '- 普段の enrich と同じく、幻覚を避けて入力に忠実にまとめる',
    '- 出力は JSON のみ。markdown や説明文は一切出さない',
    '',
    '最重要ルール:',
    '1. 出力は {"items":[...]} の JSON だけにする',
    '2. items の件数と rawArticleId は入力と完全一致させる',
    '3. 各 item に rawArticleId, titleJa, summary100Ja, summary200Ja, properNounTags を必ず入れる',
    '4. summary100Ja は 100 文字以内、summary200Ja は 200 文字以内',
    '5. summary100Ja と summary200Ja は日本語の自然な 1 文または 2 文以内',
    '6. 入力に無い会社名・製品名・数字・時系列・効果を補わない',
    '7. title_only のときは title と content に明示されていることだけを書く',
    '8. source_snippet のときは title と content の両方に整合する内容だけを書く',
    '9. full_content のときも、本文から確実に言える範囲を超えない',
    '10. needsTitleTranslation=true のときだけ titleJa を日本語化する',
    '11. needsTitleTranslation=false で title がすでに日本語なら titleJa は title を基本的にそのまま使う',
    '12. properNounTags は最大 5 件、英語小文字、製品名・企業名・技術名・モデル名・ライブラリ名に限る',
    '13. properNounTags には ai, llm, api, sdk など一般語を入れない',
    '14. 情報不足なら短く保守的に書く。空欄にしない',
    '',
    'summary の書き分け:',
    '- summary100Ja: 何が出たか / 起きたかを最短で示す',
    '- summary200Ja: summary100Ja を踏まえて、重要性や用途を入力から言える範囲で少しだけ補う',
    '',
    '入力の見方:',
    '- items[].promptInput.title を主見出しとして扱う',
    '- items[].promptInput.content を要約素材として扱う',
    '- items[].summaryInputBasis は厳守する',
    '- 他の metadata は補足情報であり、事実追加の根拠に使わない',
    '',
    '出力例:',
    '{',
    '  "items": [',
    '    {',
    '      "rawArticleId": 123,',
    '      "titleJa": "日本語タイトル",',
    '      "summary100Ja": "100文字以内の日本語要約",',
    '      "summary200Ja": "200文字以内の日本語要約",',
    '      "properNounTags": ["langchain", "gemini"]',
    '    }',
    '  ]',
    '}',
    '',
    'この chunk を処理して、JSON のみを返してください。',
  ].join('\n')
}

async function prepareExportItem(
  rawArticle: RawArticleForEnrichment,
  tagReferences: Awaited<ReturnType<typeof listActiveTagReferences>>,
  exportMode: ExportMode,
): Promise<ExportedItem> {
  const title = rawArticle.title ? normalizeHeadline(rawArticle.title) : rawArticle.normalizedUrl
  const normalizedSnippet = rawArticle.snippet ? decodeAndNormalizeText(rawArticle.snippet) : ''
  const contentResult =
    exportMode === 'seed_only'
      ? determineSeedOnlyContentState(
          rawArticle.contentAccessPolicy,
          rawArticle.observedDomainFetchPolicy,
        )
      : await resolveArticleContent(
          rawArticle.citedUrl ?? rawArticle.sourceUrl,
          normalizedSnippet,
          rawArticle.contentAccessPolicy,
          rawArticle.observedDomainFetchPolicy,
        )
  const summaryInput = determineSummaryInput(
    contentResult.contentPath,
    'content' in contentResult ? contentResult.content : '',
    normalizedSnippet,
    title,
  )
  const relevance = assessSourceTargetRelevance(rawArticle.sourceKey, title, normalizedSnippet)
  const tagResult = matchTags(
    tagReferences,
    title,
    ('content' in contentResult ? contentResult.content : '') || normalizedSnippet,
    rawArticle.sourceCategory,
  )
  const duplicate = await findDuplicateMatch(
    rawArticle.normalizedUrl,
    rawArticle.citedUrl,
    rawArticle.id,
  )
  const similarDuplicate = duplicate ? null : await findSimilarTitleDuplicate(title, rawArticle.id)
  const dedupeStatus = duplicate?.dedupeStatus ?? similarDuplicate?.dedupeStatus ?? 'unique'
  const dedupeGroupKey =
    duplicate?.dedupeGroupKey ??
    similarDuplicate?.dedupeGroupKey ??
    rawArticle.citedUrl ??
    rawArticle.normalizedUrl
  const provisionalState = determineProvisionalState(
    contentResult.contentPath,
    contentResult.extractionStage,
  )
  const summaryBasis = determineSummaryBasis(
    contentResult.contentPath,
    provisionalState.provisionalReason,
  )
  const snippetPublishable = isSnippetPublicationEligible(
    summaryBasis,
    contentResult.contentPath,
    normalizedSnippet,
    dedupeStatus,
    relevance.isRelevant,
  )

  return {
    rawArticleId: rawArticle.id,
    sourceTargetId: rawArticle.sourceTargetId,
    sourceKey: rawArticle.sourceKey,
    sourceDisplayName: rawArticle.sourceDisplayName,
    sourceCategory: rawArticle.sourceCategory,
    sourceType: rawArticle.sourceType,
    contentLanguage: rawArticle.contentLanguage,
    normalizedUrl: rawArticle.normalizedUrl,
    citedUrl: rawArticle.citedUrl,
    canonicalUrl: rawArticle.citedUrl ?? rawArticle.normalizedUrl,
    sourceUrl: rawArticle.sourceUrl,
    sourceUpdatedAt: rawArticle.sourceUpdatedAt,
    title,
    normalizedSnippet,
    contentPath: contentResult.contentPath,
    extractionStage: contentResult.extractionStage,
    extractionError: contentResult.extractionError ?? null,
    extractedLength: contentResult.extractedLength,
    snippetLength: contentResult.snippetLength,
    content: 'content' in contentResult ? contentResult.content : '',
    summaryInputBasis: summaryInput.summaryInputBasis,
    summaryInputText: summaryInput.summaryInputText,
    summaryInputTextForPrompt: truncateForPrompt(summaryInput.summaryInputText),
    needsTitleTranslation: rawArticle.contentLanguage !== 'ja',
    summaryBasis,
    provisionalBase: provisionalState,
    dedupeStatus,
    dedupeGroupKey,
    isRelevant: relevance.isRelevant,
    relevanceMatchedKeyword: relevance.matchedKeyword,
    snippetPublishable,
    publicationBasisIfSummaryExists:
      contentResult.contentPath === 'full'
        ? 'full_summary'
        : snippetPublishable
          ? 'source_snippet'
          : 'hold',
    matchedTagIds: tagResult.matchedTagIds,
    candidateTags:
      contentResult.contentPath === 'full' && relevance.isRelevant ? tagResult.candidateTags : [],
    promptInput: {
      rawArticleId: rawArticle.id,
      title,
      content: truncateForPrompt(summaryInput.summaryInputText),
      summaryInputBasis: summaryInput.summaryInputBasis,
      contentLanguage: rawArticle.contentLanguage,
      needsTitleTranslation: rawArticle.contentLanguage !== 'ja',
    },
  }
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd())

  const limit = readIntArg('--limit', 1500)
  const chunkSize = readIntArg('--chunk-size', 200)
  const concurrency = readIntArg('--concurrency', 8)
  const sourceKey = readArg('--source-key')
  const policyMode = (readArg('--policy', 'all') ?? 'all') as PolicyMode
  const exportMode = (readArg('--export-mode', 'full') ?? 'full') as ExportMode
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const defaultRunName = `gemini-cli-enrich-${sanitizeSegment(sourceKey ?? 'mixed')}-${timestamp}`
  const outputDir =
    readArg('--output-dir') ??
    path.join(process.cwd(), 'artifact', defaultRunName)

  const rawArticles = await listRawArticlesForEnrichment(limit, sourceKey)
  const targetRawArticles =
    policyMode === 'fulltext_only'
      ? rawArticles.filter((row) => row.contentAccessPolicy === 'fulltext_allowed')
      : rawArticles
  const tagReferences = await listActiveTagReferences()

  const items = await mapWithConcurrency(
    targetRawArticles,
    concurrency,
    async (rawArticle, index) => {
      const prepared = await prepareExportItem(rawArticle, tagReferences, exportMode)
      console.log(`[prepare-gemini-cli-enrich] ${index + 1}/${targetRawArticles.length} raw=${rawArticle.id}`)
      return prepared
    },
  )

  const inputDir = path.join(outputDir, 'inputs')
  const outputTemplateDir = path.join(outputDir, 'output-templates')
  const promptDir = path.join(outputDir, 'prompts')
  fs.mkdirSync(inputDir, { recursive: true })
  fs.mkdirSync(outputTemplateDir, { recursive: true })
  fs.mkdirSync(promptDir, { recursive: true })

  const chunks = chunkItems(items, chunkSize)
  const manifestItems: ChunkManifestItem[] = []

  chunks.forEach((chunk, index) => {
    const chunkNumber = String(index + 1).padStart(3, '0')
    const inputFileName = `ai-enrich-inputs-part-${chunkNumber}.json`
    const outputTemplateFileName = `ai-enrich-output-template-part-${chunkNumber}.json`
    const outputFileName = `ai-enrich-outputs-part-${chunkNumber}.json`
    const promptFileName = `gemini-prompt-part-${chunkNumber}.md`

    const inputPath = path.join(inputDir, inputFileName)
    const outputTemplatePath = path.join(outputTemplateDir, outputTemplateFileName)
    const promptPath = path.join(promptDir, promptFileName)

    const inputPayload = {
      generatedAt: new Date().toISOString(),
      sourceKey: sourceKey ?? null,
      policyMode,
      exportMode,
      limit,
      chunkIndex: index + 1,
      chunkCount: chunks.length,
      totalExported: items.length,
      chunkItemCount: chunk.length,
      items: chunk,
    }
    const outputTemplatePayload = {
      generatedAt: new Date().toISOString(),
      sourceKey: sourceKey ?? null,
      inputFileName,
      items: chunk.map((item) => ({
        rawArticleId: item.rawArticleId,
        titleJa: '',
        summary100Ja: '',
        summary200Ja: '',
        properNounTags: [],
      })),
    }
    const promptText = buildPrompt({
      sourceKey: sourceKey ?? null,
      totalItems: chunk.length,
      chunkIndex: index + 1,
      chunkCount: chunks.length,
      inputFileName,
      outputFileName,
    })

    fs.writeFileSync(inputPath, JSON.stringify(inputPayload, null, 2), 'utf8')
    fs.writeFileSync(outputTemplatePath, JSON.stringify(outputTemplatePayload, null, 2), 'utf8')
    fs.writeFileSync(promptPath, promptText, 'utf8')

    manifestItems.push({
      index: index + 1,
      itemCount: chunk.length,
      inputPath,
      outputTemplatePath,
      outputPath: path.join(outputTemplateDir, outputFileName),
      promptPath,
    })
  })

  const manifestPath = path.join(outputDir, 'manifest.json')
  const readmePath = path.join(outputDir, 'README.md')
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceKey: sourceKey ?? null,
        policyMode,
        exportMode,
        limit,
        chunkSize,
        concurrency,
        totalRawFetched: rawArticles.length,
        totalExported: items.length,
        chunks: manifestItems,
      },
      null,
      2,
    ),
    'utf8',
  )
  fs.writeFileSync(
    readmePath,
    [
      '# Gemini CLI Enrich Artifacts',
      '',
      `- generatedAt: ${new Date().toISOString()}`,
      `- sourceKey: ${sourceKey ?? 'mixed'}`,
      `- totalExported: ${items.length}`,
      `- chunkCount: ${chunks.length}`,
      '',
      '## Files',
      '- `inputs/`: Gemini に読ませる入力 JSON',
      '- `output-templates/`: 返却 JSON のひな型',
      '- `prompts/`: chunk ごとの Gemini CLI 用プロンプト',
      '- `manifest.json`: 全 chunk の対応表',
      '',
      '## Import',
      '出力 JSON は既存の `scripts/import-ai-enrich-outputs.ts` 互換を前提にしている。',
      '必要なら chunk ごとに `--input` と `--output` を指定して取り込む。',
    ].join('\n'),
    'utf8',
  )

  console.log(`outputDir=${outputDir}`)
  console.log(`totalExported=${items.length}`)
  console.log(`chunkCount=${chunks.length}`)
  console.log(`manifest=${manifestPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
