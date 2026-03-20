'use client'

import { useState } from 'react'
import type { ActionType, HomeActivity, HomeStats, RankPeriod } from '@/lib/db/types'
import type { HomeData, SearchLoadState, ShareState, TopicChip, UiArticle } from '@/components/home/home-state-shared'
import { useHomeActions } from '@/components/home/useHomeActions'
import { useHomeData } from '@/components/home/useHomeData'

export interface UseHomeStateReturn {
  homeData: HomeData
  homeStats: HomeStats
  homeActivity: HomeActivity
  searchState: SearchLoadState
  kpis: { label: string; value: string | number; group: string }[]
  randomArticles: UiArticle[]
  latestArticles: UiArticle[]
  uniqueArticles: UiArticle[]
  visibleSearchArticles: UiArticle[]
  period: RankPeriod
  activeTopic: TopicChip
  summaryMode: 100 | 200
  summaryModalArticle: UiArticle | null
  share: ShareState
  savedArticleIds: string[]
  likedArticleIds: string[]
  focusedArticleId: string | null
  searchDraft: string
  setPeriod: (period: RankPeriod) => void
  setActiveTopic: (topic: TopicChip) => void
  setSummaryMode: (mode: 100 | 200) => void
  setSummaryModalArticle: (article: UiArticle | null) => void
  setShareTarget: (article: UiArticle | null) => void
  setShareIncludeAiTrendHub: (value: boolean) => void
  setShareIncludeTitle: (value: boolean) => void
  setShareIncludeSummary: (value: boolean) => void
  setSearchDraft: (value: string) => void
  setShareTextContent: (value: string) => void
  handleCardClick: (articleId: string) => void
  handleOpenArticle: (articleId: string) => void
  handleArticleAction: (type: ActionType, articleId: string) => void
  handleSearchSubmit: () => void
  handleShareCopyUrl: () => void
  handleShareCopyText: () => void
}

export function useHomeState(): UseHomeStateReturn {
  const [period, setPeriod] = useState<RankPeriod>('24h')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTopic, setActiveTopic] = useState<TopicChip>('all')
  const { homeData, homeStats, homeActivity, searchState } = useHomeData(period, searchQuery, activeTopic)
  const actions = useHomeActions({ homeData, searchState, homeStats, homeActivity, activeTopic, setActiveTopic })

  return {
    homeData,
    homeStats,
    homeActivity,
    searchState,
    kpis: actions.kpis,
    randomArticles: actions.randomArticles,
    latestArticles: actions.latestArticles,
    uniqueArticles: actions.uniqueArticles,
    visibleSearchArticles: actions.visibleSearchArticles,
    period,
    activeTopic,
    summaryMode: actions.summaryMode,
    summaryModalArticle: actions.summaryModalArticle,
    share: actions.share,
    savedArticleIds: actions.savedArticleIds,
    likedArticleIds: actions.likedArticleIds,
    focusedArticleId: actions.focusedArticleId,
    searchDraft: actions.searchDraft,
    setPeriod,
    setActiveTopic,
    setSummaryMode: actions.setSummaryMode,
    setSummaryModalArticle: actions.setSummaryModalArticle,
    setShareTarget: actions.setShareTarget,
    setShareIncludeAiTrendHub: actions.setShareIncludeAiTrendHub,
    setShareIncludeTitle: actions.setShareIncludeTitle,
    setShareIncludeSummary: actions.setShareIncludeSummary,
    setSearchDraft: actions.setSearchDraft,
    setShareTextContent: actions.setShareTextContent,
    handleCardClick: actions.handleCardClick,
    handleOpenArticle: actions.handleOpenArticle,
    handleArticleAction: actions.handleArticleAction,
    handleSearchSubmit: () => {
      const query = actions.searchDraft.trim()
      setSearchQuery(query)
      actions.handleSearchSubmit(query)
    },
    handleShareCopyUrl: actions.handleShareCopyUrl,
    handleShareCopyText: actions.handleShareCopyText,
  }
}
