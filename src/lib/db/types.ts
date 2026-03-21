export type SourceCategory =
  | 'llm'
  | 'agent'
  | 'voice'
  | 'policy'
  | 'safety'
  | 'search'
  | 'news'

export type SourceType =
  | 'official'
  | 'blog'
  | 'news'
  | 'video'
  | 'alerts'
  | 'paper'

export type ContentLanguage = 'ja' | 'en'

export type LaneKey = 'official' | 'paper' | 'news'
export type Lanes = Record<LaneKey, ArticleWithScore[]>

export type RankPeriod = '24h' | '7d' | '30d'
export type RankingWindow = 'hourly' | RankPeriod

export type Platform = 'pc' | 'sp' | 'tb'

export type ActionSource = 'direct' | 'digest' | 'search' | 'topic_group'

export type ActionType =
  | 'view'
  | 'expand_200'
  | 'article_open'
  | 'return_focus'
  | 'share_open'
  | 'share_copy'
  | 'share_x'
  | 'share_threads'
  | 'share_slack'
  | 'share_misskey'
  | 'save'
  | 'unsave'
  | 'like'
  | 'unlike'
  | 'topic_group_open'
  | 'critique_expand'
  | 'search'
  | 'digest_click'

export interface Article {
  id: string
  publicKey?: string
  url: string
  title: string
  sourceCategory: SourceCategory
  source_type: SourceType
  thumbnail_url: string | null
  thumbnail_emoji: string | null
  content_language: ContentLanguage | null
  published_at: Date
  summary_100: string | null
  summary_200: string | null
  critique: string | null
  publication_basis: 'full_summary' | 'source_snippet' | null
  summary_input_basis: 'full_content' | 'source_snippet' | 'title_only' | null
  topic_group_id: string | null
  created_at: Date
  updated_at: Date
}

export interface RankBreakdown {
  impression: number
  open: number
  share: number
  save: number
  source_open: number
  content_score: number
  decay_factor: number
}

export interface ArticleWithScore extends Article {
  score: number
  breakdown?: RankBreakdown
}

export interface TrendsResponse {
  articles: ArticleWithScore[]
  period: RankPeriod
  sourceCategory: string
  total: number
}

export interface SearchResponse {
  articles: Article[]
  query: string
  total: number
}

export interface HomeStats {
  publishedToday: number
  publishedTotal: number
  officialCount: number
  blogCount: number
  paperCount: number
  newsCount: number
  topRatedCount: number
  agentCount: number
  voiceCount: number
  policyCount: number
  safetyCount: number
  searchCount: number
  jaCount: number
  enCount: number
}

export interface HomeActivity {
  impressionCountLastHour: number
  shareCountLastHour: number
  activeArticlesLastHour: number
}

export interface HomeResponse {
  random: ArticleWithScore[]
  latest: ArticleWithScore[]
  unique: ArticleWithScore[]
  lanes: Lanes
  period: RankPeriod
  stats: HomeStats
  activity: HomeActivity
}

export interface PushSubscription {
  id: string
  user_id: string | null
  session_id: string
  endpoint: string
  keys: { auth: string; p256dh: string }
  sourceCategories: SourceCategory[]
  active: boolean
  created_at: Date
}

export type DigestStatus = 'pending' | 'sent' | 'failed'

export interface DigestLog {
  id: string
  subscription_id: string
  scheduled_at: Date
  sent_at: Date | null
  status: DigestStatus
  article_ids: string[]
  error_msg: string | null
  retry_count: number
}
