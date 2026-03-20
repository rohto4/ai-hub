'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArticleCard } from '@/components/card/ArticleCard'
import { Header } from '@/components/layout/Header'
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner'
import { RightSidebar } from '@/components/sidebar/RightSidebar'
import { Toolbar } from '@/components/toolbar/Toolbar'
import {
  consumeReturnFocusArticleId,
  getMisskeyInstance,
  getOrCreateSessionId,
  getSavedArticleIds,
  getShareAppendTag,
  setMisskeyInstance,
  setReturnFocusArticleId,
  setShareAppendTag,
  toggleSavedArticleId,
  trackAction,
} from '@/lib/client/home'
import type { ActionType, ArticleWithScore, HomeResponse, RankPeriod, SearchResponse } from '@/lib/db/types'

type RouteState =
  | { page: 'home' }
  | { page: 'ranking' }
  | { page: 'search' }
  | { page: 'detail'; articleId: string }
  | { page: 'category'; category: string }
  | { page: 'tag'; tag: string }
  | { page: 'about' }
  | { page: 'feed' }

type MockArticle = ArticleWithScore & { tags: string[] }
type SourceLane = 'all' | 'official' | 'paper' | 'news'

const ROUTE_BUTTONS: Array<{ id: RouteState['page']; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'search', label: 'Search' },
  { id: 'about', label: 'About' },
  { id: 'feed', label: 'Feed' },
]

const initialNotifTimes = [
  { label: '07:00 ダイジェスト', on: true },
  { label: '12:00 ダイジェスト', on: true },
  { label: '18:00 ダイジェスト', on: false },
]

function fixtureArticles(): MockArticle[] {
  const now = new Date()
  const rows = [
    ['mock-1', 'OpenAI Agent SDK の更新と導入ポイント', 'agent', 'official', 'Agent SDK の更新差分を短く把握できる記事です。', 'OpenAI の Agent SDK 更新内容をベースに、導入時の差分確認やワークフロー設計の観点を整理した内容です。', 96, ['openai', 'agent', 'sdk'], '🤖'],
    ['mock-2', 'Google Alerts 経由で AI Agent 監視を回す', 'agent', 'alerts', 'Agent 監視を alerts ベースで回す構成の確認用カードです。', 'Google Alerts のみで監視しているケースを想定し、snippet ベースでも公開導線が破綻しないか確認するためのカードです。', 72, ['alerts', 'agent'], '🚨'],
    ['mock-3', '長文コンテキスト評価の新しい論文', 'llm', 'paper', '評価設計と benchmark の見直しに触れた論文です。', '長文コンテキスト評価の新しい benchmark と実験条件を整理した論文を想定しています。paper 導線と paper タグ限定付与の見え方確認に使います。', 90, ['paper'], '🔬'],
    ['mock-4', 'RAG 設計の実践メモ', 'search', 'blog', 'RAG の設計と運用メモを確認するためのブログ記事です。', 'RAG システムの取得層、再ランキング、観測性まで含めて、実運用上の設計論点がまとまったブログ記事を想定しています。', 81, ['rag', 'search'], '📚'],
    ['mock-5', 'OpenAI Safety update と運用メモ', 'safety', 'official', '安全性評価や運用ガイドを扱う公式更新です。', 'Safety に関する公式発表を想定し、policy や safety の topic chip からもたどれるかを確認するためのカードです。', 88, ['openai', 'safety'], '🛡️'],
    ['mock-6', 'Voice AI の最新導入事例', 'voice', 'official', '音声 AI の導入事例をまとめた公式記事です。', 'Voice AI の導入事例を通じて、voice topic と official lane が交差した時の表示確認を行うためのカードです。', 84, ['voice', 'operations'], '🎙️'],
    ['mock-7', '主要モデルのニュース整理', 'news', 'news', '主要モデルの動きをニュース視点で簡潔に把握します。', 'モデル更新、提携、周辺施策などをニュース視点で一覧化した想定カードです。news lane の存在確認に使います。', 68, ['news', 'models'], '📰'],
  ] as const

  return rows.map(([id, title, genre, sourceType, summary100, summary200, score, tags, emoji], index) => ({
    id,
    url: `https://example.com/${id}`,
    title,
    genre,
    source_type: sourceType,
    thumbnail_url: null,
    thumbnail_emoji: emoji,
    published_at: new Date(now.getTime() - index * 60 * 60 * 1000),
    summary_100: summary100,
    summary_200: summary200,
    critique: null,
    publication_basis: sourceType === 'alerts' ? 'source_snippet' : 'full_summary',
    summary_input_basis: sourceType === 'alerts' ? 'source_snippet' : 'full_content',
    topic_group_id: genre === 'agent' ? 'tg-agent' : genre === 'llm' ? 'tg-llm' : null,
    created_at: new Date(now.getTime() - index * 60 * 60 * 1000),
    updated_at: new Date(now.getTime() - index * 30 * 60 * 1000),
    score,
    tags: [...tags],
  }))
}

function toMockArticle(article: ArticleWithScore): MockArticle {
  const tagSeed = [article.genre, article.source_type, ...(article.title.match(/[A-Za-z][A-Za-z0-9-]+/g) ?? []).slice(0, 2)]
  const tags = Array.from(new Set(tagSeed.map((item) => item.toLowerCase())))
  return {
    ...article,
    topic_group_id: article.topic_group_id ?? (article.genre === 'agent' ? 'tg-agent' : article.source_type),
    thumbnail_emoji:
      article.thumbnail_emoji ?? (article.source_type === 'paper' ? '🔬' : article.source_type === 'alerts' ? '🚨' : '🧠'),
    tags,
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return (await response.json()) as T
}

function buildShareText(article: MockArticle, appendTag: boolean): string {
  return [article.title, article.summary_100 ?? '要約は準備中です。', appendTag ? `${article.url}\n#AIHub` : article.url].join('\n\n')
}

export default function Mock4Page() {
  const [route, setRoute] = useState<RouteState>({ page: 'home' })
  const [searchDraft, setSearchDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [period, setPeriod] = useState<RankPeriod>('24h')
  const [activeTab, setActiveTab] = useState<'ranking' | 'latest' | 'unique'>('ranking')
  const [activeCategory, setActiveCategory] = useState<SourceLane>('all')
  const [summaryMode, setSummaryMode] = useState<100 | 200>(100)
  const [showCritique, setShowCritique] = useState(false)
  const [notifTimes, setNotifTimes] = useState(initialNotifTimes)
  const [savedArticleIds, setSavedArticleIds] = useState<string[]>([])
  const [shareTarget, setShareTarget] = useState<MockArticle | null>(null)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [appendAiHubTag, setAppendAiHubTagState] = useState(true)
  const [misskeyInstance, setMisskeyInstanceState] = useState('')
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null)
  const [focusedArticleId, setFocusedArticleId] = useState<string | null>(null)
  const [articles, setArticles] = useState<MockArticle[]>(fixtureArticles())
  const [searchResults, setSearchResults] = useState<MockArticle[]>([])
  const [loadingMessage, setLoadingMessage] = useState('mock4 を初期化中です。')

  useEffect(() => {
    getOrCreateSessionId()
    setSavedArticleIds(getSavedArticleIds())
    setAppendAiHubTagState(getShareAppendTag())
    setMisskeyInstanceState(getMisskeyInstance())
    setFocusedArticleId(consumeReturnFocusArticleId())
  }, [])

  useEffect(() => {
    let ignore = false

    async function load() {
      try {
        setLoadingMessage('Home / Ranking を live API から取得しています。')
        const home = await fetchJson<HomeResponse>(`/api/home?period=${period}&limit=18`)
        if (ignore) return
        setArticles(home.random.map(toMockArticle))
        setLoadingMessage('live API を表示中です。')
      } catch {
        if (ignore) return
        setArticles(fixtureArticles())
        setLoadingMessage('DB/API 未接続のため fixture を表示中です。')
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [period])

  useEffect(() => {
    let ignore = false

    async function runSearch() {
      if (!searchQuery.trim()) {
        setSearchResults([])
        return
      }

      try {
        const response = await fetchJson<SearchResponse>(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=12`)
        if (ignore) return
        setSearchResults(response.articles.map((item) => toMockArticle({ ...item, score: 70 } as ArticleWithScore)))
      } catch {
        if (ignore) return
        const query = searchQuery.toLowerCase()
        setSearchResults(
          fixtureArticles().filter(
            (article) =>
              article.title.toLowerCase().includes(query) ||
              (article.summary_100 ?? '').toLowerCase().includes(query) ||
              article.tags.some((tag) => tag.includes(query)),
          ),
        )
      }
    }

    void runSearch()
    return () => {
      ignore = true
    }
  }, [searchQuery])

  const visibleArticles = useMemo(() => {
    const base = articles.filter((article) => (activeCategory === 'all' ? true : article.source_type === activeCategory))
    if (activeTab === 'latest') {
      return [...base].sort((left, right) => right.published_at.getTime() - left.published_at.getTime())
    }
    if (activeTab === 'unique') {
      return [...base].sort((left, right) => left.genre.localeCompare(right.genre) || right.score - left.score)
    }
    return [...base].sort((left, right) => right.score - left.score)
  }, [activeCategory, activeTab, articles])

  const selectedArticle = useMemo(() => {
    if (route.page !== 'detail') return null
    return articles.find((article) => article.id === route.articleId) ?? null
  }, [articles, route])

  const topicGroupItems = useMemo(() => {
    const focus = selectedArticle ?? visibleArticles.find((article) => article.topic_group_id) ?? visibleArticles[0] ?? null
    if (!focus?.topic_group_id) return []
    return visibleArticles.filter((article) => article.topic_group_id === focus.topic_group_id).slice(0, 6)
  }, [selectedArticle, visibleArticles])

  function handleSearchSubmit() {
    const nextQuery = searchDraft.trim()
    setSearchQuery(nextQuery)
    setRoute({ page: 'search' })
    if (!nextQuery) return
    void trackAction({ actionType: 'search', source: 'search', meta: { query: nextQuery } })
  }

  function openDetail(articleId: string) {
    setRoute({ page: 'detail', articleId })
    setFocusedArticleId(articleId)
  }

  function handleSaveToggle(articleId: string) {
    const nextSavedIds = toggleSavedArticleId(articleId)
    const isNowSaved = nextSavedIds.includes(articleId)
    setSavedArticleIds(nextSavedIds)
    void trackAction({ actionType: isNowSaved ? 'save' : 'unsave', articleId, source: 'direct' })
  }

  function handleArticleAction(type: ActionType, articleId: string) {
    const article = articles.find((item) => item.id === articleId) ?? null
    if (!article) return

    if (type === 'share_open') {
      setShareTarget(article)
      setShareStatus(null)
      void trackAction({ actionType: 'share_open', articleId, source: 'direct' })
      return
    }

    if (type === 'expand_200') {
      setExpandedArticleId((current) => (current === articleId ? null : articleId))
      void trackAction({ actionType: 'expand_200', articleId, source: 'direct' })
      return
    }

    if (type === 'critique_expand') {
      setShowCritique((current) => !current)
      void trackAction({ actionType: 'critique_expand', articleId, source: 'direct' })
      return
    }

    if (type === 'save' || type === 'unsave') {
      handleSaveToggle(articleId)
      return
    }

    if (type === 'topic_group_open') {
      setRoute({ page: 'home' })
      document.getElementById('mock4-topic-group')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      void trackAction({ actionType: 'topic_group_open', articleId, source: 'topic_group', meta: { topic_group_id: article.topic_group_id } })
    }
  }

  async function handleShareAction(target: 'copy' | 'x' | 'threads' | 'slack' | 'misskey') {
    if (!shareTarget) return

    const shareText = buildShareText(shareTarget, appendAiHubTag)
    const encodedText = encodeURIComponent(shareText)
    if (target === 'copy') {
      await navigator.clipboard.writeText(shareText)
      setShareStatus('共有文をコピーしました。')
      void trackAction({ actionType: 'share_copy', articleId: shareTarget.id, source: 'direct' })
      return
    }

    if (target === 'misskey' && !misskeyInstance) {
      setShareStatus('Misskey インスタンスを設定してください。')
      return
    }

    const shareUrlMap = {
      x: `https://x.com/intent/post?text=${encodedText}`,
      threads: `https://www.threads.net/intent/post?text=${encodedText}`,
      slack: `https://slack.com/app_redirect?channel=&team=&text=${encodedText}`,
      misskey: `https://${misskeyInstance}/share?text=${encodedText}`,
    }
    window.open(shareUrlMap[target], '_blank', 'noopener,noreferrer')

    const actionMap = {
      x: 'share_x',
      threads: 'share_threads',
      slack: 'share_slack',
      misskey: 'share_misskey',
    } as const
    void trackAction({ actionType: actionMap[target], articleId: shareTarget.id, source: 'direct' })
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Header searchValue={searchDraft} onSearchChange={setSearchDraft} onSearchSubmit={handleSearchSubmit} savedCount={savedArticleIds.length} />

      <main className="mx-auto max-w-[1440px] px-4 pb-10 pt-[68px] md:px-6 xl:px-[120px]">
        <section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold">mock4</h1>
              <p className="mt-1 text-sm text-muted">l3-l4-screen-flow の導線をまとめて確認するための動作重視モックです。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ROUTE_BUTTONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="rounded-full border px-4 py-2 text-sm font-bold"
                  style={{
                    background: route.page === item.id ? 'var(--color-accent-lighter)' : '#fff',
                    borderColor: 'rgba(0,0,0,0.06)',
                  }}
                  onClick={() => setRoute({ page: item.id } as RouteState)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-2xl bg-[#fff8ef] px-4 py-3 text-sm text-accent-darker">{loadingMessage}</div>
        </section>

        <section className="mt-4 flex flex-col gap-4 xl:flex-row">
          <div className="flex-1 rounded-[14px] bg-white/20 p-2.5">
            <Toolbar period={period} onPeriodChange={setPeriod} />

            <div className="mt-3 flex flex-wrap gap-2 px-2">
              {(['all', 'official', 'alerts', 'blog', 'paper', 'news'] as SourceLane[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-full border px-3 py-1 text-[11px] font-bold"
                  style={{
                    background: activeCategory === item ? 'var(--color-accent-lighter)' : '#fff',
                    borderColor: 'rgba(0,0,0,0.06)',
                  }}
                  onClick={() => {
                    setActiveCategory(item)
                    if (route.page === 'category') {
                      setRoute({ page: 'category', category: item })
                    }
                  }}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 px-2">
              <button type="button" className="rounded-full bg-[#f6f0ea] px-3 py-1 text-[11px] font-bold" onClick={() => setSummaryMode(100)}>
                100字
              </button>
              <button type="button" className="rounded-full bg-[#f6f0ea] px-3 py-1 text-[11px] font-bold" onClick={() => setSummaryMode(200)}>
                200字
              </button>
              <button type="button" className="rounded-full bg-[#f6f0ea] px-3 py-1 text-[11px] font-bold" onClick={() => setShowCritique((current) => !current)}>
                批評
              </button>
            </div>

            {route.page === 'home' || route.page === 'ranking' ? (
              <section className="mt-4">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {visibleArticles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      summaryMode={expandedArticleId === article.id ? 200 : summaryMode}
                      isFocused={focusedArticleId === article.id}
                      isSaved={savedArticleIds.includes(article.id)}
                      onCardClick={(id) => { setFocusedArticleId(id); setExpandedArticleId(id) }}
                      onAction={handleArticleAction}
                      onOpenArticle={openDetail}
                      onLike={(id) => handleArticleAction('like', id)}
                    />
                  ))}
                </div>

                <section id="mock4-topic-group" className="mt-6 rounded-[24px] border border-black/5 bg-white p-5">
                  <h2 className="text-lg font-extrabold">Topic Group</h2>
                  <p className="mt-1 text-xs text-muted">topic_group_open の着地確認用です。official / alerts / blog の 3 レーンを並べます。</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {['official', 'alerts', 'blog'].map((lane) => (
                      <div key={lane} className="rounded-2xl bg-[#f8f2ec] p-4">
                        <div className="text-xs uppercase tracking-[0.08em] text-muted">{lane}</div>
                        <div className="mt-3 grid gap-2">
                          {topicGroupItems
                            .filter((article) => article.source_type === lane)
                            .slice(0, 2)
                            .map((article) => (
                              <button key={article.id} type="button" className="rounded-xl bg-white p-3 text-left" onClick={() => openDetail(article.id)}>
                                <div className="text-lg">{article.thumbnail_emoji ?? '📝'}</div>
                                <div className="mt-1 text-sm font-bold">{article.title}</div>
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-6 rounded-[24px] border border-black/5 bg-white p-5">
                  <h2 className="text-lg font-extrabold">Digest</h2>
                  <p className="mt-1 text-xs text-muted">compute-ranks から send-digest へ流す想定の上位 3 件です。</p>
                  <div className="mt-4 grid gap-3">
                    {visibleArticles.slice(0, 3).map((article, index) => (
                      <button key={article.id} type="button" className="flex items-center gap-3 rounded-2xl bg-[#f8f2ec] p-3 text-left" onClick={() => openDetail(article.id)}>
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl">{article.thumbnail_emoji ?? '📝'}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-muted">#{index + 1}</div>
                          <div className="truncate font-bold">{article.title}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              </section>
            ) : null}

            {route.page === 'search' ? (
              <section className="mt-6 rounded-[24px] border border-black/5 bg-white p-5">
                <h2 className="text-lg font-extrabold">Search</h2>
                <p className="mt-1 text-xs text-muted">Header 検索から /api/search を叩いた結果をここで確認します。</p>
                <div className="mt-4 grid gap-2">
                  {searchResults.length > 0 ? (
                    searchResults.map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        summaryMode={expandedArticleId === article.id ? 200 : summaryMode}
                        isFocused={focusedArticleId === article.id}
                        isSaved={savedArticleIds.includes(article.id)}
                        onCardClick={(id) => { setFocusedArticleId(id); setExpandedArticleId(id) }}
                        onAction={handleArticleAction}
                        onOpenArticle={openDetail}
                        onLike={(id) => handleArticleAction('like', id)}
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl bg-[#f8f2ec] p-4 text-sm text-muted">検索語を入力すると結果が表示されます。</div>
                  )}
                </div>
              </section>
            ) : null}

            {route.page === 'detail' && selectedArticle ? (
              <section className="mt-6 rounded-[24px] border border-black/5 bg-white p-5">
                <div className="flex flex-col gap-5 lg:flex-row">
                  <div className="flex h-32 w-28 items-center justify-center rounded-[28px] bg-[#f8f2ec] text-5xl">
                    {selectedArticle.thumbnail_emoji ?? '📝'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-accent-light px-2 py-1 font-bold text-accent-dark">{selectedArticle.source_type}</span>
                      <span className="rounded-full bg-[#f6f0ea] px-2 py-1 font-bold text-accent-darker">{selectedArticle.genre}</span>
                    </div>
                    <h2 className="mt-3 text-2xl font-extrabold leading-tight">{selectedArticle.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-[#4f5969]">{selectedArticle.summary_200 ?? selectedArticle.summary_100}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedArticle.tags.map((tag) => (
                        <button key={tag} type="button" className="rounded-full bg-[#f6f0ea] px-3 py-1 text-xs font-bold" onClick={() => setRoute({ page: 'tag', tag })}>
                          #{tag}
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-2xl bg-btn-dark px-4 py-3 text-sm font-bold text-white"
                        onClick={() => {
                          setReturnFocusArticleId(selectedArticle.id)
                          window.open(selectedArticle.url, '_blank', 'noopener,noreferrer')
                          void trackAction({ actionType: 'article_open', articleId: selectedArticle.id, source: 'direct' })
                        }}
                      >
                        元記事を開く
                      </button>
                      <button type="button" className="rounded-2xl bg-accent-light px-4 py-3 text-sm font-bold text-accent-dark" onClick={() => setRoute({ page: 'category', category: selectedArticle.source_type })}>
                        同じレーンを見る
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {route.page === 'category' ? (
              <section className="mt-6 rounded-[24px] border border-black/5 bg-white p-5">
                <h2 className="text-lg font-extrabold">Category: {route.category}</h2>
                <div className="mt-4 grid gap-2">
                  {articles
                    .filter((article) => article.source_type === route.category || article.genre === route.category)
                    .map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        summaryMode={expandedArticleId === article.id ? 200 : summaryMode}
                        isFocused={focusedArticleId === article.id}
                        isSaved={savedArticleIds.includes(article.id)}
                        onCardClick={(id) => { setFocusedArticleId(id); setExpandedArticleId(id) }}
                        onAction={handleArticleAction}
                        onOpenArticle={openDetail}
                        onLike={(id) => handleArticleAction('like', id)}
                      />
                    ))}
                </div>
              </section>
            ) : null}

            {route.page === 'tag' ? (
              <section className="mt-6 rounded-[24px] border border-black/5 bg-white p-5">
                <h2 className="text-lg font-extrabold">Tag: {route.tag}</h2>
                <div className="mt-4 grid gap-2">
                  {articles
                    .filter((article) => article.tags.includes(route.tag))
                    .map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        summaryMode={expandedArticleId === article.id ? 200 : summaryMode}
                        isFocused={focusedArticleId === article.id}
                        isSaved={savedArticleIds.includes(article.id)}
                        onCardClick={(id) => { setFocusedArticleId(id); setExpandedArticleId(id) }}
                        onAction={handleArticleAction}
                        onOpenArticle={openDetail}
                        onLike={(id) => handleArticleAction('like', id)}
                      />
                    ))}
                </div>
              </section>
            ) : null}

            {route.page === 'about' ? (
              <section className="mt-6 rounded-[24px] border border-black/5 bg-white p-5">
                <h2 className="text-lg font-extrabold">About / Batch Flow</h2>
                <div className="mt-4 grid gap-3 text-sm leading-7 text-[#4f5969]">
                  <p>hourly-fetch から daily-enrich、hourly-publish、compute-ranks、send-digest までの流れを mock4 上で確認できます。</p>
                  <p>公開面は layer4 だけを読む前提で、Home / Ranking / Search / Detail / Category / Tag / Feed の導線を順番に触れます。</p>
                </div>
              </section>
            ) : null}

            {route.page === 'feed' ? (
              <section className="mt-6 rounded-[24px] border border-black/5 bg-white p-5">
                <h2 className="text-lg font-extrabold">Feed 導線</h2>
                <div className="mt-4 grid gap-3">
                  <a href="/feed" target="_blank" rel="noreferrer" className="rounded-[18px] bg-[#f8f2ec] px-4 py-3 font-bold">
                    /feed RSS を開く
                  </a>
                  {['official', 'blog', 'paper', 'news', 'agent'].map((item) => (
                    <button key={item} type="button" className="rounded-[18px] bg-[#f8f2ec] px-4 py-3 text-left font-bold" onClick={() => setRoute({ page: 'category', category: item })}>
                      /category/{item}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-6">
              <PwaInstallBanner />
            </section>
          </div>

          <RightSidebar
            savedCount={savedArticleIds.length}
            likedCount={articles.filter((item) => Number(item.score) >= 90).length}
            impressionCountLastHour={visibleArticles.length}
            shareCountLastHour={savedArticleIds.length}
          />
        </section>
      </main>

      {shareTarget ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/10 px-4" onClick={() => setShareTarget(null)}>
          <div className="w-full max-w-[560px] rounded-xl border border-black/5 bg-card-second shadow-[0_8px_32px_rgba(0,0,0,0.12)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <span className="text-[13px] font-extrabold">この記事を共有</span>
              <button type="button" className="text-xl text-muted" onClick={() => setShareTarget(null)}>
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <textarea className="min-h-24 rounded-lg border border-black/5 p-2 text-[12px] leading-6 outline-none" value={buildShareText(shareTarget, appendAiHubTag)} readOnly />
              <label className="flex items-center gap-2 text-[11px] text-muted">
                <input
                  type="checkbox"
                  checked={appendAiHubTag}
                  onChange={(event) => {
                    setAppendAiHubTagState(event.target.checked)
                    setShareAppendTag(event.target.checked)
                  }}
                />
                <span>#AIHub と URL を末尾に付与する</span>
              </label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <button type="button" className="rounded-lg border px-3 py-2 text-[11px] font-bold" onClick={() => void handleShareAction('x')}>X</button>
                <button type="button" className="rounded-lg border px-3 py-2 text-[11px] font-bold" onClick={() => void handleShareAction('threads')}>Threads</button>
                <button type="button" className="rounded-lg border px-3 py-2 text-[11px] font-bold" onClick={() => void handleShareAction('slack')}>Slack</button>
                <button type="button" className="rounded-lg border px-3 py-2 text-[11px] font-bold" onClick={() => void handleShareAction('misskey')}>Misskey</button>
                <button type="button" className="rounded-lg bg-btn-dark px-3 py-2 text-[11px] font-bold text-white" onClick={() => void handleShareAction('copy')}>コピー</button>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-black/5 bg-white/70 p-3">
                <span className="text-[11px] font-bold text-ink">Misskey 設定</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={misskeyInstance}
                    onChange={(event) => setMisskeyInstanceState(event.target.value)}
                    placeholder="misskey.io"
                    className="flex-1 rounded-lg border border-black/5 px-3 py-2 text-[12px] outline-none"
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-black/5 px-3 py-2 text-[11px] font-bold"
                    onClick={() => {
                      setMisskeyInstance(misskeyInstance)
                      setShareStatus('Misskey インスタンスを保存しました。')
                    }}
                  >
                    保存
                  </button>
                </div>
              </div>
              {shareStatus ? <p className="text-[11px] text-accent-darker">{shareStatus}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
