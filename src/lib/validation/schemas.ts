import { z } from 'zod'
import type { Genre, RankPeriod, Platform, ActionType } from '@/lib/db/types'

// ---- 共通 ----
const GENRES: [Genre, ...Genre[]] = [
  'llm', 'agent', 'coding', 'image_gen', 'voice',
  'rag', 'fine_tuning', 'enterprise', 'safety',
  'hardware', 'robotics', 'education', 'medical',
  'legal', 'finance', 'regulation',
]

const RANK_PERIODS: [RankPeriod, ...RankPeriod[]] = ['24h', '7d', '30d']

// ---- GET /api/trends ----
export const TrendsQuerySchema = z.object({
  period: z.enum(RANK_PERIODS).default('24h'),
  genre: z.string().default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type TrendsQuery = z.infer<typeof TrendsQuerySchema>

// ---- GET /api/search ----
export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100).trim(),
  genre: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>

// ---- POST /api/actions ----
const ACTION_TYPES: [ActionType, ...ActionType[]] = [
  'view', 'expand_200', 'expand_300', 'article_open', 'return_focus',
  'share_open', 'share_copy', 'share_x', 'share_threads', 'share_slack',
  'share_misskey', 'save', 'unsave', 'topic_group_open', 'critique_expand',
  'search', 'digest_click',
]

const PLATFORMS: [Platform, ...Platform[]] = ['pc', 'sp', 'tb']

export const ActionLogSchema = z.object({
  article_id: z.string().uuid().nullable().optional(),
  action_type: z.enum(ACTION_TYPES),
  session_id: z.string().min(1).max(128),
  platform: z.enum(PLATFORMS).optional(),
  source: z.enum(['direct', 'digest', 'search', 'topic_group']).optional(),
  meta: z.record(z.unknown()).optional(),
})

export type ActionLogInput = z.infer<typeof ActionLogSchema>

// ---- POST /api/push/subscribe ----
export const PushSubscribeSchema = z.object({
  session_id: z.string().min(1).max(128),
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
  genres: z.array(z.enum(GENRES)).default([]),
})

export type PushSubscribeInput = z.infer<typeof PushSubscribeSchema>

// ---- 要約文字数バリデーション ----
export const SummarySchema = z.object({
  summary_100: z.string()
    .min(1)
    .max(120)  // 100字 + バッファ
    .refine(s => !containsForbiddenWords(s), '禁止語を含んでいます'),
  summary_200: z.string().max(240).optional(),
  summary_300: z.string().max(360).optional(),
  critique: z.string().max(500).optional(),
})

// 禁止語チェック（差別語・広告的表現など）
const FORBIDDEN_WORDS = [
  '最高', '最強', '絶対', '完璧', '必見', '衝撃',
]

function containsForbiddenWords(text: string): boolean {
  return FORBIDDEN_WORDS.some(word => text.includes(word))
}
