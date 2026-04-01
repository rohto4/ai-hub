'use client'

import { HomeArticleSection } from '@/components/home/HomeArticleSection'
import type { UseHomeStateReturn } from '@/components/home/useHomeState'
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner'
import type { LaneKey } from '@/lib/db/types'

const LANE_ORDER: LaneKey[] = ['official', 'paper', 'news']
const LANE_LABELS: Record<LaneKey, string> = {
  official: 'Official',
  paper: 'Paper',
  news: 'News',
}
const LANE_TONES: Record<LaneKey, { text: string }> = {
  official: { text: '#1974d2' },
  paper: { text: '#a21caf' },
  news: { text: '#d43d51' },
}

const SECTION_LINKS = [
  { href: '#section-random', label: 'ランダム' },
  { href: '#section-latest', label: '新着順' },
  { href: '#section-unique', label: 'ユニーク順' },
]

export function HomePrimaryColumn({ state }: { state: UseHomeStateReturn }) {
  const shouldShowSearch =
    Boolean(state.searchQuery) ||
    state.searchState.loading ||
    state.searchState.articles.length > 0 ||
    state.searchState.message !== null

  return (
    <div className="min-w-0 flex-1">
      <SectionNavigator activeHref="#section-random" emphasizeActive />

      {shouldShowSearch ? (
        <section id="section-search" className="mb-8 border border-black/6 bg-white/86 px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
          <SectionLabel>検索結果</SectionLabel>
          <p className="mb-3 text-[11px] text-[color:var(--color-muted)]">
            {state.searchState.loading
              ? `「${state.searchQuery}」を検索しています…`
              : state.searchState.message ?? `${state.visibleSearchArticles.length} 件`}
          </p>
          <HomeArticleSection
            id="section-search-results"
            title="検索結果"
            articles={state.visibleSearchArticles}
            loading={state.searchState.loading}
            summaryMode={state.summaryMode}
            focusedArticleId={state.focusedArticleId}
            savedArticleIds={state.savedArticleIds}
            likedArticleIds={state.likedArticleIds}
            onCardClick={state.handleCardClick}
            onAction={state.handleArticleAction}
            onOpenArticle={state.handleOpenArticle}
          />
        </section>
      ) : null}

      <HomeArticleSection
        id="section-random"
        title="ランダム"
        showHeading={false}
        articles={state.randomArticles}
        loading={state.homeData.loading}
        summaryMode={state.summaryMode}
        focusedArticleId={state.focusedArticleId}
        savedArticleIds={state.savedArticleIds}
        likedArticleIds={state.likedArticleIds}
        onCardClick={state.handleCardClick}
        onAction={state.handleArticleAction}
        onOpenArticle={state.handleOpenArticle}
      />

      <SectionNavigator activeHref="#section-latest" className="mt-8" />

      <HomeArticleSection
        id="section-latest"
        title="新着順"
        showHeading={false}
        articles={state.latestArticles}
        loading={state.homeData.loading}
        summaryMode={state.summaryMode}
        focusedArticleId={state.focusedArticleId}
        savedArticleIds={state.savedArticleIds}
        likedArticleIds={state.likedArticleIds}
        onCardClick={state.handleCardClick}
        onAction={state.handleArticleAction}
        onOpenArticle={state.handleOpenArticle}
      />

      <SectionNavigator activeHref="#section-unique" className="mt-8" />

      <HomeArticleSection
        id="section-unique"
        title="ユニーク順"
        showHeading={false}
        articles={state.uniqueArticles}
        loading={state.homeData.loading}
        summaryMode={state.summaryMode}
        focusedArticleId={state.focusedArticleId}
        savedArticleIds={state.savedArticleIds}
        likedArticleIds={state.likedArticleIds}
        onCardClick={state.handleCardClick}
        onAction={state.handleArticleAction}
        onOpenArticle={state.handleOpenArticle}
      />

      <SectionLabel className="mt-10">レーン</SectionLabel>
      <div className="flex flex-col gap-5">
        {LANE_ORDER.map((laneKey) => (
          <LanePreview
            key={laneKey}
            label={LANE_LABELS[laneKey]}
            tone={LANE_TONES[laneKey]}
            count={state.homeData.lanes[laneKey].length}
            href={`/category/${laneKey}`}
          />
        ))}
      </div>

      <div className="mt-8 hidden">
        <SectionLabel>PWA</SectionLabel>
        <PwaInstallBanner />
      </div>
    </div>
  )
}

function SectionNavigator({
  activeHref,
  emphasizeActive = false,
  className = '',
}: {
  activeHref: string
  emphasizeActive?: boolean
  className?: string
}) {
  return (
    <div className={`mb-5 flex flex-wrap items-center gap-2 border-b border-l-[3px] border-[color:var(--color-accent-darker)] pb-2 pl-3 ${className}`}>
      {SECTION_LINKS.map((link) => {
        const isActive = link.href === activeHref
        return (
          <a
            key={link.href}
            href={link.href}
            className="px-4 py-2 font-bold transition"
            style={{
              background: isActive ? 'var(--color-accent-light)' : 'transparent',
              color: isActive ? 'var(--color-accent-darker)' : 'var(--color-accent-dark)',
              borderRadius: isActive ? 10 : 0,
              fontSize: isActive && emphasizeActive ? 16 : isActive ? 13 : 12,
              letterSpacing: isActive && emphasizeActive ? '-0.04em' : '0',
            }}
          >
            {link.label}
          </a>
        )
      })}
    </div>
  )
}

function LanePreview({
  label,
  tone,
  count,
  href,
}: {
  label: string
  tone: { text: string }
  count: number
  href: string
}) {
  return (
    <a href={href} className="border-b border-black/8 pb-2 text-sm font-bold text-[color:var(--color-ink)]">
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: tone.text }} />
        {label}
      </span>
      <span className="ml-3 text-[11px] text-[color:var(--color-muted)]">{count}件</span>
    </a>
  )
}

function SectionLabel({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`mb-3 text-sm font-black tracking-[-0.04em] text-[color:var(--color-ink)] ${className}`}>
      {children}
    </div>
  )
}
