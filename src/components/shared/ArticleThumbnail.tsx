import type { CSSProperties } from 'react'
import { resolveThumbnailEmoji } from '@/lib/publish/thumbnail-emoji'

type Props = {
  articleId: string
  sourceType: 'official' | 'blog' | 'news' | 'video' | 'alerts' | 'paper'
  thumbnailUrl: string | null
  thumbnailEmoji: string | null
  className: string
  emojiClassName?: string
  badgeLabel?: string
  badgeClassName?: string
  backgroundStyle?: CSSProperties
}

const DEFAULT_BACKGROUND: CSSProperties = {
  background: 'linear-gradient(145deg, #ffe8d6, #ffd8bd)',
}

export function ArticleThumbnail({
  articleId,
  sourceType,
  thumbnailUrl,
  thumbnailEmoji,
  className,
  emojiClassName = 'text-[28px]',
  badgeLabel,
  badgeClassName = 'absolute bottom-1 right-1 rounded-sm bg-black/30 px-0.5 text-[7px] font-semibold text-white',
  backgroundStyle = DEFAULT_BACKGROUND,
}: Props) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={backgroundStyle}>
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className={`absolute inset-0 flex items-center justify-center ${emojiClassName}`}>
          {resolveThumbnailEmoji({
            id: articleId,
            sourceType,
            thumbnailEmoji,
          })}
        </div>
      )}
      {badgeLabel ? <span className={badgeClassName}>{badgeLabel}</span> : null}
    </div>
  )
}
