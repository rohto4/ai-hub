'use client'

import { useState } from 'react'
import { trackAction } from '@/lib/client/home'
import type { HomeData, SearchLoadState, TopicChip, UiArticle } from '@/components/home/home-state-shared'
import { useHomeArticleActions } from '@/components/home/useHomeArticleActions'
import { useHomeDerivedArticles } from '@/components/home/useHomeDerivedArticles'
import { useHomeShare } from '@/components/home/useHomeShare'

type HomeStatsSnapshot = {
  publishedTotal: number
  publishedToday: number
  topRatedCount: number
  officialCount: number
  blogCount: number
  paperCount: number
  newsCount: number
  agentCount: number
  voiceCount: number
  policyCount: number
  safetyCount: number
  searchCount: number
}

type HomeActivitySnapshot = {
  impressionCountLastHour: number
  shareCountLastHour: number
}

export function useHomeActions({
  homeData,
  searchState,
  homeStats,
  homeActivity,
  activeTopic,
  setActiveTopic,
}: {
  homeData: HomeData
  searchState: SearchLoadState
  homeStats: HomeStatsSnapshot
  homeActivity: HomeActivitySnapshot
  activeTopic: TopicChip
  setActiveTopic: (topic: TopicChip) => void
}) {
  const [searchDraft, setSearchDraft] = useState('')
  const [summaryMode, setSummaryMode] = useState<100 | 200>(100)
  const [summaryModalArticle, setSummaryModalArticle] = useState<UiArticle | null>(null)

  const shareState = useHomeShare()
  const baseDerived = useHomeDerivedArticles({
    activeTopic,
    homeData,
    searchState,
    homeStats,
    homeActivity,
  })
  const articleActions = useHomeArticleActions({
    allArticles: baseDerived.allArticles,
    onOpenSummary: setSummaryModalArticle,
    onOpenShare: shareState.setShareTarget,
  })
  const derived = useHomeDerivedArticles({
    activeTopic,
    homeData,
    searchState,
    homeStats,
    homeActivity,
  })

  function handleSearchSubmit(query: string) {
    if (!query) return
    void trackAction({ actionType: 'search', source: 'search', meta: { query } })
  }

  return {
    searchDraft,
    setSearchDraft,
    activeTopic,
    setActiveTopic,
    summaryMode,
    setSummaryMode,
    summaryModalArticle,
    setSummaryModalArticle,
    share: shareState.share,
    setShareTarget: shareState.setShareTarget,
    setShareIncludeAiTrendHub: shareState.setShareIncludeAiTrendHub,
    setShareIncludeTitle: shareState.setShareIncludeTitle,
    setShareIncludeSummary: shareState.setShareIncludeSummary,
    setShareTextContent: shareState.setShareTextContent,
    savedArticleIds: articleActions.savedArticleIds,
    likedArticleIds: articleActions.likedArticleIds,
    focusedArticleId: articleActions.focusedArticleId,
    randomArticles: derived.randomArticles,
    latestArticles: derived.latestArticles,
    uniqueArticles: derived.uniqueArticles,
    visibleSearchArticles: derived.visibleSearchArticles,
    kpis: derived.kpis,
    handleCardClick: articleActions.handleCardClick,
    handleOpenArticle: articleActions.handleOpenArticle,
    handleArticleAction: articleActions.handleArticleAction,
    handleSearchSubmit,
    handleShareCopyUrl: shareState.handleShareCopyUrl,
    handleShareCopyText: shareState.handleShareCopyText,
  }
}
