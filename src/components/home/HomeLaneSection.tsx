import { ArticleRow } from '@/components/card/ArticleRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingGrid } from '@/components/ui/LoadingGrid'
import type { UiArticle } from '@/components/home/home-state-shared'

export function HomeLaneSection({
  laneKey,
  label,
  tone,
  articles,
  loading,
  summaryMode,
}: {
  laneKey: string
  label: string
  tone: { bg: string; text: string }
  articles: UiArticle[]
  loading: boolean
  summaryMode: 100 | 200
}) {
  return (
    <div id={`lane-${laneKey}`}>
      <div
        className="mb-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-extrabold"
        style={{ background: tone.bg, color: tone.text }}
      >
        <span>{label}</span>
        <span className="text-[10px] opacity-70">{articles.length} 件</span>
      </div>
      {loading ? (
        <LoadingGrid compact />
      ) : articles.length > 0 ? (
        <div className="rounded-xl border border-black/5 bg-white p-3">
          {articles.map((article) => (
            <ArticleRow key={article.id} article={{ ...article, score: article.score ?? 0 }} summaryMode={summaryMode} />
          ))}
        </div>
      ) : (
        <EmptyState title={`${label} の記事がありません`} description="期間フィルタを変更してください。" />
      )}
    </div>
  )
}
