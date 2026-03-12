import type { RankBreakdown } from '@/lib/db/types'

/** スコア重み */
const WEIGHTS = {
  share:         5.0,  // SNS拡散（最重要）
  save:          4.0,  // 保存（高意図）
  expand_300:    3.0,  // 深読み
  article_open:  2.0,  // 外部遷移
  expand_200:    1.5,
  critique_expand: 1.0,
  view:          0.1,  // 表示は弱め
} as const

/** 時間減衰係数（λ=0.1/hour） */
const DECAY_LAMBDA = 0.1

/**
 * 記事スコアを計算する
 * @param breakdown - 集計済みアクション数
 * @param publishedAt - 記事の公開日時
 */
export function computeScore(
  breakdown: RankBreakdown,
  publishedAt: Date
): number {
  const rawScore =
    (breakdown.share        * WEIGHTS.share)         +
    (breakdown.save         * WEIGHTS.save)          +
    (breakdown.expand_300   * WEIGHTS.expand_300)    +
    (breakdown.article_open * WEIGHTS.article_open)  +
    (breakdown.expand_200   * WEIGHTS.expand_200)    +
    (breakdown.critique_expand * WEIGHTS.critique_expand) +
    (breakdown.view         * WEIGHTS.view)

  const hoursSincePublish =
    (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60)

  const decay = Math.exp(-DECAY_LAMBDA * hoursSincePublish)

  return rawScore * decay
}

/** period に応じた集計期間の開始日時を返す */
export function getPeriodStart(period: '24h' | '7d' | '30d'): Date {
  const now = new Date()
  switch (period) {
    case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case '7d':  return new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}
