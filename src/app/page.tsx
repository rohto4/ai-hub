'use client'

import { HomeCategoryRail } from '@/components/home/HomeCategoryRail'
import { HomePrimaryColumn } from '@/components/home/HomePrimaryColumn'
import { HomeStatsBar } from '@/components/home/HomeStatsBar'
import { ShareModal } from '@/components/home/ShareModal'
import { SummaryModal } from '@/components/home/SummaryModal'
import { useHomeState } from '@/components/home/useHomeState'
import { Header } from '@/components/layout/Header'

export default function HomePage() {
  const state = useHomeState()

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Header
        searchValue={state.searchDraft}
        savedCount={state.savedArticleIds.length}
        period={state.period}
        summaryMode={state.summaryMode}
        onSearchChange={state.setSearchDraft}
        onSearchSubmit={state.handleSearchSubmit}
        onPeriodChange={state.setPeriod}
        onSummaryModeChange={state.setSummaryMode}
      />

      <main className="mx-auto max-w-[1440px] px-4 pb-[80px] pt-[68px] md:px-6 md:pb-10 xl:px-[120px]">
        <HomeStatsBar kpis={state.kpis} />

        <section className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-start">
          <HomeCategoryRail
            activeTopic={state.activeTopic}
            selectedTagKeys={state.selectedTagKeys}
            focusTags={state.homeData.focusTags}
            unreadCount={state.homeStats.publishedToday}
            likedCount={state.likedArticleIds.length}
            savedCount={state.savedArticleIds.length}
            onTagToggle={state.toggleSelectedTagKey}
          />

          <HomePrimaryColumn state={state} />
        </section>
      </main>

      {state.summaryModalArticle ? (
        <SummaryModal
          article={state.summaryModalArticle}
          onClose={() => state.setSummaryModalArticle(null)}
          onOpenArticle={state.handleOpenArticle}
        />
      ) : null}

      {state.share.target ? (
        <ShareModal
          share={state.share}
          onClose={() => state.setShareTarget(null)}
          onTextChange={state.setShareTextContent}
          onToggleAiTrendHub={state.setShareIncludeAiTrendHub}
          onToggleTitle={state.setShareIncludeTitle}
          onToggleSummary={state.setShareIncludeSummary}
          onCopyUrl={state.handleShareCopyUrl}
          onCopyText={state.handleShareCopyText}
        />
      ) : null}
    </div>
  )
}
