'use client'

import Link from 'next/link'
import type { PublicTagSummary } from '@/lib/db/public-shared'
import type { SourceCategory } from '@/lib/db/types'
import { SITE_CATEGORIES } from '@/lib/site/navigation'

type ActiveTopic = 'all' | SourceCategory

export function HomeCategoryRail({
  activeTopic,
  selectedTagKeys,
  focusTags,
  unreadCount,
  likedCount,
  savedCount,
  onTagToggle,
}: {
  activeTopic: ActiveTopic
  selectedTagKeys: string[]
  focusTags: PublicTagSummary[]
  unreadCount: number
  likedCount: number
  savedCount: number
  onTagToggle: (tagKey: string) => void
}) {
  return (
    <aside className="hidden xl:block xl:w-[220px] xl:shrink-0">
      <div className="bg-[color:var(--color-card-second)] px-[10px] py-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <SectionTitle>カテゴリ</SectionTitle>
        <div className="flex flex-col gap-1">
          {SITE_CATEGORIES.map((category) => {
            const isActive =
              category.kind === 'source-category' && activeTopic !== 'all' && activeTopic === category.queryValue

            return (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className="group relative flex min-h-[42px] items-center overflow-hidden border-b border-black/6 px-3 text-[12px] font-semibold transition-[color,box-shadow,transform] duration-200"
                style={{
                  background: isActive ? `linear-gradient(90deg, ${category.softColor}, transparent 78%)` : 'transparent',
                  color: isActive ? 'var(--color-accent-darker)' : 'var(--color-ink)',
                  boxShadow: isActive ? `inset 0 0 22px ${category.softColor}` : 'inset 0 0 0 transparent',
                }}
              >
                <span
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(90deg, ${category.softColor}, transparent 78%)`,
                    boxShadow: `inset 0 0 26px ${category.softColor}`,
                  }}
                />
                <span
                  className="absolute inset-y-0 left-0 w-3"
                  style={{
                    background: `linear-gradient(180deg, ${category.solidColor}, ${category.softColor})`,
                  }}
                />
                <span className="relative z-10 pl-4">{category.label}</span>
              </Link>
            )
          })}
        </div>

        <SectionDivider />

        <SectionTitle>注目タグ</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {focusTags.slice(0, 10).map((tag) => {
            const isSelected = selectedTagKeys.includes(tag.tagKey)
            return (
              <button
                key={tag.tagKey}
                type="button"
                onClick={() => onTagToggle(tag.tagKey)}
                className="border px-2 py-1 text-[11px] font-bold transition-colors"
                style={{
                  borderColor: 'rgba(0,0,0,0.06)',
                  background: isSelected ? 'var(--color-accent-lighter)' : 'transparent',
                  color: isSelected ? 'var(--color-accent-darker)' : 'var(--color-subtle)',
                }}
              >
                {tag.displayName}
              </button>
            )
          })}
        </div>

        <SectionDivider />

        <SectionTitle>未読管理</SectionTitle>
        <div className="flex flex-col gap-1">
          <MetricRow label="未読" value={unreadCount} />
          <MetricRow label="高評価" value={likedCount} />
          <MetricRow label="後で読む" value={savedCount} />
        </div>
      </div>
    </aside>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-[6px] text-[13px] font-extrabold text-[color:var(--color-ink)]">{children}</div>
}

function SectionDivider() {
  return <div className="my-[10px] border-t border-black/5" />
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-black/6 px-2 py-2 text-[12px] text-[color:var(--color-accent-darker)]">
      <span>{label}</span>
      <span className="text-[14px] font-bold text-[color:var(--color-orange)]">{value}</span>
    </div>
  )
}
