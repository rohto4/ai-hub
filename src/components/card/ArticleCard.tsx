'use client'

import type { Article, ActionType } from '@/lib/db/types'

interface Props {
  article: Article & { score?: number }
  rank?: number
  summaryMode: 100 | 200 | 300
  showCritique?: boolean
  isFocused?: boolean
  isSaved?: boolean
  onAction: (type: ActionType, articleId: string) => void
  onOpenArticle: (articleId: string) => void
}

const sourceLabel: Record<Article['source_type'], string> = {
  youtube: 'YouTube',
  blog: 'Blog',
  official: 'Official',
  news: 'News',
}

export function ArticleCard({
  article,
  rank,
  summaryMode,
  showCritique = false,
  isFocused = false,
  isSaved = false,
  onAction,
  onOpenArticle,
}: Props) {
  const numericScore =
    typeof article.score === 'number'
      ? article.score
      : typeof article.score === 'string'
        ? Number(article.score)
        : undefined

  const summary =
    (summaryMode === 300 ? article.summary_300 : summaryMode === 200 ? article.summary_200 : article.summary_100) ??
    article.summary_100 ??
    '要約準備中'

  const meta = [
    rank ? `#${rank}` : null,
    article.genre,
    `${summaryMode}字`,
    typeof numericScore === 'number' && Number.isFinite(numericScore) ? `Score ${numericScore.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join(' ・ ')

  return (
    <article
      className="relative overflow-hidden rounded-xl border bg-card-second"
      style={{
        minHeight: summaryMode === 300 || showCritique ? 320 : 272,
        borderColor: isFocused || showCritique ? 'var(--color-orange)' : '#e5e5e5',
        boxShadow: '0 4px 4px rgba(0,0,0,0.25)',
      }}
      id={`article-card-${article.id}`}
    >
      <div className="flex gap-3 p-2.5 pb-24 md:pb-12">
        <div
          className="relative mt-0.5 h-[128px] w-[84px] shrink-0 overflow-hidden rounded-lg md:h-[163px] md:w-[94px]"
          style={{ background: 'linear-gradient(145deg, #ffe8d6, #ffd8bd)' }}
        >
          {article.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <span className="absolute bottom-3 right-3 text-[10px] font-semibold text-white">
            {sourceLabel[article.source_type]}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
          <button
            type="button"
            className="line-clamp-2 text-left text-[14px] font-extrabold leading-[1.45] text-ink"
            onClick={() => onOpenArticle(article.id)}
          >
            {article.title}
          </button>
          <p className="text-[11px] text-muted">{meta}</p>
          <p className="text-[12px] leading-[1.7] text-[#4f5969]" style={{ fontFamily: 'Voces, serif' }}>
            {summary}
          </p>
          {showCritique && article.critique ? (
            <div className="rounded-lg border border-[#f4d3bf] bg-[#fff8ef] px-3 py-2 text-[11px] leading-5 text-subtle">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-accent-dark">
                Critique
              </span>
              {article.critique}
            </div>
          ) : null}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-2 grid grid-cols-3 gap-1.5 px-2 md:flex md:items-center md:justify-center md:gap-[7px]">
        <ActButton label={summaryMode === 300 ? '折りたたむ' : '300字'} onClick={() => onAction('expand_300', article.id)} />
        <ActButton label="Topic Group" onClick={() => onAction('topic_group_open', article.id)} />
        <ActButton label="共有" variant="share" onClick={() => onAction('share_open', article.id)} />
        <ActButton label={isSaved ? '保存済み' : '保存'} onClick={() => onAction(isSaved ? 'unsave' : 'save', article.id)} />
        <ActButton label="批評" onClick={() => onAction('critique_expand', article.id)} />
      </div>
    </article>
  )
}

function ActButton({
  label,
  variant = 'default',
  onClick,
}: {
  label: string
  variant?: 'default' | 'share'
  onClick: () => void
}) {
  const isShare = variant === 'share'
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 rounded-full border-none px-2 text-[10px] md:min-w-[72px] md:text-[11px]"
      style={{
        height: 26,
        background: isShare ? 'var(--color-orange)' : 'transparent',
        color: isShare ? '#fff' : 'var(--color-ink)',
        fontWeight: isShare ? 700 : 500,
        borderTop: isShare ? '1px solid transparent' : '1px solid var(--color-second-orange)',
        borderLeft: isShare ? '1px solid transparent' : '1px solid var(--color-second-orange)',
        borderBottom: isShare ? '1px solid var(--color-accent-darker)' : '1px solid transparent',
        borderRight: isShare ? '1px solid var(--color-accent-darker)' : '1px solid transparent',
        boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
      }}
    >
      {label}
    </button>
  )
}
