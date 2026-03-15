import type { RankBreakdown } from '@/lib/db/types'

/** スコア重み */
const WEIGHTS = {
  share: 5.0,
  save: 4.0,
  article_open: 2.0,
  expand_200: 1.5,
  critique_expand: 1.0,
  view: 0.1,
} as const

/** 時間減衰係数 */
const DECAY_LAMBDA = 0.1

export function computeScore(
  breakdown: RankBreakdown,
  publishedAt: Date,
): number {
  const rawScore =
    (breakdown.share * WEIGHTS.share) +
    (breakdown.save * WEIGHTS.save) +
    (breakdown.article_open * WEIGHTS.article_open) +
    (breakdown.expand_200 * WEIGHTS.expand_200) +
    (breakdown.critique_expand * WEIGHTS.critique_expand) +
    (breakdown.view * WEIGHTS.view)

  const hoursSincePublish =
    (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60)

  const decay = Math.exp(-DECAY_LAMBDA * hoursSincePublish)

  return rawScore * decay
}

export function getPeriodStart(period: '24h' | '7d' | '30d'): Date {
  const now = new Date()
  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}
