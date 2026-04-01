#!/usr/bin/env npx tsx
import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSql } from '@/lib/db'
import {
  buildPhase1RetagPromptSection,
  filterPhase1PrimaryTagMaster,
} from '@/lib/tags/retag-phase1'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnvConfig(join(__dirname, '..'))

type ArticleRow = {
  enriched_article_id: number
  canonical_url: string
  title: string
  summary_100: string
  summary_200: string | null
  source_type: string
  source_category: string
  content_language: 'ja' | 'en' | null
}

type ExistingPrimaryTagRow = {
  enriched_article_id: number
  tag_key: string
}

type ExistingAdjacentTagRow = {
  enriched_article_id: number
  tag_key: string
}

type TagMasterRow = {
  tag_key: string
  display_name: string
}

type AdjacentTagMasterRow = {
  tag_key: string
  display_name: string
  theme_key: string
}

type ExportItem = {
  enrichedArticleId: number
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

type OutputTemplateItem = {
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

function readArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function toChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function pad(num: number): string {
  return String(num).padStart(3, '0')
}

async function main(): Promise<void> {
  const outDir = readArg('--out', path.join(process.cwd(), 'artifacts', 'ai-retag-all'))
  const chunkSize = Number(readArg('--chunk-size', '400'))
  const sql = getSql()

  const [articles, primaryTags, adjacentTags, rawTagMaster, adjacentMaster] = await Promise.all([
    (sql`
      SELECT
        ae.enriched_article_id,
        ae.canonical_url,
        ae.title,
        ae.summary_100,
        ae.summary_200,
        ae.source_type,
        ae.source_category,
        ae.content_language
      FROM articles_enriched ae
      WHERE ae.ai_processing_state = 'completed'
        AND ae.dedupe_status = 'unique'
      ORDER BY ae.enriched_article_id ASC
    `) as unknown as Promise<ArticleRow[]>,
    (sql`
      SELECT aet.enriched_article_id, tm.tag_key
      FROM articles_enriched_tags aet
      JOIN tags_master tm ON tm.tag_id = aet.tag_id
      ORDER BY aet.enriched_article_id ASC, aet.is_primary DESC, aet.tag_id ASC
    `) as unknown as Promise<ExistingPrimaryTagRow[]>,
    (sql`
      SELECT aeat.enriched_article_id, atm.tag_key
      FROM articles_enriched_adjacent_tags aeat
      JOIN adjacent_tags_master atm ON atm.adjacent_tag_id = aeat.adjacent_tag_id
      ORDER BY aeat.enriched_article_id ASC, aeat.sort_order ASC, atm.tag_key ASC
    `) as unknown as Promise<ExistingAdjacentTagRow[]>,
    (sql`
      SELECT tag_key, display_name
      FROM tags_master
      WHERE is_active = true
      ORDER BY tag_key ASC
    `) as unknown as Promise<TagMasterRow[]>,
    (sql`
      SELECT tag_key, display_name, theme_key
      FROM adjacent_tags_master
      WHERE is_active = true
      ORDER BY priority ASC, tag_key ASC
    `) as unknown as Promise<AdjacentTagMasterRow[]>,
  ])

  const primaryMap = new Map<number, string[]>()
  for (const row of primaryTags) {
    const existing = primaryMap.get(row.enriched_article_id) ?? []
    existing.push(row.tag_key)
    primaryMap.set(row.enriched_article_id, existing)
  }

  const adjacentMap = new Map<number, string[]>()
  for (const row of adjacentTags) {
    const existing = adjacentMap.get(row.enriched_article_id) ?? []
    existing.push(row.tag_key)
    adjacentMap.set(row.enriched_article_id, existing)
  }

  const tagMaster = filterPhase1PrimaryTagMaster(rawTagMaster)

  const items: ExportItem[] = articles.map((article) => ({
    enrichedArticleId: article.enriched_article_id,
    canonicalUrl: article.canonical_url,
    contentLanguage: article.content_language,
    sourceType: article.source_type,
    sourceCategory: article.source_category,
    title: article.title,
    summary100: article.summary_100,
    summary200: article.summary_200,
    existingPrimaryTagKeys: primaryMap.get(article.enriched_article_id) ?? [],
    existingAdjacentTagKeys: adjacentMap.get(article.enriched_article_id) ?? [],
  }))

  const inputDir = path.join(outDir, 'inputs')
  const templateDir = path.join(outDir, 'output-templates')
  const outputsDir = path.join(outDir, 'outputs')
  const promptsDir = path.join(outDir, 'prompts')
  fs.mkdirSync(inputDir, { recursive: true })
  fs.mkdirSync(templateDir, { recursive: true })
  fs.mkdirSync(outputsDir, { recursive: true })
  fs.mkdirSync(promptsDir, { recursive: true })

  const chunks = toChunks(items, Math.max(1, chunkSize))
  const manifest: Array<{
    part: string
    inputPath: string
    outputTemplatePath: string
    outputPath: string
    count: number
    startEnrichedArticleId: number
    endEnrichedArticleId: number
  }> = []

  for (const [index, chunk] of chunks.entries()) {
    const part = `part-${pad(index + 1)}`
    const inputPath = path.join(inputDir, `ai-retag-inputs-${part}.json`)
    const outputTemplatePath = path.join(templateDir, `ai-retag-outputs-${part}.json`)
    const outputPath = path.join(outputsDir, `ai-retag-outputs-${part}.json`)

    fs.writeFileSync(
      inputPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          total: chunk.length,
          items: chunk,
        },
        null,
        2,
      ),
      'utf8',
    )

    const templateItems: OutputTemplateItem[] = chunk.map((item) => ({
      enrichedArticleId: item.enrichedArticleId,
      primaryTagKeys: [],
      adjacentTagKeys: [],
      primaryEvidenceKeywords: [],
      adjacentEvidenceKeywords: [],
      proposedPrimaryTags: [],
      proposedAdjacentTags: [],
      note: '',
    }))
    fs.writeFileSync(
      outputTemplatePath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          total: templateItems.length,
          items: templateItems,
        },
        null,
        2,
      ),
      'utf8',
    )

    manifest.push({
      part,
      inputPath: path.relative(outDir, inputPath).replace(/\\/g, '/'),
      outputTemplatePath: path.relative(outDir, outputTemplatePath).replace(/\\/g, '/'),
      outputPath: path.relative(outDir, outputPath).replace(/\\/g, '/'),
      count: chunk.length,
      startEnrichedArticleId: chunk[0]?.enrichedArticleId ?? 0,
      endEnrichedArticleId: chunk[chunk.length - 1]?.enrichedArticleId ?? 0,
    })
  }

  const promptPath = path.join(promptsDir, 'prompt-master.md')
  const prompt = `# AI Retag Prompt

## Goal
全記事に対して、以下を返してください。
1. 本タグ（primary）: 0〜5件（推奨は5件）
2. 隣接分野タグ（adjacent）: 0〜2件
3. 判定根拠キーワード（primaryEvidenceKeywords / adjacentEvidenceKeywords）
4. 既存マスタに無い妥当タグ候補（proposedPrimaryTags / proposedAdjacentTags）

## Hard Constraints
- \`primaryTagKeys\` は既存タグマスタの \`tag_key\` を優先する
- \`adjacentTagKeys\` は隣接タグマスタの \`tag_key\` のみ
- \`primaryTagKeys\` は最大5件
- \`adjacentTagKeys\` は最大2件
- 根拠キーワードは必ず本文（title/summary100/summary200）由来

## Output Format
- output-template と同一JSON形式で返却
- \`enrichedArticleId\` の欠落・重複は禁止

${buildPhase1RetagPromptSection()}

## Existing Masters
- primaryTagMaster: \`${path.relative(process.cwd(), path.join(outDir, 'prompts', 'primary-tag-master.json')).replace(/\\/g, '/')}\`
- adjacentTagMaster: \`${path.relative(process.cwd(), path.join(outDir, 'prompts', 'adjacent-tag-master.json')).replace(/\\/g, '/')}\`
`
  fs.writeFileSync(promptPath, prompt, 'utf8')

  fs.writeFileSync(
    path.join(promptsDir, 'primary-tag-master.json'),
    JSON.stringify(tagMaster, null, 2),
    'utf8',
  )
  fs.writeFileSync(
    path.join(promptsDir, 'adjacent-tag-master.json'),
    JSON.stringify(adjacentMaster, null, 2),
    'utf8',
  )

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalArticles: items.length,
        chunkSize: Math.max(1, chunkSize),
        parts: manifest,
      },
      null,
      2,
    ),
    'utf8',
  )

  console.log(`outDir=${outDir}`)
  console.log(`totalArticles=${items.length}`)
  console.log(`parts=${manifest.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
