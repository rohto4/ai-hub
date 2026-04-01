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
    <aside className="hidden xl:block xl:w-[243px] xl:shrink-0">
      <div
        className="border bg-[color:var(--color-card-second)] px-[10px] py-[10px]"
        style={{
          borderColor: '#e8d9cb',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          fontFamily: 'JetBrains Mono, var(--font-family-base)',
        }}
      >
        <SectionTitle>カテゴリ</SectionTitle>
        <div className="flex flex-col">
          {SITE_CATEGORIES.map((category) => {
            const isActive =
              category.kind === 'source-category' && activeTopic !== 'all' && activeTopic === category.queryValue

            return (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className="group relative block h-[58px] overflow-hidden border"
                style={{
                  marginTop: '-1px',
                  borderColor: '#ece2d9',
                  background: '#fff8f1',
                }}
              >
                <span
                  className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(90deg, ${category.softColor}, rgba(255,248,241,0) 78%)`,
                    boxShadow: `inset 0 0 24px ${category.softColor}`,
                  }}
                />
                {isActive ? (
                  <span
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(90deg, ${category.softColor}, rgba(255,248,241,0) 78%)`,
                      boxShadow: `inset 0 0 20px ${category.softColor}`,
                    }}
                  />
                ) : null}
                <span
                  className="absolute inset-y-0 left-0 w-[14px]"
                  style={{
                    background: `linear-gradient(180deg, ${category.solidColor}, ${category.softColor})`,
                  }}
                />
                <span className="absolute left-[26px] top-[21px] text-[12px] font-bold tracking-[-0.02em] text-[color:var(--color-ink)]">
                  {category.label}
                </span>
              </Link>
            )
          })}
        </div>

        <SectionDivider />

        <SectionTitle>注目タグ</SectionTitle>
        <div className="flex flex-wrap gap-x-[6px] gap-y-[8px]">
          {focusTags.slice(0, 10).map((tag) => {
            const isSelected = selectedTagKeys.includes(tag.tagKey)
            return (
              <button
                key={tag.tagKey}
                type="button"
                onClick={() => onTagToggle(tag.tagKey)}
                className="inline-flex h-7 items-center justify-center border px-[10px] text-[11px] font-bold transition-colors"
                style={{
                  borderColor: '#e8d9cb',
                  background: isSelected ? '#fff1e4' : '#fff8f1',
                  color: isSelected ? '#a35b2e' : '#625f68',
                }}
              >
                {tag.displayName}
              </button>
            )
          })}
        </div>

        <SectionDivider />

        <SectionTitle>未読管理</SectionTitle>
        <div>
          <MetricRow label="未読" value={unreadCount} />
          <MetricRow label="高評価" value={likedCount} />
          <MetricRow label="後で読む" value={savedCount} />
        </div>
      </div>
    </aside>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[10px] text-[14px] font-bold tracking-[-0.02em] text-[color:var(--color-ink)]">
      {children}
    </div>
  )
}

function SectionDivider() {
  return <div className="my-[16px] border-t" style={{ borderColor: '#ece2d9' }} />
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="relative h-10 border-r border-b text-[12px] font-bold"
      style={{
        borderColor: '#e8d9cb',
        color: '#a35b2e',
      }}
    >
      <span className="absolute left-[20px] top-[12px]">{label}</span>
      <span className="absolute right-[14px] top-[12px] text-[12px] text-[color:var(--color-orange)]">
        {value}
      </span>
    </div>
  )
}
