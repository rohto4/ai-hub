import Link from 'next/link'
import { ArticleThumbnail } from '@/components/shared/ArticleThumbnail'
import type { Article, ArticleWithScore } from '@/lib/db/types'

function sourceTone(sourceType: ArticleWithScore['source_type']): string {
  switch (sourceType) {
    case 'official':
      return 'bg-[#dbeafe] text-[#1d4ed8]'
    case 'blog':
      return 'bg-[#dcfce7] text-[#15803d]'
    case 'paper':
      return 'bg-[#f3e8ff] text-[#7e22ce]'
    case 'alerts':
      return 'bg-[#fef3c7] text-[#b45309]'
    case 'news':
      return 'bg-[#fee2e2] text-[#b91c1c]'
    case 'video':
      return 'bg-[#fde68a] text-[#92400e]'
  }
}

export function PublicArticleList({
  articles,
  showRank = false,
}: {
  articles: Array<(Article | ArticleWithScore) & { publicKey?: string }>
  showRank?: boolean
}) {
  return (
    <div className="grid gap-4">
      {articles.map((article, index) => (
        <article key={article.id} className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="flex gap-4">
            <ArticleThumbnail
              articleId={article.id}
              sourceType={article.source_type}
              thumbnailUrl={article.thumbnail_url}
              thumbnailEmoji={article.thumbnail_emoji}
              thumbnailBgTheme={article.thumbnail_bg_theme}
              className="h-24 w-20 shrink-0 rounded-2xl"
              emojiClassName="text-4xl"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                {showRank ? <span className="font-extrabold text-accent-dark">#{index + 1}</span> : null}
                <span className={`rounded-full px-2 py-1 font-bold ${sourceTone(article.source_type)}`}>{article.source_type}</span>
                <span className="rounded-full bg-[#f6f0ea] px-2 py-1 font-bold text-accent-darker">{article.sourceCategory}</span>
                <span className="text-muted">{article.published_at.toLocaleDateString('ja-JP')}</span>
              </div>
              <Link href={`/articles/${article.publicKey ?? article.id}`} className="text-lg font-extrabold leading-tight hover:underline">
                {article.title}
              </Link>
              <p className="mt-2 text-sm leading-7 text-[#4f5969]">{article.summary_100 ?? '要約を準備中です。'}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
