'use client'

import { HomeArticleSection } from '@/components/home/HomeArticleSection'
import { HomeLaneSection } from '@/components/home/HomeLaneSection'
import type { UseHomeStateReturn } from '@/components/home/useHomeState'
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner'
import { Toolbar } from '@/components/toolbar/Toolbar'
import type { LaneKey } from '@/lib/db/types'

const TOPIC_CHIPS = ['all', 'llm', 'agent', 'voice', 'policy', 'safety', 'search', 'news'] as const
const LANE_ORDER: LaneKey[] = ['official', 'paper', 'news']
const LANE_LABELS: Record<LaneKey, string> = { official: 'OFFICIAL', paper: 'Paper', news: 'News' }
const LANE_TONES: Record<LaneKey, { bg: string; text: string }> = {
  official: { bg: '#dbeafe', text: '#1e40af' },
  paper: { bg: '#f3e8ff', text: '#7e22ce' },
  news: { bg: '#fee2e2', text: '#b91c1c' },
}

export function HomePrimaryColumn({ state }: { state: UseHomeStateReturn }) {
  return (
    <div className="flex-1 rounded-[14px] bg-white/10 p-2.5">
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#f4d9c1] bg-[#fff8ef] px-3 py-2 text-[11px] text-accent-darker">
        <span className="font-bold">Focus</span>
        <span>{state.homeData.message ?? '公開候補を表示中です。'}</span>
      </div>

      <SummaryModeToggle summaryMode={state.summaryMode} onChange={state.setSummaryMode} />

      <Toolbar period={state.period} onPeriodChange={state.setPeriod} />

      <div className="mt-2 flex flex-wrap gap-2 px-1">
        {TOPIC_CHIPS.map((topic) => (
          <button
            key={topic}
            type="button"
            className="rounded-full border px-3 py-1 text-[11px] font-bold"
            style={{
              background: state.activeTopic === topic ? 'var(--color-accent-lighter)' : '#fff',
              color: state.activeTopic === topic ? 'var(--color-accent-darker)' : 'var(--color-subtle)',
              borderColor: state.activeTopic === topic ? '#f4c29a' : 'rgba(0,0,0,0.05)',
            }}
            onClick={() => state.setActiveTopic(topic)}
          >
            {topic}
          </button>
        ))}
      </div>

      <HomeArticleSection
        id="section-random"
        title="ランダム表示"
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

      <HomeArticleSection
        id="section-latest"
        title="新着順"
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

      <HomeArticleSection
        id="section-unique"
        title="ユニーク順"
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

      <SectionLabel className="mt-6">ソースレーン</SectionLabel>
      <div className="flex flex-col gap-5">
        {LANE_ORDER.map((laneKey) => (
          <HomeLaneSection
            key={laneKey}
            laneKey={laneKey}
            label={LANE_LABELS[laneKey]}
            tone={LANE_TONES[laneKey]}
            articles={state.homeData.lanes[laneKey]}
            loading={state.homeData.loading}
            summaryMode={state.summaryMode}
          />
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-black/5 bg-white p-4 text-center">
        <p className="text-[13px] font-extrabold">AIダイジェスト</p>
        <p className="mt-1 text-[11px] text-muted">毎日のトピック要約をまとめて確認できます。</p>
        <a
          href="/digest"
          className="mt-3 inline-block rounded-xl px-5 py-2 text-[12px] font-bold text-white"
          style={{ background: 'var(--color-orange)' }}
        >
          ダイジェストを見る
        </a>
      </div>

      {state.searchDraft || state.searchState.articles.length > 0 ? (
        <div className="mt-5">
          <SectionLabel>検索結果</SectionLabel>
          <p className="mb-2 text-[11px] text-muted">
            {state.searchState.loading ? '検索中です。' : `${state.visibleSearchArticles.length} 件`}
          </p>
          <HomeArticleSection
            id="section-search"
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
        </div>
      ) : null}

      <div className="mt-4">
        <SectionLabel>PWA</SectionLabel>
        <PwaInstallBanner />
      </div>
    </div>
  )
}

function SummaryModeToggle({
  summaryMode,
  onChange,
}: {
  summaryMode: 100 | 200
  onChange: (mode: 100 | 200) => void
}) {
  return (
    <div className="mb-2 flex overflow-hidden rounded-lg border border-black/5" style={{ background: 'var(--color-card-second)' }}>
      {([100, 200] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className="flex-1 py-1.5 text-[11px] font-bold transition-all"
          style={{
            background: summaryMode === mode ? 'var(--color-accent-lighter)' : 'transparent',
            color: summaryMode === mode ? 'var(--color-accent-darker)' : 'var(--color-subtle)',
          }}
        >
          {mode}字モード
        </button>
      ))}
    </div>
  )
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`mb-2 inline-block rounded-md bg-[#f2dfd0] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#7a4525] ${className}`}
    >
      {children}
    </div>
  )
}
