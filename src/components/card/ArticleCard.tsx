'use client'

import Link from 'next/link'
import { ArticleTagGroups } from '@/components/shared/ArticleTagGroups'
import { ArticleThumbnail } from '@/components/shared/ArticleThumbnail'
import type { ActionType, Article } from '@/lib/db/types'
import { getArticleCategoryLabel, getRelatedTopicLink } from '@/lib/site/navigation'

interface Props {
  article: Article & { score?: number }
  summaryMode: 100 | 200
  isFocused?: boolean
  isSaved?: boolean
  isLiked?: boolean
  onCardClick: (articleId: string) => void
  onOpenArticle: (articleId: string) => void
  onAction: (type: ActionType, articleId: string) => void
}

const languageLabel: Record<NonNullable<Article['content_language']>, string> = {
  ja: 'JP',
  en: 'EN',
}

const CARD_OUTER_GAP = 4

export function ArticleCard({
  article,
  summaryMode,
  isFocused = false,
  isSaved = false,
  isLiked = false,
  onCardClick,
  onOpenArticle,
  onAction,
}: Props) {
  const numericScore = article.score != null && Number.isFinite(Number(article.score)) ? Number(article.score) : undefined
  const summary =
    (summaryMode === 200 ? article.summary_200 : article.summary_100) ??
    article.summary_100 ??
    '要約を準備中です。'
  const isLongSummary = summaryMode === 200
  const categoryLabel = getArticleCategoryLabel({
    sourceType: article.source_type,
    sourceCategory: article.sourceCategory,
    primaryTagKeys: article.primaryTags.map((tag) => tag.tagKey),
    adjacentTagKeys: article.adjacentTags.map((tag) => tag.tagKey),
  })
  const relatedTopicLink = getRelatedTopicLink({
    sourceType: article.source_type,
    sourceCategory: article.sourceCategory,
    primaryTagKeys: article.primaryTags.map((tag) => tag.tagKey),
    adjacentTagKeys: article.adjacentTags.map((tag) => tag.tagKey),
  })

  return (
    <article
      id={`article-card-${article.id}`}
      className="flex flex-col border bg-[color:var(--color-card-second)] transition-transform duration-150 hover:-translate-y-[3px]"
      style={{
        height: isLongSummary ? 296 : 215,
        borderColor: isFocused ? '#d7b898' : '#e8d9cb',
        boxShadow: '0 10px 22px rgba(78, 52, 26, 0.08), 0 1px 0 rgba(255,255,255,0.72) inset',
        borderRadius: 3,
        fontFamily: 'JetBrains Mono, var(--font-family-base)',
      }}
    >
      <div
        className="border bg-[color:var(--color-card)]"
        style={{
          height: isLongSummary ? 237 : 168,
          marginTop: CARD_OUTER_GAP,
          marginRight: CARD_OUTER_GAP,
          marginBottom: CARD_OUTER_GAP,
          marginLeft: CARD_OUTER_GAP,
          borderColor: '#f0e5da',
          padding: '3.4% 1.7% 2.8%',
        }}
      >
        <div
          className="grid h-full items-start"
          style={{
            gridTemplateColumns: '13.1% minmax(0, 1fr)',
            columnGap: '4.2%',
          }}
        >
          <div className="flex h-full flex-col items-center text-center">
            <button
              type="button"
              className="block w-full"
              style={{
                marginTop: isLongSummary ? '20%' : '8%',
              }}
              onClick={() => onCardClick(article.id)}
              aria-label="記事の概要を開く"
            >
              <ArticleThumbnail
                articleId={`${article.id}-thumb`}
                sourceType={article.source_type}
                thumbnailUrl={article.thumbnail_url}
                thumbnailEmoji={article.thumbnail_emoji}
                thumbnailBgTheme={article.thumbnail_bg_theme}
                className="mx-auto aspect-[52/92] w-full max-w-[52px] overflow-hidden border"
                badgeLabel={undefined}
                badgeClassName=""
                emojiClassName="text-[28px]"
              />
            </button>
            {categoryLabel ? (
              <div className="mt-[6px] text-center text-[9px] font-bold leading-none text-black">
                {categoryLabel}
              </div>
            ) : null}
          </div>

          <div className="min-w-0">
            <button
              type="button"
              className="block w-full text-left"
              onClick={() => onCardClick(article.id)}
              aria-label="記事の概要を開く"
            >
              <div className="line-clamp-2 text-[14px] font-bold leading-[1.45] text-[color:var(--color-ink)]">
                {article.title}
              </div>
            </button>

            <div className="mt-[9px] flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5 text-[11px] font-bold leading-[1.45] text-[#8d8b90]">
                  {categoryLabel ? <span>#{categoryLabel}</span> : null}
                  {article.content_language ? <span>#{languageLabel[article.content_language]}</span> : null}
                </div>
              </div>
              <div className="shrink-0 pl-2 text-[11px] font-bold text-[#8d8b90]">
                {numericScore != null ? `Score ${numericScore.toFixed(1)}` : 'Score --'}
              </div>
            </div>

            <ArticleTagGroups
              primaryTags={article.primaryTags.slice(0, 2)}
              adjacentTags={article.adjacentTags.slice(0, 1)}
              compact
              className="mt-[8px]"
            />

            <div
              className={
                isLongSummary
                  ? 'mt-[10px] line-clamp-[7] whitespace-pre-wrap text-[12px] leading-[1.55] text-[#625f68]'
                  : 'mt-[10px] line-clamp-[4] whitespace-pre-wrap text-[12px] leading-[1.55] text-[#625f68]'
              }
            >
              {summary}
            </div>
          </div>
        </div>
      </div>

      <div
        className="grid items-center"
        style={{
          height: isLongSummary ? 47 : 35,
          marginRight: CARD_OUTER_GAP,
          marginBottom: CARD_OUTER_GAP,
          marginLeft: CARD_OUTER_GAP,
          gridTemplateColumns: '24% 20% 20% 32.4%',
          columnGap: '1.2%',
        }}
      >
        {relatedTopicLink ? (
          <ActionLink
            href={relatedTopicLink.href}
            label={relatedTopicLink.label}
            variant="topic"
            onClick={() => onAction('topic_group_open', article.id)}
          />
        ) : (
          <ActionButton
            label="関連トピック"
            variant="topic"
            onClick={() => onAction('topic_group_open', article.id)}
          />
        )}
        <ActionButton
          label={isSaved ? '保存済み' : '後で読む'}
          onClick={() => onAction(isSaved ? 'unsave' : 'save', article.id)}
        />
        <ActionButton
          label={isLiked ? '閲覧済み' : '保存'}
          onClick={() => onAction(isLiked ? 'unlike' : 'like', article.id)}
        />
        <ActionButton
          label="共有"
          variant="share"
          onClick={() => onAction('share_open', article.id)}
        />
      </div>

      <button type="button" className="sr-only" onClick={() => onOpenArticle(article.id)}>
        元記事を開く
      </button>
    </article>
  )
}

function ActionButton({
  label,
  variant = 'default',
  onClick,
}: {
  label: string
  variant?: 'default' | 'share' | 'topic'
  onClick: () => void
}) {
  const isShare = variant === 'share'
  const isTopic = variant === 'topic'

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 min-w-0 items-center justify-center border px-2 text-[11px] font-bold transition-colors"
      style={{
        borderColor: isTopic ? 'transparent' : isShare ? '#e17e00' : '#d7b898',
        background: isTopic ? 'transparent' : isShare ? '#f59313' : '#fff8f1',
        color: isShare ? '#ffffff' : '#a35b2e',
        borderLeft: isTopic ? '3px solid #c77719' : undefined,
        boxShadow: 'none',
        fontFamily: 'JetBrains Mono, var(--font-family-base)',
      }}
    >
      <span className="truncate">{label}</span>
    </button>
  )
}

function ActionLink({
  href,
  label,
  variant = 'default',
  onClick,
}: {
  href: string
  label: string
  variant?: 'default' | 'share' | 'topic'
  onClick?: () => void
}) {
  const isShare = variant === 'share'
  const isTopic = variant === 'topic'

  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex h-7 min-w-0 items-center justify-center border px-2 text-[11px] font-bold transition-colors"
      style={{
        borderColor: isTopic ? 'transparent' : isShare ? '#e17e00' : '#d7b898',
        background: isTopic ? 'transparent' : isShare ? '#f59313' : '#fff8f1',
        color: isShare ? '#ffffff' : '#a35b2e',
        borderLeft: isTopic ? '3px solid #c77719' : undefined,
        boxShadow: 'none',
        fontFamily: 'JetBrains Mono, var(--font-family-base)',
      }}
    >
      <span className="truncate">{label}</span>
    </Link>
  )
}
