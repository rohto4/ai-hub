'use client'

import { useMemo } from 'react'
import type { HomeData, SearchLoadState, TopicChip, UiArticle } from '@/components/home/home-state-shared'

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
}

type HomeActivitySnapshot = {
  impressionCountLastHour: number
  shareCountLastHour: number
}

export function useHomeDerivedArticles({
  activeTopic,
  homeData,
  searchState,
  homeStats,
  homeActivity,
}: {
  activeTopic: TopicChip
  homeData: HomeData
  searchState: SearchLoadState
  homeStats: HomeStatsSnapshot
  homeActivity: HomeActivitySnapshot
}) {
  const randomArticles = useMemo(
    () => filterByTopic(homeData.random, activeTopic),
    [activeTopic, homeData.random],
  )
  const latestArticles = useMemo(
    () => filterByTopic(homeData.latest, activeTopic),
    [activeTopic, homeData.latest],
  )
  const uniqueArticles = useMemo(
    () => filterByTopic(homeData.unique, activeTopic),
    [activeTopic, homeData.unique],
  )
  const visibleSearchArticles = useMemo(
    () => filterByTopic(searchState.articles, activeTopic),
    [activeTopic, searchState.articles],
  )

  const allArticles = useMemo(() => {
    const seen = new Set<string>()
    const articles: UiArticle[] = []

    for (const article of [
      ...homeData.random,
      ...homeData.latest,
      ...homeData.unique,
      ...homeData.lanes.official,
      ...homeData.lanes.paper,
      ...homeData.lanes.news,
      ...searchState.articles,
    ]) {
      if (seen.has(article.id)) continue
      seen.add(article.id)
      articles.push(article)
    }

    return articles
  }, [homeData, searchState.articles])

  const kpis = useMemo(
    () => [
      { label: '公開記事', value: homeStats.publishedTotal, group: 'blue' },
      { label: '新着記事', value: homeStats.publishedToday, group: 'blue' },
      { label: 'OFFICIAL', value: homeStats.officialCount, group: 'green' },
      { label: 'BLOG', value: homeStats.blogCount, group: 'green' },
      { label: 'NEWS', value: homeStats.newsCount, group: 'green' },
      { label: 'PAPER', value: homeStats.paperCount, group: 'green' },
      { label: '今月の閲覧数', value: homeActivity.impressionCountLastHour, group: 'red' },
      { label: '今月のシェア数', value: homeActivity.shareCountLastHour, group: 'red' },
    ],
    [homeActivity, homeStats],
  )

  return {
    randomArticles,
    latestArticles,
    uniqueArticles,
    visibleSearchArticles,
    allArticles,
    kpis,
  }
}

function filterByTopic(articles: UiArticle[], activeTopic: TopicChip): UiArticle[] {
  if (activeTopic === 'all') return articles
  return articles.filter((article) => article.sourceCategory === activeTopic)
}
