import Link from 'next/link'
import { ArticleTagGroups } from '@/components/shared/ArticleTagGroups'
import { ArticleThumbnail } from '@/components/shared/ArticleThumbnail'
import type { Article, ArticleWithScore } from '@/lib/db/types'
import { getArticleCategoryLabel } from '@/lib/site/navigation'

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
        (() => {
          const categoryLabel = getArticleCategoryLabel({
            sourceType: article.source_type,
            sourceCategory: article.sourceCategory,
          })

          return (
        <article
          key={article.id}
          className="group relative overflow-hidden border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,249,244,0.88))] p-5 shadow-[0_22px_60px_rgba(43,31,24,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(43,31,24,0.12)]"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(163,91,46,0.9),rgba(255,170,95,0.55),rgba(255,255,255,0))]" />
          <div className="flex gap-4">
            <ArticleThumbnail
              articleId={article.id}
              sourceType={article.source_type}
              thumbnailUrl={article.thumbnail_url}
              thumbnailEmoji={article.thumbnail_emoji}
              thumbnailBgTheme={article.thumbnail_bg_theme}
              className="h-28 w-24 shrink-0 border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
              emojiClassName="text-4xl"
            />

            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                {showRank ? (
                  <span className="rounded-full bg-[color:var(--color-panel-strong)] px-2.5 py-1 font-black text-[color:var(--color-accent-darker)]">
                    #{index + 1}
                  </span>
                ) : null}
                {categoryLabel ? (
                  <span className="rounded-full bg-black/5 px-2.5 py-1 font-bold text-[color:var(--color-accent-darker)]">
                    {categoryLabel}
                  </span>
                ) : null}
                <span className="text-[color:var(--color-muted)]">
                  {article.published_at.toLocaleDateString('ja-JP')}
                </span>
              </div>

              <Link
                href={`/articles/${article.publicKey ?? article.id}`}
                className="inline-block text-xl font-black leading-tight tracking-[-0.04em] text-[color:var(--color-ink)] transition group-hover:text-[color:var(--color-accent-darker)]"
              >
                {article.title}
              </Link>

              <p className="mt-3 text-sm leading-7 text-[color:var(--color-subtle)]">
                {article.summary_100 ?? '要約は準備中です。'}
              </p>

              <ArticleTagGroups
                primaryTags={article.primaryTags.slice(0, 3)}
                adjacentTags={article.adjacentTags.slice(0, 2)}
                className="mt-4"
              />
            </div>
          </div>
        </article>
          )
        })()
      ))}
    </div>
  )
}
