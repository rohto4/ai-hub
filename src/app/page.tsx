'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArticleCard } from '@/components/card/ArticleCard'
import { ArticleRow } from '@/components/card/ArticleRow'
import { Header } from '@/components/layout/Header'
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner'
import { RightSidebar } from '@/components/sidebar/RightSidebar'
import { Toolbar } from '@/components/toolbar/Toolbar'
import {
  consumeReturnFocusArticleId,
  getLikedArticleIds,
  getOrCreateSessionId,
  getSavedArticleIds,
  setReturnFocusArticleId,
  toggleLikedArticleId,
  toggleSavedArticleId,
  trackAction,
} from '@/lib/client/home'
import type {
  ActionType,
  Article,
  ArticleWithScore,
  ContentLaneKey,
  HomeActivity,
  HomeResponse,
  HomeStats,
  RankPeriod,
  SearchResponse,
} from '@/lib/db/types'

type UiArticle = Article & { score?: number }
type UiContentLanes = Record<ContentLaneKey, UiArticle[]>

type HomeData = {
  random: UiArticle[]
  latest: UiArticle[]
  unique: UiArticle[]
  lanes: UiContentLanes
  loading: boolean
  message: string | null
}

type SearchLoadState = {
  articles: UiArticle[]
  loading: boolean
  message: string | null
}

const TOPIC_CHIPS = ['all', 'llm', 'agent', 'voice', 'policy', 'safety', 'search', 'news'] as const

const LANE_ORDER: ContentLaneKey[] = ['official', 'paper', 'news']

const LANE_LABELS: Record<ContentLaneKey, string> = {
  official: 'OFFICIAL',
  paper: 'Paper',
  news: 'News',
}

const LANE_TONES: Record<ContentLaneKey, { bg: string; text: string }> = {
  official: { bg: '#dbeafe', text: '#1e40af' },
  paper: { bg: '#f3e8ff', text: '#7e22ce' },
  news: { bg: '#fee2e2', text: '#b91c1c' },
}

const emptyLanes: UiContentLanes = { official: [], paper: [], news: [] }

const initialHomeData: HomeData = {
  random: [],
  latest: [],
  unique: [],
  lanes: emptyLanes,
  loading: true,
  message: 'ホームを読み込み中です。',
}

const initialSearchState: SearchLoadState = { articles: [], loading: false, message: null }

const initialHomeStats: HomeStats = {
  publishedToday: 0,
  publishedTotal: 0,
  officialCount: 0,
  blogCount: 0,
  paperCount: 0,
  newsCount: 0,
  topRatedCount: 0,
  agentCount: 0,
  voiceCount: 0,
  policyCount: 0,
  safetyCount: 0,
  searchCount: 0,
}

const initialHomeActivity: HomeActivity = {
  impressionCountLastHour: 0,
  shareCountLastHour: 0,
  activeArticlesLastHour: 0,
}

function hydrateArticle(article: UiArticle): UiArticle {
  return {
    ...article,
    score:
      typeof article.score === 'number'
        ? article.score
        : typeof article.score === 'string'
          ? Number(article.score)
          : article.score,
    published_at: new Date(article.published_at),
    created_at: new Date(article.created_at),
    updated_at: new Date(article.updated_at),
  }
}

function toUiArticles(articles: UiArticle[]): UiArticle[] {
  return articles.map(hydrateArticle)
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? `Request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

// ソースレーンの絵文字解決（ArticleRow でも使うシンプル版）
const BLAND_EMOJI = new Set(['🧠', '📝', ''])
const LANE_EMOJIS: Record<string, string[]> = {
  official: ['🤖', '💡', '🔬', '⚡', '🌐', '🔮', '📡', '⚙️'],
  paper:    ['📄', '🔬', '🧬', '📊', '🔭', '🎓', '🧪', '📐'],
  news:     ['📰', '🗞️', '📡', '🌍', '💼', '📈', '🎙️', '📻'],
}
function resolveEmoji(article: { id: string; source_type: string; thumbnail_emoji?: string | null }): string {
  if (article.thumbnail_emoji && !BLAND_EMOJI.has(article.thumbnail_emoji)) return article.thumbnail_emoji
  const emojis = LANE_EMOJIS[article.source_type] ?? ['📰', '🔬', '💡', '🌐']
  const hash = article.id.split('').reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) >>> 0), 0)
  return emojis[hash % emojis.length]
}

export default function HomePage() {
  const [searchDraft, setSearchDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [period, setPeriod] = useState<RankPeriod>('24h')
  const [activeTopic, setActiveTopic] = useState<(typeof TOPIC_CHIPS)[number]>('all')
  const [summaryMode, setSummaryMode] = useState<100 | 200>(100)
  const [summaryModalArticle, setSummaryModalArticle] = useState<UiArticle | null>(null)
  const [shareTarget, setShareTarget] = useState<UiArticle | null>(null)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [shareIncludeAiTrendHub, setShareIncludeAiTrendHub] = useState(true)
  const [shareIncludeTitle, setShareIncludeTitle] = useState(true)
  const [shareIncludeSummary, setShareIncludeSummary] = useState(false)
  const [shareTextContent, setShareTextContent] = useState('')
  const [savedArticleIds, setSavedArticleIds] = useState<string[]>([])
  const [likedArticleIds, setLikedArticleIds] = useState<string[]>([])
  const [focusedArticleId, setFocusedArticleId] = useState<string | null>(null)
  const [homeData, setHomeData] = useState<HomeData>(initialHomeData)
  const [homeStats, setHomeStats] = useState<HomeStats>(initialHomeStats)
  const [homeActivity, setHomeActivity] = useState<HomeActivity>(initialHomeActivity)
  const [searchState, setSearchState] = useState<SearchLoadState>(initialSearchState)

  useEffect(() => {
    getOrCreateSessionId()
    setSavedArticleIds(getSavedArticleIds())
    setLikedArticleIds(getLikedArticleIds())
    setFocusedArticleId(consumeReturnFocusArticleId())
  }, [])

  useEffect(() => {
    if (!focusedArticleId) return
    document.getElementById(`article-card-${focusedArticleId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusedArticleId])

  // ホームデータ取得
  useEffect(() => {
    let ignore = false
    async function loadHome() {
      setHomeData((c) => ({ ...c, loading: true, message: 'ホームを読み込み中です。' }))
      try {
        const response = await fetchJson<HomeResponse>(`/api/home?period=${period}&limit=20`)
        if (ignore) return
        setHomeData({
          random: toUiArticles(response.random as UiArticle[]),
          latest: toUiArticles(response.latest as UiArticle[]),
          unique: toUiArticles(response.unique as UiArticle[]),
          lanes: {
            official: toUiArticles(response.lanes.official as UiArticle[]),
            paper: toUiArticles(response.lanes.paper as UiArticle[]),
            news: toUiArticles(response.lanes.news as UiArticle[]),
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
    return () => { ignore = true }
  }, [period])

  // 検索
  useEffect(() => {
    let ignore = false
    async function loadSearch() {
      if (!searchQuery) { setSearchState(initialSearchState); return }
      setSearchState({ articles: [], loading: true, message: `「${searchQuery}」を検索中です。` })
      try {
        const response = await fetchJson<SearchResponse>(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=12`)
        if (ignore) return
        setSearchState({ articles: toUiArticles(response.articles as UiArticle[]), loading: false, message: `${response.total} 件ヒットしました。` })
      } catch (error) {
        if (ignore) return
        setSearchState({ articles: [], loading: false, message: error instanceof Error ? error.message : '検索に失敗しました。' })
      }
    }
    void loadSearch()
    return () => { ignore = true }
  }, [searchQuery])

  // 共有テキスト自動生成
  useEffect(() => {
    if (!shareTarget) return
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/articles/${shareTarget.publicKey ?? shareTarget.id}`
      : `/articles/${shareTarget.publicKey ?? shareTarget.id}`
    const lines = [
      shareIncludeTitle ? shareTarget.title : null,
      shareIncludeSummary ? (shareTarget.summary_100 ?? '') : null,
      url,
      shareIncludeAiTrendHub ? '#AiTrendHub' : null,
    ].filter(Boolean)
    setShareTextContent(lines.join('\n'))
    setShareStatus(null)
  }, [shareTarget, shareIncludeAiTrendHub, shareIncludeTitle, shareIncludeSummary])

  // トピックフィルタ適用
  const filterByTopic = (articles: UiArticle[]) =>
    activeTopic === 'all' ? articles : articles.filter((a) => a.genre === activeTopic)

  const randomArticles = useMemo(() => filterByTopic(homeData.random), [activeTopic, homeData.random])
  const latestArticles = useMemo(() => filterByTopic(homeData.latest), [activeTopic, homeData.latest])
  const uniqueArticles = useMemo(() => filterByTopic(homeData.unique), [activeTopic, homeData.unique])

  const visibleSearchArticles = useMemo(
    () => filterByTopic(searchState.articles),
    [activeTopic, searchState.articles],
  )

  // 全記事プール（findArticle 用）
  const allArticles = useMemo(() => {
    const seen = new Set<string>()
    const result: UiArticle[] = []
    for (const a of [
      ...homeData.random, ...homeData.latest, ...homeData.unique,
      ...homeData.lanes.official, ...homeData.lanes.paper, ...homeData.lanes.news,
      ...searchState.articles,
    ]) {
      if (!seen.has(a.id)) { seen.add(a.id); result.push(a) }
    }
    return result
  }, [homeData, searchState.articles])

  // KPI 定義
  const kpis = useMemo(() => [
    { label: '公開総数',  value: homeStats.publishedTotal,           group: 'total' },
    { label: '本日の新着', value: homeStats.publishedToday,           group: 'total' },
    { label: '高評価',    value: homeStats.topRatedCount,             group: 'total' },
    { label: '保存済み',  value: savedArticleIds.length,              group: 'total' },
    { label: 'OFFICIAL', value: homeStats.officialCount,              group: 'lane' },
    { label: 'BLOG',     value: homeStats.blogCount,                  group: 'lane' },
    { label: 'PAPER',    value: homeStats.paperCount,                 group: 'lane' },
    { label: 'NEWS',     value: homeStats.newsCount,                  group: 'lane' },
    { label: 'Agent',    value: homeStats.agentCount,                 group: 'genre' },
    { label: 'Voice',    value: homeStats.voiceCount,                 group: 'genre' },
    { label: 'Policy',   value: homeStats.policyCount,                group: 'genre' },
    { label: 'Safety',   value: homeStats.safetyCount,                group: 'genre' },
    { label: '1h 閲覧',  value: homeActivity.impressionCountLastHour, group: 'activity' },
    { label: '1h シェア', value: homeActivity.shareCountLastHour,     group: 'activity' },
  ], [homeStats, homeActivity, savedArticleIds.length])

  function findArticle(id: string): UiArticle | null {
    return allArticles.find((a) => a.id === id) ?? null
  }

  function handleCardClick(articleId: string) {
    const article = findArticle(articleId)
    if (article) setSummaryModalArticle(article)
  }

  function handleOpenArticle(articleId: string) {
    const article = findArticle(articleId)
    if (!article) return
    setReturnFocusArticleId(article.id)
    window.open(article.url, '_blank', 'noopener,noreferrer')
    void trackAction({ actionType: 'article_open', articleId: article.id, source: 'direct' })
  }

  function handleLike(articleId: string) {
    const next = toggleLikedArticleId(articleId)
    const isNowLiked = next.includes(articleId)
    setLikedArticleIds(next)
    void trackAction({ actionType: isNowLiked ? 'like' : 'unlike', articleId, source: 'direct' })
  }

  function handleSaveToggle(articleId: string) {
    const next = toggleSavedArticleId(articleId)
    const isNowSaved = next.includes(articleId)
    setSavedArticleIds(next)
    void trackAction({ actionType: isNowSaved ? 'save' : 'unsave', articleId, source: 'direct' })
  }

  function handleArticleAction(type: ActionType, articleId: string) {
    const article = findArticle(articleId)
    if (!article) return

    if (type === 'share_open') {
      setShareTarget(article)
      return
    }
    if (type === 'like' || type === 'unlike') {
      handleLike(articleId)
      return
    }
    if (type === 'save' || type === 'unsave') {
      handleSaveToggle(articleId)
      return
    }
    if (type === 'topic_group_open') {
      setFocusedArticleId(articleId)
      void trackAction({ actionType: 'topic_group_open', articleId, source: 'topic_group' })
    }
  }

  function handleSearchSubmit() {
    const q = searchDraft.trim()
    setSearchQuery(q)
    if (!q) return
    void trackAction({ actionType: 'search', source: 'search', meta: { query: q } })
  }

  // ArticleCard レンダリングヘルパー
  function renderCard(article: UiArticle, key?: string) {
    return (
      <ArticleCard
        key={key ?? article.id}
        article={article}
        summaryMode={summaryMode}
        isFocused={focusedArticleId === article.id}
        isSaved={savedArticleIds.includes(article.id)}
        isLiked={likedArticleIds.includes(article.id)}
        onCardClick={handleCardClick}
        onAction={handleArticleAction}
        onOpenArticle={handleOpenArticle}
        onLike={handleLike}
      />
    )
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Header
        searchValue={searchDraft}
        savedCount={savedArticleIds.length}
        onSearchChange={setSearchDraft}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* xl 固定サイド帯 */}
      <div className="fixed bottom-0 left-0 top-[52px] hidden w-[120px] bg-dim-fg xl:block" />
      <div className="fixed bottom-0 right-0 top-[52px] hidden w-[120px] bg-dim-fg xl:block" />

      <main className="mx-auto max-w-[1440px] px-4 pb-[80px] pt-[68px] md:pb-10 md:px-6 xl:px-[120px]">

        {/* ── Stats ─────────────────────────────────── */}
        <section className="border-b border-black/5 px-1 py-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:grid md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-[repeat(14,1fr)]">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} label={kpi.label} value={String(kpi.value)} group={kpi.group} />
            ))}
          </div>
        </section>

        <section className="mt-3 flex flex-col gap-3 xl:flex-row">
          <div className="flex-1 rounded-[14px] bg-white/10 p-2.5">

            {/* フォーカスバー */}
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#f4d9c1] bg-[#fff8ef] px-3 py-2 text-[11px] text-accent-darker">
              <span className="font-bold">Focus</span>
              <span>{homeData.message ?? '公開状況を表示中です。'}</span>
            </div>

            {/* 100字/200字 セグメントコントロール（ツールバーの上） */}
            <div className="mb-2 flex overflow-hidden rounded-lg border border-black/5" style={{ background: 'var(--color-card-second)' }}>
              {([100, 200] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSummaryMode(mode)}
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

            {/* Toolbar */}
            <Toolbar period={period} onPeriodChange={setPeriod} />

            {/* Topic chips */}
            <div className="mt-2 flex flex-wrap gap-2 px-1">
              {TOPIC_CHIPS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className="rounded-full border px-3 py-1 text-[11px] font-bold"
                  style={{
                    background: activeTopic === topic ? 'var(--color-accent-lighter)' : '#fff',
                    color: activeTopic === topic ? 'var(--color-accent-darker)' : 'var(--color-subtle)',
                    borderColor: activeTopic === topic ? '#f4c29a' : 'rgba(0,0,0,0.05)',
                  }}
                  onClick={() => setActiveTopic(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>

            {/* ── ランダム表示 ─────────────────────── */}
            <div id="section-random" className="mt-4">
              <SectionHeading>ランダム表示</SectionHeading>
              {homeData.loading ? (
                <LoadingGrid />
              ) : randomArticles.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {randomArticles.map((a) => renderCard(a))}
                </div>
              ) : (
                <EmptyState title="記事がありません" description="topic を変えて再確認してください。" />
              )}
            </div>

            {/* ── 新着順 ───────────────────────────── */}
            <div id="section-latest" className="mt-6">
              <SectionHeading>新着順</SectionHeading>
              {homeData.loading ? (
                <LoadingGrid />
              ) : latestArticles.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {latestArticles.map((a) => renderCard(a, `latest-${a.id}`))}
                </div>
              ) : (
                <EmptyState title="新着記事がありません" description="期間フィルタを変更してください。" />
              )}
            </div>

            {/* ── ユニーク順 ───────────────────────── */}
            <div id="section-unique" className="mt-6">
              <SectionHeading>ユニーク順</SectionHeading>
              {homeData.loading ? (
                <LoadingGrid />
              ) : uniqueArticles.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {uniqueArticles.map((a) => renderCard(a, `unique-${a.id}`))}
                </div>
              ) : (
                <EmptyState title="記事がありません" description="期間フィルタを変更してください。" />
              )}
            </div>

            {/* ── ソースレーン ─────────────────────── */}
            <SectionLabel className="mt-6">ソースレーン</SectionLabel>
            <div className="flex flex-col gap-5">
              {LANE_ORDER.map((laneKey) => {
                const articles = homeData.lanes[laneKey]
                const tone = LANE_TONES[laneKey]
                const label = LANE_LABELS[laneKey]
                return (
                  <div key={laneKey} id={`lane-${laneKey}`}>
                    <div
                      className="mb-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-extrabold"
                      style={{ background: tone.bg, color: tone.text }}
                    >
                      <span>{label}</span>
                      <span className="text-[10px] opacity-70">{articles.length} 件</span>
                    </div>
                    {homeData.loading ? (
                      <LoadingGrid compact />
                    ) : articles.length > 0 ? (
                      <div className="rounded-xl border border-black/5 bg-white p-3">
                        {(articles as ArticleWithScore[]).map((article) => (
                          <ArticleRow
                            key={article.id}
                            article={article}
                            summaryMode={summaryMode}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState title={`${label} の記事がありません`} description="期間フィルタを変更してください。" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* ダイジェストページへのリンク */}
            <div className="mt-5 rounded-2xl border border-black/5 bg-white p-4 text-center">
              <p className="text-[13px] font-extrabold">AIダイジェスト</p>
              <p className="mt-1 text-[11px] text-muted">今日のトップ記事をまとめて確認できます</p>
              <a
                href="/digest"
                className="mt-3 inline-block rounded-xl px-5 py-2 text-[12px] font-bold text-white"
                style={{ background: 'var(--color-orange)' }}
              >
                ダイジェストを見る →
              </a>
            </div>

            {/* 検索結果（インライン） */}
            {searchQuery ? (
              <div className="mt-5">
                <SectionLabel>検索結果</SectionLabel>
                <p className="mb-2 text-[11px] text-muted">
                  {searchState.loading ? `「${searchQuery}」を検索中です。` : `「${searchQuery}」 / ${visibleSearchArticles.length} 件`}
                </p>
                {searchState.loading ? (
                  <LoadingGrid compact />
                ) : visibleSearchArticles.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {visibleSearchArticles.map((a) => renderCard(a, `search-${a.id}`))}
                  </div>
                ) : (
                  <EmptyState title="該当記事なし" description={searchState.message ?? '検索条件を変えて再確認してください。'} />
                )}
              </div>
            ) : null}

            {/* PWA */}
            <div className="mt-4">
              <SectionLabel>PWA</SectionLabel>
              <PwaInstallBanner />
            </div>
          </div>

          {/* サイドバー（xl のみ） */}
          <div className="hidden xl:block xl:shrink-0">
            <RightSidebar
              savedCount={savedArticleIds.length}
              likedCount={likedArticleIds.length}
              impressionCountLastHour={homeActivity.impressionCountLastHour}
              shareCountLastHour={homeActivity.shareCountLastHour}
            />
          </div>
        </section>
      </main>

      {/* ── サマリーモーダル ───────────────────────── */}
      {summaryModalArticle ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setSummaryModalArticle(null)}
        >
          <div
            className="relative w-full max-w-[520px] cursor-pointer overflow-hidden rounded-2xl border border-black/5 bg-card-second shadow-[0_16px_48px_rgba(0,0,0,0.2)]"
            onClick={(e) => {
              e.stopPropagation()
              handleOpenArticle(summaryModalArticle.id)
            }}
          >
            {/* 閉じるボタン */}
            <button
              type="button"
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-[14px] text-muted"
              style={{ background: 'rgba(0,0,0,0.05)' }}
              onClick={(e) => { e.stopPropagation(); setSummaryModalArticle(null) }}
            >
              ×
            </button>

            <div className="p-5">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl text-[30px]"
                  style={{ background: 'linear-gradient(145deg, #ffe8d6, #ffd8bd)' }}
                >
                  {resolveEmoji(summaryModalArticle)}
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <div className="mb-1.5 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 font-bold text-[#1d4ed8]">
                      {summaryModalArticle.source_type}
                    </span>
                    <span className="rounded-full bg-[#f6f0ea] px-2 py-0.5 font-bold text-accent-darker">
                      {summaryModalArticle.genre}
                    </span>
                    <span className="text-muted">
                      {summaryModalArticle.published_at.toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-extrabold leading-tight">{summaryModalArticle.title}</h3>
                </div>
              </div>

              <p className="mt-4 text-[13px] leading-[1.8] text-[#4f5969]">
                {summaryModalArticle.summary_200 ?? summaryModalArticle.summary_100 ?? '要約は準備中です。'}
              </p>

              <p className="mt-3 text-center text-[11px] text-muted">
                クリックで元記事を開きます
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── 共有モーダル（再設計版） ───────────────── */}
      {shareTarget ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 px-4"
          onClick={() => setShareTarget(null)}
        >
          <div
            className="w-full max-w-[480px] rounded-2xl border border-black/5 bg-card-second shadow-[0_8px_32px_rgba(0,0,0,0.14)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <span className="text-[13px] font-extrabold">この記事を共有</span>
              <button type="button" className="text-xl text-muted" onClick={() => setShareTarget(null)}>×</button>
            </div>

            <div className="flex flex-col gap-4 p-4">
              {/* カスタムチェックボックス */}
              <div className="flex flex-wrap gap-2">
                <CustomCheckbox
                  checked={shareIncludeAiTrendHub}
                  onChange={setShareIncludeAiTrendHub}
                  label="#AiTrendHub"
                />
                <CustomCheckbox
                  checked={shareIncludeTitle}
                  onChange={setShareIncludeTitle}
                  label="タイトル"
                />
                <CustomCheckbox
                  checked={shareIncludeSummary}
                  onChange={setShareIncludeSummary}
                  label="100字要約"
                />
              </div>

              {/* 紹介文テキストエリア（自由編集、白背景） */}
              <textarea
                className="min-h-[128px] w-full rounded-xl border border-black/10 bg-white p-3 text-[12px] leading-6 outline-none"
                value={shareTextContent}
                onChange={(e) => setShareTextContent(e.target.value)}
                placeholder="紹介文を入力してください"
              />

              {/* コピーボタン */}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl py-2.5 text-[12px] font-bold"
                  style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent-darker)', border: '1px solid rgba(0,0,0,0.05)' }}
                  onClick={() => {
                    const url = `${window.location.origin}/articles/${shareTarget.publicKey ?? shareTarget.id}`
                    void navigator.clipboard.writeText(url)
                    setShareStatus('URLをコピーしました。')
                    void trackAction({ actionType: 'share_copy', articleId: shareTarget.id, source: 'direct' })
                  }}
                >
                  URLをコピー
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl py-2.5 text-[12px] font-bold text-white"
                  style={{ background: 'var(--color-orange)' }}
                  onClick={() => {
                    void navigator.clipboard.writeText(shareTextContent)
                    setShareStatus('紹介文をコピーしました。')
                    void trackAction({ actionType: 'share_copy', articleId: shareTarget.id, source: 'direct' })
                  }}
                >
                  紹介文をコピー
                </button>
              </div>

              {shareStatus ? <p className="text-[11px] text-accent-darker">{shareStatus}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── 小コンポーネント ─────────────────────────────

const GROUP_COLORS: Record<string, { bg: string; text: string; val: string }> = {
  total:    { bg: '#fff7ed', text: '#9a3412', val: '#ea580c' },
  lane:     { bg: '#eff6ff', text: '#1e40af', val: '#2563eb' },
  genre:    { bg: '#f0fdf4', text: '#14532d', val: '#16a34a' },
  activity: { bg: '#fdf4ff', text: '#581c87', val: '#9333ea' },
}

function KpiCard({ label, value, group }: { label: string; value: string; group: string }) {
  const colors = GROUP_COLORS[group] ?? GROUP_COLORS.total
  return (
    <article className="flex min-w-[72px] shrink-0 flex-col gap-0.5 rounded-xl p-2" style={{ background: colors.bg }}>
      <div className="truncate text-[9px] font-bold uppercase tracking-[0.06em]" style={{ color: colors.text }}>{label}</div>
      <div className="text-[18px] font-extrabold leading-none" style={{ color: colors.val }}>{value}</div>
    </article>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[18px] font-extrabold text-ink">{children}</h2>
  )
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-2 inline-block rounded-md bg-[#f2dfd0] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#7a4525] ${className}`}>
      {children}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-card-second px-5 py-8 text-center text-muted">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[#f2dfd0] text-[11px] font-extrabold text-accent-darker">NO</div>
      <div className="mb-1 text-[14px] font-extrabold text-ink">{title}</div>
      <div className="text-[11px] leading-5">{description}</div>
    </div>
  )
}

function LoadingGrid({ compact = false }: { compact?: boolean }) {
  const count = compact ? 1 : 2
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="min-h-[180px] animate-pulse rounded-xl border border-black/5 bg-card-second p-3">
          <div className="flex gap-3">
            <div className="h-[72px] w-[56px] rounded-lg bg-[#f2dfd0]" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3 w-4/5 rounded bg-[#f2dfd0]" />
              <div className="h-3 w-full rounded bg-[#f2dfd0]" />
              <div className="h-3 w-3/5 rounded bg-[#f2dfd0]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CustomCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors"
      style={{
        background: checked ? 'var(--color-accent-lighter)' : '#fff',
        borderColor: checked ? '#f4c29a' : 'rgba(0,0,0,0.08)',
        color: checked ? 'var(--color-accent-darker)' : 'var(--color-subtle)',
      }}
    >
      <span>{checked ? '✅' : '⬜'}</span>
      <span>{label}</span>
    </button>
  )
}
