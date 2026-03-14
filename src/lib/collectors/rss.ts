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
  link?: string
  title?: string
  creator?: string
  author?: string
  pubDate?: string
  isoDate?: string
  contentSnippet?: string
  content?: string
  categories?: string[]
}

function parseDate(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeText(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = decodeAndNormalizeText(value)
  return normalized ? normalized : null
}

export const rssCollector: Collector = {
  async collect(sourceTarget: SourceTarget): Promise<CollectedItem[]> {
    if (!sourceTarget.baseUrl) {
      throw new Error(`base_url is required for RSS collector: ${sourceTarget.sourceKey}`)
    }

    const feed = await parser.parseURL(sourceTarget.baseUrl)

    const items = (feed.items as RssItem[]).flatMap((item) => {
        const sourceUrl = normalizeText(item.link ?? item.guid ?? item.id)
        if (!sourceUrl) {
          return []
        }

        const citedUrl = normalizeText(unwrapGoogleRedirectUrl(sourceUrl))

        const title = normalizeText(item.title)
        const snippet = normalizeText(item.contentSnippet ?? item.content)
        const sourcePublishedAt = parseDate(item.isoDate ?? item.pubDate)

        return [{
          sourceItemId: normalizeText(item.guid ?? item.id ?? sourceUrl),
          sourceUrl,
          citedUrl: citedUrl ?? sourceUrl,
          title,
          snippet,
          sourcePublishedAt,
          sourceUpdatedAt: sourcePublishedAt,
          sourceAuthor: normalizeText(item.creator ?? item.author),
          sourceMeta: {
            feedTitle: feed.title ?? null,
            feedLink: feed.link ?? sourceTarget.baseUrl,
            feedOriginalLink: item.link ?? item.guid ?? item.id ?? null,
            categories: item.categories ?? [],
          },
        } satisfies CollectedItem]
      })

    return items
  },
}
