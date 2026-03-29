import { ArticleCard } from '@/components/card/ArticleCard'
import type { UiArticle } from '@/components/home/home-state-shared'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingGrid } from '@/components/ui/LoadingGrid'
import { SectionHeading } from '@/components/ui/SectionHeading'
import type { ActionType } from '@/lib/db/types'

export function HomeArticleSection({
  id,
  title,
  showHeading = true,
  articles,
  loading,
  summaryMode,
  focusedArticleId,
  savedArticleIds,
  likedArticleIds,
  onCardClick,
  onAction,
  onOpenArticle,
}: {
  id: string
  title: string
  showHeading?: boolean
  articles: UiArticle[]
  loading: boolean
  summaryMode: 100 | 200
  focusedArticleId: string | null
  savedArticleIds: string[]
  likedArticleIds: string[]
  onCardClick: (articleId: string) => void
  onAction: (type: ActionType, articleId: string) => void
  onOpenArticle: (articleId: string) => void
}) {
  return (
    <div id={id} className="mt-6 first:mt-4">
      {showHeading ? <SectionHeading>{title}</SectionHeading> : null}
      {loading ? (
        <LoadingGrid />
      ) : articles.length > 0 ? (
        <div className={summaryMode === 200 ? 'grid grid-cols-1 gap-3 md:grid-cols-2' : 'grid grid-cols-1 gap-2 md:grid-cols-2'}>
          {articles.map((article) => (
            <ArticleCard
              key={`${id}-${article.id}`}
              article={article}
              summaryMode={summaryMode}
              isFocused={focusedArticleId === article.id}
              isSaved={savedArticleIds.includes(article.id)}
              isLiked={likedArticleIds.includes(article.id)}
              onCardClick={onCardClick}
              onAction={onAction}
              onOpenArticle={onOpenArticle}
              onLike={() => onAction(likedArticleIds.includes(article.id) ? 'unlike' : 'like', article.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="記事がまだありません" description="期間や topic を切り替えて確認してください。" />
      )}
    </div>
  )
}
