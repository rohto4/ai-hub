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
  savedCount,
}: {
  activeTopic: TopicChip
  homeData: HomeData
  searchState: SearchLoadState
  homeStats: HomeStatsSnapshot
  homeActivity: HomeActivitySnapshot
  savedCount: number
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
      { label: '公開記事数', value: homeStats.publishedTotal, group: 'total' },
      { label: '本日の新着', value: homeStats.publishedToday, group: 'total' },
      { label: '注目記事', value: homeStats.topRatedCount, group: 'total' },
      { label: '保存済み', value: savedCount, group: 'total' },
      { label: 'OFFICIAL', value: homeStats.officialCount, group: 'lane' },
      { label: 'BLOG', value: homeStats.blogCount, group: 'lane' },
      { label: 'PAPER', value: homeStats.paperCount, group: 'lane' },
      { label: 'NEWS', value: homeStats.newsCount, group: 'lane' },
      { label: 'Agent', value: homeStats.agentCount, group: 'genre' },
      { label: 'Voice', value: homeStats.voiceCount, group: 'genre' },
      { label: 'Policy', value: homeStats.policyCount, group: 'genre' },
      { label: 'Safety', value: homeStats.safetyCount, group: 'genre' },
      { label: '1h 閲覧', value: homeActivity.impressionCountLastHour, group: 'activity' },
      { label: '1h シェア', value: homeActivity.shareCountLastHour, group: 'activity' },
    ],
    [homeActivity, homeStats, savedCount],
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
