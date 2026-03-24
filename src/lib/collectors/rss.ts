import Parser from 'rss-parser'
import type { CollectedItem, Collector, SourceTarget } from '@/lib/collectors/types'
import { unwrapGoogleRedirectUrl } from '@/lib/rss/normalize'
import { decodeAndNormalizeText } from '@/lib/text/normalize'

const parser = new Parser({
  timeout: 10_000,
  headers: { 'User-Agent': 'AITrendHub/1.0 (+https://aitrend.hub)' },
})

type RssItem = {
  guid?: string
  id?: string
  link?: unknown
  title?: unknown
  creator?: unknown
  author?: unknown
  pubDate?: string
  isoDate?: string
  contentSnippet?: unknown
  content?: unknown
  categories?: string[]
}

type TextLikeRecord = Record<string, unknown>

function parseDate(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeText(value: unknown): string | null {
  if (value == null) {
    return null
  }

  const rawParts = collectTextParts(value)
  const raw = rawParts.length > 0 ? rawParts.join(' ') : null

  if (!raw) {
    return null
  }

  const normalized = decodeAndNormalizeText(raw)
  return normalized ? normalized : null
}

function collectTextParts(value: unknown, depth = 0): string[] {
  if (value == null || depth > 4) {
    return []
  }

  if (typeof value === 'string') {
    return [value]
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)]
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectTextParts(entry, depth + 1))
  }

  if (typeof value === 'object') {
    const record = value as TextLikeRecord
    const preferredKeys = ['#', '_', 'name', 'title', 'department', 'company']
    const preferred = preferredKeys.flatMap((key) => collectTextParts(record[key], depth + 1))
    if (preferred.length > 0) {
      return preferred
    }

    return Object.values(record).flatMap((entry) => collectTextParts(entry, depth + 1))
  }

  return []
}

export const rssCollector: Collector = {
  async collect(sourceTarget: SourceTarget): Promise<CollectedItem[]> {
    if (!sourceTarget.baseUrl) {
      throw new Error(`base_url is required for RSS collector: ${sourceTarget.sourceKey}`)
    }

    const response = await fetch(sourceTarget.baseUrl, {
      headers: { 'User-Agent': 'AITrendHub/1.0 (+https://aitrend.hub)' },
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error(`Status code ${response.status}`)
    }

    const feedXml = await response.text()
    const feed = await parser.parseString(feedXml)
    const items: CollectedItem[] = []

    for (const item of feed.items as RssItem[]) {
      try {
        const sourceUrl = normalizeText(item.link ?? item.guid ?? item.id)
        if (!sourceUrl) {
          continue
        }

        const citedUrl = normalizeText(unwrapGoogleRedirectUrl(sourceUrl))

        const title = normalizeText(item.title)
        const snippet = normalizeText(item.contentSnippet ?? item.content)
        const sourcePublishedAt = parseDate(item.isoDate ?? item.pubDate)

        items.push({
          sourceItemId: normalizeText(item.guid ?? item.id ?? sourceUrl),
          sourceUrl,
          citedUrl: citedUrl ?? sourceUrl,
          title,
          snippet,
          sourcePublishedAt,
          sourceUpdatedAt: sourcePublishedAt,
          sourceAuthor: normalizeText(item.creator ?? item.author),
          sourceMeta: {
            feedTitle: normalizeText(feed.title) ?? null,
            feedLink: normalizeText(feed.link) ?? response.url ?? sourceTarget.baseUrl,
            feedOriginalLink: normalizeText(item.link ?? item.guid ?? item.id) ?? null,
            categories: (item.categories ?? []).map((category) => normalizeText(category)).filter((category): category is string => Boolean(category)),
          },
        } satisfies CollectedItem)
      } catch (error) {
        console.error(`[rssCollector] Skipping malformed item for ${sourceTarget.sourceKey}:`, error)
      }
    }

    return items
  },
}
