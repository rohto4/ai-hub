import Link from 'next/link'
import type { MouseEventHandler } from 'react'

type TagItem = {
  tagKey: string
  displayName: string
}

function TagRow({
  label,
  tags,
  tone,
  compact = false,
  onLinkClick,
}: {
  label: string
  tags: TagItem[]
  tone: 'primary' | 'adjacent'
  compact?: boolean
  onLinkClick?: MouseEventHandler<HTMLAnchorElement>
}) {
  const chipClassName =
    tone === 'adjacent'
      ? 'bg-[#f6f0ea] text-[#8b5e3c]'
      : 'bg-[color:var(--color-panel-strong)] text-[color:var(--color-accent-darker)]'
  const rowLabelClassName = compact
    ? 'min-w-[42px] pt-1 text-[10px] font-bold tracking-[0.08em] text-[color:var(--color-muted)]'
    : 'min-w-[52px] pt-1 text-[10px] font-bold tracking-[0.08em] text-[color:var(--color-muted)]'
  const chipSizeClassName = compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px]'
  const prefix = tone === 'adjacent' ? '+' : '#'

  return (
    <div className="flex items-start gap-2">
      <span className={rowLabelClassName}>{label}</span>
      <div className="flex flex-1 flex-wrap gap-2">
        {tags.map((tag) => (
          <Link
            key={`${tone}-${tag.tagKey}`}
            href={`/tags/${tag.tagKey}`}
            onClick={onLinkClick}
            className={`rounded-full font-bold ${chipClassName} ${chipSizeClassName}`}
          >
            {prefix} {tag.displayName}
          </Link>
        ))}
      </div>
    </div>
  )
}

export function ArticleTagGroups({
  primaryTags,
  adjacentTags,
  compact = false,
  className = '',
  onLinkClick,
}: {
  primaryTags: TagItem[]
  adjacentTags: TagItem[]
  compact?: boolean
  className?: string
  onLinkClick?: MouseEventHandler<HTMLAnchorElement>
}) {
  if (primaryTags.length === 0 && adjacentTags.length === 0) {
    return null
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      {primaryTags.length > 0 ? (
        <TagRow
          label="主タグ"
          tags={primaryTags}
          tone="primary"
          compact={compact}
          onLinkClick={onLinkClick}
        />
      ) : null}
      {adjacentTags.length > 0 ? (
        <TagRow
          label="周辺"
          tags={adjacentTags}
          tone="adjacent"
          compact={compact}
          onLinkClick={onLinkClick}
        />
      ) : null}
    </div>
  )
}
