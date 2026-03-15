import fs from 'node:fs'
import path from 'node:path'
import { listRawArticlesForEnrichment, findDuplicateMatch, findSimilarTitleDuplicate, type DedupeStatus } from '@/lib/db/enrichment'
import { listActiveTagReferences } from '@/lib/db/tags'
import { resolveArticleContent } from '@/lib/extractors/content'
import { assessSourceTargetRelevance } from '@/lib/relevance/source-target'
import { matchTags } from '@/lib/tags/match'
import { decodeAndNormalizeText, normalizeHeadline } from '@/lib/text/normalize'

function loadEnvFile(fileName: string): void {
  const fullPath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(fullPath)) return

  for (const rawLine of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    if (!rawLine || rawLine.trim().startsWith('#')) continue
    const separatorIndex = rawLine.indexOf('=')
    if (separatorIndex === -1) continue
    const key = rawLine.slice(0, separatorIndex)
    const value = rawLine.slice(separatorIndex + 1)
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function readArg(flag: string, fallback: string | null = null): string | null {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback
  }
  return process.argv[index + 1]
}

function determineProvisionalState(
  contentPath: 'full' | 'snippet',
  extractionStage:
    | 'extracted'
    | 'extracted_below_threshold'
    | 'fetch_error'
    | 'domain_snippet_only'
    | 'feed_only_policy'
    | 'domain_needs_review',
) {
  if (contentPath === 'full') {
    return {
      isProvisional: false,
      provisionalReason: null,
    } as const
  }

  if (extractionStage === 'domain_snippet_only') {
    return {
      isProvisional: true,
      provisionalReason: 'domain_snippet_only',
    } as const
  }

  if (extractionStage === 'fetch_error') {
    return {
      isProvisional: true,
      provisionalReason: 'fetch_error',
    } as const
  }

  if (extractionStage === 'feed_only_policy') {
    return {
      isProvisional: true,
      provisionalReason: 'feed_only_policy',
    } as const
  }

  if (extractionStage === 'domain_needs_review') {
    return {
      isProvisional: true,
      provisionalReason: 'domain_needs_review',
    } as const
  }

  if (extractionStage === 'extracted_below_threshold') {
    return {
      isProvisional: true,
      provisionalReason: 'extracted_below_threshold',
    } as const
  }

  return {
    isProvisional: true,
    provisionalReason: 'snippet_only',
  } as const
}

function determineSummaryBasis(
  contentPath: 'full' | 'snippet',
  provisionalReason:
    | 'snippet_only'
    | 'domain_snippet_only'
    | 'fetch_error'
    | 'extracted_below_threshold'
    | 'feed_only_policy'
    | 'domain_needs_review'
    | null,
) {
  if (contentPath === 'full') {
    return 'full_content' as const
  }

  if (provisionalReason === 'feed_only_policy') {
    return 'feed_snippet' as const
  }

  if (provisionalReason === 'domain_snippet_only') {
    return 'blocked_snippet' as const
  }

  return 'fallback_snippet' as const
}

function determineSummaryInput(
  contentPath: 'full' | 'snippet',
  extractedContent: string,
  normalizedSnippet: string,
  title: string,
) {
  if (contentPath === 'full' && extractedContent.trim().length > 0) {
    return {
      summaryInputBasis: 'full_content' as const,
      summaryInputText: extractedContent,
    }
  }

  if (normalizedSnippet.trim().length >= 80) {
    return {
      summaryInputBasis: 'source_snippet' as const,
      summaryInputText: normalizedSnippet,
    }
  }

  return {
    summaryInputBasis: 'title_only' as const,
    summaryInputText: title,
  }
}

function isSnippetPublicationEligible(
  summaryBasis: 'full_content' | 'feed_snippet' | 'blocked_snippet' | 'fallback_snippet',
  contentPath: 'full' | 'snippet',
  snippet: string,
  dedupeStatus: DedupeStatus,
  isRelevant: boolean,
): boolean {
  if (contentPath !== 'snippet') {
    return false
  }

  if (!isRelevant || dedupeStatus !== 'unique') {
    return false
  }

  if (!['feed_snippet', 'blocked_snippet'].includes(summaryBasis)) {
    return false
  }

  const normalized = snippet.trim()
  if (normalized.length < 80) {
    return false
  }

  if (/^(\.\.\.|…)/.test(normalized)) {
    return false
  }

  const tokenCount = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .length

  return tokenCount >= 12
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const limit = Math.max(1, Number(readArg('--limit', '500')))
const sourceKey = readArg('--source-key')
const outputPath =
  readArg('--output') ??
  path.join(process.cwd(), 'artifacts', `ai-enrich-inputs-${sourceKey ?? 'official-remaining'}.json`)

async function main(): Promise<void> {
  const rawArticles = await listRawArticlesForEnrichment(limit, sourceKey)
  const targetRawArticles = rawArticles.filter((row) => row.contentAccessPolicy === 'fulltext_allowed')
  const tagReferences = await listActiveTagReferences()
  const items = []

  for (const rawArticle of targetRawArticles) {
    const title = rawArticle.title ? normalizeHeadline(rawArticle.title) : rawArticle.normalizedUrl
    const normalizedSnippet = rawArticle.snippet ? decodeAndNormalizeText(rawArticle.snippet) : ''
    const contentResult = await resolveArticleContent(
      rawArticle.citedUrl ?? rawArticle.sourceUrl,
      normalizedSnippet,
      rawArticle.contentAccessPolicy,
      rawArticle.observedDomainFetchPolicy,
    )
    const summaryInput = determineSummaryInput(
      contentResult.contentPath,
      contentResult.content,
      normalizedSnippet,
      title,
    )
    const relevance = assessSourceTargetRelevance(rawArticle.sourceKey, title, normalizedSnippet)
    const tagResult = matchTags(
      tagReferences,
      title,
      contentResult.content || normalizedSnippet,
      rawArticle.sourceCategory,
    )
    const duplicate = await findDuplicateMatch(
      rawArticle.normalizedUrl,
      rawArticle.citedUrl,
      title,
      rawArticle.id,
    )
    const similarDuplicate = duplicate ? null : await findSimilarTitleDuplicate(title, rawArticle.id)
    const dedupeStatus = duplicate?.dedupeStatus ?? similarDuplicate?.dedupeStatus ?? 'unique'
    const dedupeGroupKey =
      duplicate?.dedupeGroupKey ??
      similarDuplicate?.dedupeGroupKey ??
      rawArticle.citedUrl ??
      rawArticle.normalizedUrl
    const provisionalState = determineProvisionalState(contentResult.contentPath, contentResult.extractionStage)
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

    items.push({
      rawArticleId: rawArticle.id,
      sourceTargetId: rawArticle.sourceTargetId,
      sourceKey: rawArticle.sourceKey,
      sourceCategory: rawArticle.sourceCategory,
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
      content: contentResult.content,
      summaryInputBasis: summaryInput.summaryInputBasis,
      summaryInputText: summaryInput.summaryInputText,
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
      candidateTags: contentResult.contentPath === 'full' && relevance.isRelevant ? tagResult.candidateTags : [],
    })
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceKey: sourceKey ?? null,
        limit,
        totalRawFetched: rawArticles.length,
        totalExported: items.length,
        items,
      },
      null,
      2,
    ),
    'utf8',
  )

  console.log(`exported=${items.length}`)
  console.log(`output=${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
