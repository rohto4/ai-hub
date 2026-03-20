import { z } from 'zod'
import type { SourceCategory, RankPeriod, Platform, ActionType } from '@/lib/db/types'

const SOURCE_CATEGORIES: [SourceCategory, ...SourceCategory[]] = [
  'llm',
  'agent',
  'voice',
  'policy',
  'safety',
  'search',
  'news',
]

const RANK_PERIODS: [RankPeriod, ...RankPeriod[]] = ['24h', '7d', '30d']

export const TrendsQuerySchema = z.object({
  period: z.enum(RANK_PERIODS).default('24h'),
  sourceCategory: z.string().default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type TrendsQuery = z.infer<typeof TrendsQuerySchema>

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100).trim(),
  sourceCategory: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>

const ACTION_TYPES: [ActionType, ...ActionType[]] = [
  'view', 'expand_200', 'article_open', 'return_focus',
  'share_open', 'share_copy', 'share_x', 'share_threads', 'share_slack',
  'share_misskey', 'save', 'unsave', 'like', 'unlike',
  'topic_group_open', 'critique_expand', 'search', 'digest_click',
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

export const PushSubscribeSchema = z.object({
  session_id: z.string().min(1).max(128),
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
  sourceCategories: z.array(z.enum(SOURCE_CATEGORIES)).default([]),
})

export type PushSubscribeInput = z.infer<typeof PushSubscribeSchema>

export const SummarySchema = z.object({
  summary_100: z.string()
    .min(1)
    .max(120)
    .refine((value) => !containsForbiddenWords(value), 'Forbidden word included'),
  summary_200: z.string().max(240).optional(),
  critique: z.string().max(500).optional(),
})

const FORBIDDEN_WORDS = [
  '最新',
  '最強',
  '絶対',
  '神機能',
  '革命',
  '必見',
]

function containsForbiddenWords(text: string): boolean {
  return FORBIDDEN_WORDS.some((word) => text.includes(word))
}
