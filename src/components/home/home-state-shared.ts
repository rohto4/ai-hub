import type { Article, HomeActivity, HomeResponse, HomeStats, LaneKey, SearchResponse } from '@/lib/db/types'

export type TopicChip = 'all' | 'llm' | 'agent' | 'voice' | 'policy' | 'safety' | 'search' | 'news'
export type UiArticle = Article & { score?: number }
export type UiLanes = Record<LaneKey, UiArticle[]>

export type HomeData = {
  random: UiArticle[]
  latest: UiArticle[]
  unique: UiArticle[]
  lanes: UiLanes
  loading: boolean
  message: string | null
}

export type SearchLoadState = {
  articles: UiArticle[]
  loading: boolean
  message: string | null
}

export interface ShareState {
  target: UiArticle | null
  status: string | null
  textContent: string
  includeAiTrendHub: boolean
  includeTitle: boolean
  includeSummary: boolean
}

export const emptyLanes: UiLanes = { official: [], paper: [], news: [] }

export const initialHomeData: HomeData = {
  random: [],
  latest: [],
  unique: [],
  lanes: emptyLanes,
  loading: true,
  message: 'ホームを読み込み中です。',
}

export const initialSearchState: SearchLoadState = { articles: [], loading: false, message: null }

export const initialHomeStats: HomeStats = {
  publishedToday: 0,
  publishedTotal: 0,
  officialCount: 0,
  blogCount: 0,
  paperCount: 0,
  newsCount: 0,
  topRatedCount: 0,
  agentCount: 0,
  voiceCount: 0,
  policyCount: 0,
  safetyCount: 0,
  searchCount: 0,
}

export const initialHomeActivity: HomeActivity = {
  impressionCountLastHour: 0,
  shareCountLastHour: 0,
  activeArticlesLastHour: 0,
}

export function hydrateArticle(article: UiArticle): UiArticle {
  return {
    ...article,
    score:
      typeof article.score === 'number'
        ? article.score
        : typeof article.score === 'string'
          ? Number(article.score)
          : article.score,
    published_at: new Date(article.published_at),
    created_at: new Date(article.created_at),
    updated_at: new Date(article.updated_at),
  }
}

export function toUiArticles(articles: UiArticle[]): UiArticle[] {
  return articles.map(hydrateArticle)
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? `Request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

export type HomeLoadResponse = HomeResponse
export type SearchLoadResponse = SearchResponse
