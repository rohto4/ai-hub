import type { RankBreakdown, RankingWindow } from '@/lib/db/types'

const WEIGHTS = {
  impression: 0.5,
  open: 1.0,
  share: 1.0,
  save: 1.0,
  sourceOpen: 2.0,
} as const

const WEEK_TO_ONE_FIFTH_DECAY = Math.log(5) / (7 * 24)

export function computeScore(input: {
  contentScore: number
  impressionCount: number
  openCount: number
  shareCount: number
  saveCount: number
  sourceOpenCount: number
  publishedAt: Date
}): { score: number; breakdown: RankBreakdown } {
  const activityScore =
    input.impressionCount * WEIGHTS.impression +
    input.openCount * WEIGHTS.open +
    input.shareCount * WEIGHTS.share +
    input.saveCount * WEIGHTS.save +
    input.sourceOpenCount * WEIGHTS.sourceOpen

  const hoursSincePublish = Math.max(
    0,
    (Date.now() - input.publishedAt.getTime()) / (1000 * 60 * 60),
  )
  const decayFactor = Math.exp(-WEEK_TO_ONE_FIFTH_DECAY * hoursSincePublish)
  const score = (input.contentScore + activityScore) * decayFactor

  return {
    score,
    breakdown: {
      impression: input.impressionCount,
      open: input.openCount,
      share: input.shareCount,
      save: input.saveCount,
      source_open: input.sourceOpenCount,
      content_score: input.contentScore,
      decay_factor: Number(decayFactor.toFixed(6)),
    },
  }
}

export function getWindowStart(window: RankingWindow): Date {
  const now = new Date()
  switch (window) {
    case 'hourly':
      return new Date(now.getTime() - 60 * 60 * 1000)
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}
