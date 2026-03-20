'use client'

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

const LANE_EMOJIS: Record<string, string[]> = {
  official: ['🤖', '💡', '🔬', '⚡', '🌐', '🔮', '📡', '⚙️', '🛰️', '🔵'],
  alerts: ['🔔', '📢', '📣', '🚨', '🔍', '🚀', '🌟', '🔥', '💬', '⚡'],
  blog: ['✍️', '💭', '🧩', '🎯', '🏆', '💫', '🎨', '🔑', '🌱', '🖊️'],
  paper: ['📄', '🔬', '🧬', '📊', '🔭', '🎓', '🧪', '📐', '🔢', '🌍'],
  news: ['📰', '🗞️', '📡', '🌍', '💼', '📈', '🎙️', '📻', '🏛️', '🌐'],
  video: ['🎬', '🎥', '📹', '🎞️', '🎦', '🎭', '📺', '🖥️', '🎪', '🎬'],
}

const BLAND_EMOJI = new Set(['🧠', '📝', ''])

function resolveEmoji(article: { id: string; source_type: string; thumbnail_emoji?: string | null }): string {
  if (article.thumbnail_emoji && !BLAND_EMOJI.has(article.thumbnail_emoji)) {
    return article.thumbnail_emoji
  }
  const emojis = LANE_EMOJIS[article.source_type] ?? ['📰', '🔬', '💡', '🌐', '🔔']
  const hash = article.id.split('').reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) >>> 0), 0)
  return emojis[hash % emojis.length]
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
    article.genre,
    numericScore != null ? `Score ${numericScore.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join(' / ')

  return (
    <article
      id={`article-card-${article.id}`}
      className="relative overflow-hidden rounded-xl border bg-card-second"
      style={{
        minHeight: 180,
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
        className="flex w-full gap-2.5 p-2.5 pb-12 text-left"
        onClick={() => onCardClick(article.id)}
      >
        {/* サムネイル (小型) */}
        <div
          className="relative mt-0.5 h-[72px] w-[56px] shrink-0 overflow-hidden rounded-lg"
          style={{ background: 'linear-gradient(145deg, #ffe8d6, #ffd8bd)' }}
        >
          {article.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[28px]">
              {resolveEmoji(article)}
            </div>
          )}
          <span className="absolute bottom-1 right-1 rounded-sm bg-black/30 px-0.5 text-[7px] font-semibold text-white">
            {sourceLabel[article.source_type]}
          </span>
        </div>

        {/* テキスト */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6 pt-0.5">
          <p className="line-clamp-2 text-[13px] font-extrabold leading-[1.4] text-ink">
            {article.title}
          </p>
          <p className="line-clamp-3 text-[11px] leading-[1.6] text-[#4f5969]">
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
      className="rounded-full text-[10px]"
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
