import Parser from 'rss-parser'
import { normalizeUrl, hashUrl } from './normalize'

const parser = new Parser({
  timeout: 10_000,
  headers: { 'User-Agent': 'AITrendHub/1.0 (+https://aitrend.hub)' },
})

export interface RawItem {
  url: string
  url_hash: string
  title: string | null
  published_at: Date | null
}

/** 1フィードを取得してアイテム一覧を返す */
export async function fetchFeed(feedUrl: string): Promise<RawItem[]> {
  const feed = await parser.parseURL(feedUrl)

  return feed.items
    .map(item => {
      const rawUrl = item.link ?? item.guid ?? ''
      if (!rawUrl) return null
      const url = normalizeUrl(rawUrl)
      return {
        url,
        url_hash: hashUrl(url),
        title: item.title?.trim() ?? null,
        published_at: item.pubDate ? new Date(item.pubDate) : null,
      }
    })
    .filter((item): item is RawItem => item !== null)
}
