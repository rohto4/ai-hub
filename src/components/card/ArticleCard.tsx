'use client'

import { ArticleThumbnail } from '@/components/shared/ArticleThumbnail'
import type { ActionType, Article } from '@/lib/db/types'

interface Props {
  article: Article & { score?: number }
  summaryMode: 100 | 200
  isFocused?: boolean
  isSaved?: boolean
  isLiked?: boolean
  onCardClick: (articleId: string) => void
  onOpenArticle: (articleId: string) => void
  onAction: (type: ActionType, articleId: string) => void
  onLike: (articleId: string) => void
}

const sourceLabel: Record<Article['source_type'], string> = {
  official: 'Official',
  alerts: 'Alerts',
  blog: 'Blog',
  paper: 'Paper',
  news: 'News',
  video: 'Video',
}

const languageLabel: Record<NonNullable<Article['content_language']>, string> = {
  ja: 'JP',
  en: 'EN',
}

export function ArticleCard({
  article,
  summaryMode,
  isFocused = false,
  isSaved = false,
  isLiked = false,
  onCardClick,
  onOpenArticle,
  onAction,
  onLike,
}: Props) {
  const rawScore = article.score
  const numericScore = rawScore != null && Number.isFinite(Number(rawScore)) ? Number(rawScore) : undefined

  const summary =
    (summaryMode === 200 ? article.summary_200 : article.summary_100) ??
    article.summary_100 ??
    '要約は準備中です。'

  const metaText = [
    article.sourceCategory,
    numericScore != null ? `Score ${numericScore.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join(' / ')

  const isLongSummary = summaryMode === 200

  return (
    <article
      id={`article-card-${article.id}`}
      className="relative overflow-hidden border bg-card-second"
      style={{
        minHeight: isLongSummary ? 220 : 180,
        borderColor: isFocused ? 'var(--color-orange)' : '#e5e5e5',
        boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
      }}
    >
      {/* ☆ 高評価ボタン (右上) */}
      <button
        type="button"
        className="absolute right-2 top-2 z-10 text-[18px] leading-none"
        style={{ color: isLiked ? 'var(--color-orange)' : 'var(--color-second-orange)' }}
        onClick={(e) => {
          e.stopPropagation()
          onLike(article.id)
        }}
        aria-label={isLiked ? '高評価を取り消す' : '高評価'}
      >
        {isLiked ? '★' : '☆'}
      </button>

      {/* メインコンテンツ（クリックでモーダル） */}
      <button
        type="button"
        className="flex w-full text-left"
        style={{
          gap: isLongSummary ? 12 : 10,
          padding: isLongSummary ? '12px 12px 52px' : '10px 10px 48px',
        }}
        onClick={() => onCardClick(article.id)}
      >
        {/* サムネイル (小型) */}
        <ArticleThumbnail
          articleId={article.id}
          sourceType={article.source_type}
          thumbnailUrl={article.thumbnail_url}
          thumbnailEmoji={article.thumbnail_emoji}
          thumbnailBgTheme={article.thumbnail_bg_theme}
          className={isLongSummary ? 'mt-0.5 h-[92px] w-[68px] shrink-0' : 'mt-0.5 h-[72px] w-[56px] shrink-0'}
          badgeLabel={sourceLabel[article.source_type]}
        />

        {/* テキスト */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6 pt-0.5">
          <div className="flex items-center gap-1.5">
            {article.content_language ? (
              <span
                className="inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-bold leading-none"
                style={{
                  borderColor: 'var(--color-second-orange)',
                  color: 'var(--color-accent-darker)',
                  backgroundColor: '#fff7ed',
                }}
              >
                {languageLabel[article.content_language]}
              </span>
            ) : null}
          </div>
          <p className={isLongSummary ? 'line-clamp-3 text-[14px] font-extrabold leading-[1.45] text-ink' : 'line-clamp-2 text-[13px] font-extrabold leading-[1.4] text-ink'}>
            {article.title}
          </p>
          <p className={isLongSummary ? 'line-clamp-5 text-[12px] leading-[1.7] text-[#4f5969]' : 'line-clamp-3 text-[11px] leading-[1.6] text-[#4f5969]'}>
            {summary}
          </p>
          <p className="text-[10px] text-muted">{metaText}</p>
        </div>
      </button>

      {/* アクションボタン */}
      <div className="absolute inset-x-0 bottom-1.5 flex items-center gap-1 px-2">
        <ActButton label="元記事" variant="external" onClick={() => onOpenArticle(article.id)} />
        <ActButton label="関連トピック" wide onClick={() => onAction('topic_group_open', article.id)} />
        <ActButton label="共有" variant="share" onClick={() => onAction('share_open', article.id)} />
        <ActButton
          label={isSaved ? '保存済み' : '後で読む'}
          onClick={() => onAction(isSaved ? 'unsave' : 'save', article.id)}
        />
      </div>
    </article>
  )
}

function ActButton({
  label,
  variant = 'default',
  wide = false,
  onClick,
}: {
  label: string
  variant?: 'default' | 'share' | 'external'
  wide?: boolean
  onClick: () => void
}) {
  const isShare = variant === 'share'
  const isExternal = variant === 'external'
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px]"
      style={{
        height: 24,
        minWidth: wide ? 96 : 48,
        paddingLeft: 8,
        paddingRight: 8,
        background: isShare
          ? 'var(--color-orange)'
          : isExternal
            ? 'var(--color-accent-light)'
            : 'transparent',
        color: isShare
          ? '#fff'
          : isExternal
            ? 'var(--color-accent-darker)'
            : 'var(--color-ink)',
        fontWeight: isShare || isExternal ? 700 : 500,
        border: isShare
          ? '1px solid var(--color-accent-darker)'
          : isExternal
            ? '1px solid var(--color-accent-dark)'
            : '1px solid var(--color-second-orange)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
    >
      {label}
    </button>
  )
}
