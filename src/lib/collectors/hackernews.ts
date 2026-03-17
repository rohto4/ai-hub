import { getSql } from '@/lib/db'
import type { CollectedItem, Collector, SourceTarget } from '@/lib/collectors/types'

const HN_BASE = 'https://hacker-news.firebaseio.com/v0'
const TOP_STORIES_LIMIT = 60   // 取得するトップストーリー数（フィルタ後に絞り込む）
const MAX_OUTPUT = 20           // 最終出力上限

type HnItem = {
  id: number
  title?: string
  url?: string
  score?: number
  descendants?: number
  by?: string
  time?: number
  type?: string
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'AITrendHub/1.0 (+https://aitrend.hub)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`HN fetch failed: ${url} → ${response.status}`)
  }
  return response.json() as Promise<T>
}

async function loadCollectionKeywords(): Promise<string[]> {
  try {
    const sql = getSql()
    const rows = (await sql`
      SELECT keyword, is_case_sensitive
      FROM tag_keywords
      WHERE use_for_collection = true
    `) as Array<{ keyword: string; is_case_sensitive: boolean }>

    // is_case_sensitive=false のものは全て lowercase で保持
    return rows.map((row) => (row.is_case_sensitive ? row.keyword : row.keyword.toLowerCase()))
  } catch {
    // DB 接続不可時は基本キーワードで継続
    return [
      'llm', 'ai', 'gpt', 'claude', 'gemini', 'llama', 'mistral', 'deepseek',
      'openai', 'anthropic', 'transformer', 'language model', 'machine learning',
      'deep learning', 'neural', 'agent', 'rag', 'diffusion', 'stable diffusion',
      'midjourney', 'cursor', 'copilot',
    ]
  }
}

function matchesKeywords(title: string, keywords: string[]): boolean {
  const titleLower = title.toLowerCase()
  return keywords.some((kw) => titleLower.includes(kw))
}

export const hackerNewsCollector: Collector = {
  async collect(_sourceTarget: SourceTarget): Promise<CollectedItem[]> {
    const keywords = await loadCollectionKeywords()
    const topIds = await fetchJson<number[]>(`${HN_BASE}/topstories.json`)
    const targetIds = topIds.slice(0, TOP_STORIES_LIMIT)

    const items: CollectedItem[] = []

    for (const id of targetIds) {
      if (items.length >= MAX_OUTPUT) break

      try {
        const item = await fetchJson<HnItem>(`${HN_BASE}/item/${id}.json`)

        if (item.type !== 'story' || !item.title || !item.url) continue
        if (!matchesKeywords(item.title, keywords)) continue

        const publishedAt = item.time
          ? new Date(item.time * 1000).toISOString()
          : null

        items.push({
          sourceItemId: String(item.id),
          sourceUrl: item.url,
          citedUrl: item.url,
          title: item.title,
          snippet: null,
          sourcePublishedAt: publishedAt,
          sourceUpdatedAt: publishedAt,
          sourceAuthor: item.by ?? null,
          sourceMeta: {
            hnId: item.id,
            hnScore: item.score ?? 0,
            hnComments: item.descendants ?? 0,
            hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
          },
        })
      } catch {
        // 個別アイテムの取得失敗はスキップ
        continue
      }
    }

    return items
  },
}
