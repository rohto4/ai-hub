import type {
  Article,
  ArticleWithScore,
  ContentLanguage,
  HomeActivity,
  HomeStats,
  RankBreakdown,
  RankPeriod,
} from '@/lib/db/types'

export type PublicArticleRow = {
  id: string
  public_key?: string | null
  url: string
  title: string
  source_category: Article['sourceCategory']
  source_type: Article['source_type']
  thumbnail_url: string | null
  thumbnail_emoji: string | null
  thumbnail_bg_theme: string | null
  content_language: ContentLanguage | null
  published_at: string
  summary_100: string | null
  summary_200: string | null
  critique: string | null
  publication_basis: Article['publication_basis']
  summary_input_basis: Article['summary_input_basis']
  topic_group_id: string | null
  created_at: string
  updated_at: string
  score: number | string
  breakdown: RankBreakdown | null
}

export type HomeStatsRow = {
  published_today: number | string
  published_total: number | string
  official_count: number | string
  blog_count: number | string
  paper_count: number | string
  news_count: number | string
  top_rated_count: number | string
  agent_count: number | string
  voice_count: number | string
  policy_count: number | string
  safety_count: number | string
  search_count: number | string
  ja_count: number | string
  en_count: number | string
}

export type HomeActivityRow = {
  impression_count_last_hour: number | string
  share_count_last_hour: number | string
  active_articles_last_hour: number | string
}

export type PublicTagRow = {
  tag_key: string
  display_name: string
  article_count: number | string
}

export type ArticleTagRow = {
  tag_key: string
  display_name: string
  sort_order: number | string
}

export type ArticleSourceRow = {
  source_key: string
  display_name: string
  source_type: Article['source_type']
}

export type PublicTagSummary = {
  tagKey: string
  displayName: string
  articleCount: number
}

export type PublicArticleDetail = ArticleWithScore & {
  publicKey: string
  tags: Array<{
    tagKey: string
    displayName: string
  }>
  sources: Array<{
    sourceKey: string
    displayName: string
    sourceType: Article['source_type']
  }>
}

export const PERIOD_INTERVAL: Record<RankPeriod, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
}

export const PUBLIC_DISPLAY_MAX_AGE = '6 months'

function normalizeArticleDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

function toAlphaXivUrl(url: string, sourceType: Article['source_type']): string {
  if (sourceType !== 'paper') {
    return url
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (hostname !== 'arxiv.org') {
    return url
  }

  const match = parsed.pathname.match(/^\/(?:abs|pdf)\/(.+?)(?:\.pdf)?$/)
  const paperId = match?.[1]?.trim()
  if (!paperId) {
    return url
  }

  return `https://www.alphaxiv.org/abs/${paperId}`
}

export function applyDomainDiversity<T extends ArticleWithScore>(articles: T[], limit: number): T[] {
  const perDomainCount = new Map<string, number>()
  const filtered: T[] = []

  for (const article of articles) {
    if (filtered.length >= limit) {
      break
    }

    const domain = normalizeArticleDomain(article.url)
    if (!domain) {
      filtered.push(article)
      continue
    }

    const current = perDomainCount.get(domain) ?? 0
    const maxPerDomain = article.source_type === 'paper' ? 1 : 2
    if (current >= maxPerDomain) {
      continue
    }

    perDomainCount.set(domain, current + 1)
    filtered.push(article)
  }

  return filtered
}

export function toArticle(row: PublicArticleRow): ArticleWithScore {
  return {
    id: row.id,
    publicKey: row.public_key ?? undefined,
    url: toAlphaXivUrl(row.url, row.source_type),
    title: row.title,
    sourceCategory: row.source_category,
    source_type: row.source_type,
    thumbnail_url: row.thumbnail_url,
    thumbnail_emoji: row.thumbnail_emoji,
    thumbnail_bg_theme: row.thumbnail_bg_theme,
    content_language: row.content_language,
    published_at: new Date(row.published_at),
    summary_100: row.summary_100,
    summary_200: row.summary_200,
    critique: row.critique,
    publication_basis: row.publication_basis,
    summary_input_basis: row.summary_input_basis,
    topic_group_id: row.topic_group_id,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    score: Number(row.score),
    breakdown: row.breakdown ?? undefined,
  }
}

export function buildSourceCategoryFilter(sourceCategory?: string | null): string | null {
  if (!sourceCategory || sourceCategory === 'all') return null
  return sourceCategory
}

export function buildSourceTypeFilter(sourceType?: string | null): string | null {
  if (!sourceType || sourceType === 'all') return null
  return sourceType
}

export function mapHomeStats(row?: HomeStatsRow): HomeStats {
  return {
    publishedToday: Number(row?.published_today ?? 0),
    publishedTotal: Number(row?.published_total ?? 0),
    officialCount: Number(row?.official_count ?? 0),
    blogCount: Number(row?.blog_count ?? 0),
    paperCount: Number(row?.paper_count ?? 0),
    newsCount: Number(row?.news_count ?? 0),
    topRatedCount: Number(row?.top_rated_count ?? 0),
    agentCount: Number(row?.agent_count ?? 0),
    voiceCount: Number(row?.voice_count ?? 0),
    policyCount: Number(row?.policy_count ?? 0),
    safetyCount: Number(row?.safety_count ?? 0),
    searchCount: Number(row?.search_count ?? 0),
    jaCount: Number(row?.ja_count ?? 0),
    enCount: Number(row?.en_count ?? 0),
  }
}

export function mapHomeActivity(row?: HomeActivityRow): HomeActivity {
  return {
    impressionCountLastHour: Number(row?.impression_count_last_hour ?? 0),
    shareCountLastHour: Number(row?.share_count_last_hour ?? 0),
    activeArticlesLastHour: Number(row?.active_articles_last_hour ?? 0),
  }
}
