'use client'

import { useEffect, useState } from 'react'
import type { HomeActivity, HomeStats, RankPeriod } from '@/lib/db/types'
import {
  HomeData,
  SearchLoadState,
  fetchJson,
  initialHomeActivity,
  initialHomeData,
  initialHomeStats,
  initialSearchState,
  toUiArticles,
  emptyLanes,
  HomeLoadResponse,
  SearchLoadResponse,
  TopicChip,
} from '@/components/home/home-state-shared'

export function useHomeData(period: RankPeriod, searchQuery: string, activeTopic: TopicChip) {
  const [homeData, setHomeData] = useState<HomeData>(initialHomeData)
  const [homeStats, setHomeStats] = useState<HomeStats>(initialHomeStats)
  const [homeActivity, setHomeActivity] = useState<HomeActivity>(initialHomeActivity)
  const [searchState, setSearchState] = useState<SearchLoadState>(initialSearchState)

  useEffect(() => {
    let ignore = false

    async function loadHome() {
      setHomeData((current) => ({ ...current, loading: true, message: 'ホームを読み込み中です。' }))
      try {
        const response = await fetchJson<HomeLoadResponse>(`/api/home?period=${period}&limit=20&topic=${activeTopic}`)
        if (ignore) return

        setHomeData({
          random: toUiArticles(response.random as HomeData['random']),
          latest: toUiArticles(response.latest as HomeData['latest']),
          unique: toUiArticles(response.unique as HomeData['unique']),
          lanes: {
            official: toUiArticles(response.lanes.official as HomeData['lanes']['official']),
            paper: toUiArticles(response.lanes.paper as HomeData['lanes']['paper']),
            news: toUiArticles(response.lanes.news as HomeData['lanes']['news']),
          },
          loading: false,
          message: `${response.random.length} 件表示中です。`,
        })
        setHomeStats(response.stats)
        setHomeActivity(response.activity)
      } catch (error) {
        if (ignore) return
        const message = error instanceof Error ? error.message : 'ホームの取得に失敗しました。'
        setHomeData({ random: [], latest: [], unique: [], lanes: emptyLanes, loading: false, message })
      }
    }

    void loadHome()
    return () => {
      ignore = true
    }
  }, [period, activeTopic])

  useEffect(() => {
    let ignore = false

    async function loadSearch() {
      if (!searchQuery) {
        setSearchState(initialSearchState)
        return
      }

      setSearchState({ articles: [], loading: true, message: `「${searchQuery}」を検索中です。` })

      try {
        const response = await fetchJson<SearchLoadResponse>(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=12`)
        if (ignore) return
        setSearchState({
          articles: toUiArticles(response.articles as SearchLoadState['articles']),
          loading: false,
          message: `${response.total} 件ヒットしました。`,
        })
      } catch (error) {
        if (ignore) return
        setSearchState({
          articles: [],
          loading: false,
          message: error instanceof Error ? error.message : '検索に失敗しました。',
        })
      }
    }

    void loadSearch()
    return () => {
      ignore = true
    }
  }, [searchQuery])

  return { homeData, homeStats, homeActivity, searchState }
}
