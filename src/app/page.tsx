'use client'

import { HomePrimaryColumn } from '@/components/home/HomePrimaryColumn'
import { HomeStatsBar } from '@/components/home/HomeStatsBar'
import { ShareModal } from '@/components/home/ShareModal'
import { SummaryModal } from '@/components/home/SummaryModal'
import { useHomeState } from '@/components/home/useHomeState'
import { Header } from '@/components/layout/Header'
import { RightSidebar } from '@/components/sidebar/RightSidebar'

export default function HomePage() {
  const state = useHomeState()

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Header
        searchValue={state.searchDraft}
        savedCount={state.savedArticleIds.length}
        onSearchChange={state.setSearchDraft}
        onSearchSubmit={state.handleSearchSubmit}
      />

      <div className="fixed bottom-0 left-0 top-[52px] hidden w-[120px] bg-dim-fg xl:block" />
      <div className="fixed bottom-0 right-0 top-[52px] hidden w-[120px] bg-dim-fg xl:block" />

      <main className="mx-auto max-w-[1440px] px-4 pb-[80px] pt-[68px] md:px-6 md:pb-10 xl:px-[120px]">
        <HomeStatsBar kpis={state.kpis} />

        <section className="mt-3 flex flex-col gap-3 xl:flex-row">
          <HomePrimaryColumn state={state} />

          <div className="hidden xl:block xl:shrink-0">
            <RightSidebar
              savedCount={state.savedArticleIds.length}
              likedCount={state.likedArticleIds.length}
              impressionCountLastHour={state.homeActivity.impressionCountLastHour}
              shareCountLastHour={state.homeActivity.shareCountLastHour}
            />
          </div>
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
