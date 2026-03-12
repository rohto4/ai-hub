// ============================================================
// DB 型定義 — テーブルスキーマに1:1対応
// ============================================================

export type Genre =
  | 'llm' | 'agent' | 'coding' | 'image_gen' | 'voice'
  | 'rag' | 'fine_tuning' | 'enterprise' | 'safety'
  | 'hardware' | 'robotics' | 'education' | 'medical'
  | 'legal' | 'finance' | 'regulation'

export type SourceType = 'youtube' | 'blog' | 'official' | 'news'

export type RankPeriod = '24h' | '7d' | '30d'

export type Platform = 'pc' | 'sp' | 'tb'

export type ActionSource = 'direct' | 'digest' | 'search' | 'topic_group'

export type ActionType =
  | 'view'
  | 'expand_200'
  | 'expand_300'
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
  | 'topic_group_open'
  | 'critique_expand'
  | 'search'
  | 'digest_click'

// ---- feeds ----
export interface Feed {
  id: string
  name: string
  url: string
  genre: Genre
  source_type: SourceType
  active: boolean
  fetch_interval_m: number
  last_fetched_at: Date | null
  error_count: number
  created_at: Date
}

// ---- source_items ----
export interface SourceItem {
  id: string
  feed_id: string
  url: string
  url_hash: string
  title: string | null
  published_at: Date | null
  raw_content: string | null
  content_expires_at: Date | null
  processed: boolean
  fetched_at: Date
}

// ---- topic_groups ----
export interface TopicGroup {
  id: string
  genre: Genre
  label: string
  article_count: number
  created_at: Date
  updated_at: Date
}

// ---- articles ----
export interface Article {
  id: string
  url: string
  url_hash: string
  title: string
  genre: Genre
  source_type: SourceType
  thumbnail_url: string | null
  published_at: Date
  summary_100: string | null
  summary_200: string | null
  summary_300: string | null
  critique: string | null
  ai_model: string | null
  topic_group_id: string | null
  // embedding は API 層には露出しない（pgvector バッチ専用）
  created_at: Date
  updated_at: Date
}

// ---- rank_scores ----
export interface RankScore {
  article_id: string
  period: RankPeriod
  genre: string   // 'all' | Genre
  score: number
  breakdown: RankBreakdown | null
  computed_at: Date
}

export interface RankBreakdown {
  share: number
  save: number
  view: number
  expand_300: number
  expand_200: number
  critique_expand: number
  article_open: number
}

// ---- action_logs ----
export interface ActionLog {
  id: bigint
  article_id: string | null
  action_type: ActionType
  session_id: string
  user_id: string | null
  platform: Platform | null
  source: ActionSource | null
  meta: Record<string, unknown> | null
  created_at: Date
}

// ---- push_subscriptions ----
export interface PushSubscription {
  id: string
  user_id: string | null
  session_id: string
  endpoint: string
  keys: { auth: string; p256dh: string }
  genres: Genre[]
  active: boolean
  created_at: Date
}

// ---- digest_logs ----
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

// ============================================================
// API レスポンス型（DB型をフロント向けに整形）
// ============================================================

export interface ArticleWithScore extends Article {
  score: number
  breakdown?: RankBreakdown
}

export interface TrendsResponse {
  articles: ArticleWithScore[]
  period: RankPeriod
  genre: string
  total: number
}

export interface SearchResponse {
  articles: Article[]
  query: string
  total: number
}

export interface TopicGroupWithArticles extends TopicGroup {
  articles: Article[]
}
