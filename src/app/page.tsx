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
import type {
  ActionType,
  Article,
  HomeActivity,
  HomeResponse,
  HomeStats,
  RankPeriod,
  SearchResponse,
} from '@/lib/db/types'

type TabId = 'ranking' | 'latest' | 'unique'
type CategoryId = 'all' | 'video' | 'official' | 'blog' | 'agent'

type UiArticle = Article & { score?: number }

type LoadState = {
  articles: UiArticle[]
  loading: boolean
  message: string | null
}

const initialNotifTimes = [
  { label: '07:00 ダイジェスト', on: true },
  { label: '12:00 ダイジェスト', on: true },
  { label: '18:00 ダイジェスト', on: false },
]

const initialSearchState: LoadState = {
  articles: [],
  loading: false,
  message: null,
}

const initialHomeStats: HomeStats = {
  publishedToday: 0,
  publishedTotal: 0,
  officialCount: 0,
  topRatedCount: 0,
}

const initialHomeActivity: HomeActivity = {
  shareCountLastHour: 0,
  activeArticlesLastHour: 0,
}

function categoryMatches(category: CategoryId, article: UiArticle): boolean {
  if (category === 'all') return true
  if (category === 'agent') return article.genre === 'agent'
  return article.source_type === category
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
  return articles.map((article) => hydrateArticle(article))
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? `Request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

function buildShareText(article: UiArticle, appendTag: boolean): string {
  return [article.title, article.summary_100 ?? '要約準備中', appendTag ? `${article.url}\n#AIHub` : article.url].join('\n\n')
}

export default function HomePage() {
  const [searchDraft, setSearchDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('ranking')
  const [period, setPeriod] = useState<RankPeriod>('24h')
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all')
  const [summaryMode, setSummaryMode] = useState<100 | 200>(100)
  const [showCritique, setShowCritique] = useState(false)
  const [notifTimes, setNotifTimes] = useState(initialNotifTimes)
  const [shareTarget, setShareTarget] = useState<UiArticle | null>(null)
  const [appendAiHubTag, setAppendAiHubTagState] = useState(true)
  const [misskeyInstance, setMisskeyInstanceState] = useState('')
  const [savedArticleIds, setSavedArticleIds] = useState<string[]>([])
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null)
  const [focusedArticleId, setFocusedArticleId] = useState<string | null>(null)
  const [topicGroupArticleId, setTopicGroupArticleId] = useState<string | null>(null)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [trendState, setTrendState] = useState<LoadState>({
    articles: [],
    loading: true,
    message: '初期表示を準備しています。',
  })
  const [homeStats, setHomeStats] = useState<HomeStats>(initialHomeStats)
  const [homeActivity, setHomeActivity] = useState<HomeActivity>(initialHomeActivity)
  const [searchState, setSearchState] = useState<LoadState>(initialSearchState)

  useEffect(() => {
    getOrCreateSessionId()
    setSavedArticleIds(getSavedArticleIds())
    setAppendAiHubTagState(getShareAppendTag())
    setMisskeyInstanceState(getMisskeyInstance())
    setFocusedArticleId(consumeReturnFocusArticleId())
  }, [])

  useEffect(() => {
    if (!focusedArticleId) return
    const target = window.document.getElementById(`article-card-${focusedArticleId}`)
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusedArticleId])

  useEffect(() => {
    function handleFocus() {
      const nextFocused = consumeReturnFocusArticleId()
      if (!nextFocused) return
      setFocusedArticleId(nextFocused)
      void trackAction({
        actionType: 'return_focus',
        articleId: nextFocused,
        source: 'direct',
      })
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadHome() {
      setTrendState((current) => ({
        ...current,
        loading: true,
        message: 'ホーム画面を読み込んでいます。',
      }))

      try {
        const response = await fetchJson<HomeResponse>(`/api/home?period=${period}&limit=20`)
        if (ignore) return
        const liveArticles = toUiArticles(response.articles)
        setTrendState({
          articles: liveArticles,
          loading: false,
          message: `${response.total} 件の公開記事を表示中です。`,
        })
        setHomeStats(response.stats)
        setHomeActivity(response.activity)
      } catch (error) {
        if (ignore) return
        const message = error instanceof Error ? error.message : 'ランキングの取得に失敗しました。'
        setTrendState({
          articles: [],
          loading: false,
          message,
        })
        setHomeStats(initialHomeStats)
        setHomeActivity(initialHomeActivity)
      }
    }

    void loadHome()

    return () => {
      ignore = true
    }
  }, [period])

  useEffect(() => {
    let ignore = false

    async function loadSearch() {
      if (!searchQuery) {
        setSearchState(initialSearchState)
        return
      }

      setSearchState({
        articles: [],
        loading: true,
        message: `「${searchQuery}」を検索しています。`,
      })

      try {
        const response = await fetchJson<SearchResponse>(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=12`)
        if (ignore) return
        setSearchState({
          articles: toUiArticles(response.articles),
          loading: false,
          message: `${response.total} 件ヒットしました。`,
        })
      } catch (error) {
        if (ignore) return
        const message = error instanceof Error ? error.message : '検索に失敗しました。'
        setSearchState({
          articles: [],
          loading: false,
          message,
        })
      }
    }

    void loadSearch()

    return () => {
      ignore = true
    }
  }, [searchQuery])

  const filteredArticles = useMemo(() => {
    const result = trendState.articles.filter((article) => categoryMatches(activeCategory, article))

    if (activeTab === 'latest') {
      return [...result].sort((left, right) => right.published_at.getTime() - left.published_at.getTime())
    }

    if (activeTab === 'unique') {
      return [...result].sort((left, right) => left.genre.localeCompare(right.genre) || (right.score ?? 0) - (left.score ?? 0))
    }

    return [...result].sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
  }, [activeCategory, activeTab, trendState.articles])

  const visibleSearchArticles = useMemo(
    () => searchState.articles.filter((article) => categoryMatches(activeCategory, article)),
    [activeCategory, searchState.articles]
  )

  const kpis = useMemo(() => {
    const topicGrouped = trendState.articles.filter((article) => article.topic_group_id).length
    return [
      { label: '本日の新着', value: String(homeStats.publishedToday) },
      { label: '公開記事', value: String(homeStats.publishedTotal) },
      { label: 'Topic Group 付与', value: String(topicGrouped) },
      { label: '公式ソース', value: String(homeStats.officialCount) },
    ]
  }, [homeStats, trendState.articles])

  const digestItems = useMemo(
    () => filteredArticles.slice(0, 3).map((article, index) => ({ ...article, digestRank: index + 1 })),
    [filteredArticles]
  )

  const topicGroupItems = useMemo(() => {
    const featured =
      filteredArticles.find((article) => article.id === topicGroupArticleId) ??
      filteredArticles.find((article) => article.topic_group_id) ??
      filteredArticles[0] ??
      null
    if (!featured) return { title: 'Topic Group', items: [] as UiArticle[] }
    const items = filteredArticles
      .filter((article) =>
        featured.topic_group_id ? article.topic_group_id === featured.topic_group_id || article.id === featured.id : article.id === featured.id
      )
      .slice(0, 6)
    return {
      title: `${featured.title.slice(0, 40)}${featured.title.length > 40 ? '…' : ''}`,
      items,
    }
  }, [filteredArticles, topicGroupArticleId])

  const shareText = shareTarget ? buildShareText(shareTarget, appendAiHubTag) : ''

  function handleSearchSubmit() {
    const nextQuery = searchDraft.trim()
    setSearchQuery(nextQuery)
    if (!nextQuery) return
    void trackAction({
      actionType: 'search',
      source: 'search',
      meta: { query: nextQuery },
    })
  }

  function handleSaveToggle(articleId: string) {
    const nextSavedIds = toggleSavedArticleId(articleId)
    const isNowSaved = nextSavedIds.includes(articleId)
    setSavedArticleIds(nextSavedIds)
    void trackAction({
      actionType: isNowSaved ? 'save' : 'unsave',
      articleId,
      source: 'direct',
    })
  }

  function handleOpenArticle(articleId: string) {
    const article = filteredArticles.find((item) => item.id === articleId) ?? visibleSearchArticles.find((item) => item.id === articleId)
    if (!article) return
    setReturnFocusArticleId(article.id)
    window.open(article.url, '_blank', 'noopener,noreferrer')
    void trackAction({
      actionType: 'article_open',
      articleId: article.id,
      source: 'direct',
    })
  }

  async function handleShareAction(target: 'copy' | 'x' | 'threads' | 'slack' | 'misskey') {
    if (!shareTarget) return

    const encodedText = encodeURIComponent(shareText)
    if (target === 'copy') {
      await navigator.clipboard.writeText(shareText)
      setShareStatus('共有文をコピーしました。')
      void trackAction({ actionType: 'share_copy', articleId: shareTarget.id, source: 'direct' })
      return
    }

    if (target === 'misskey' && !misskeyInstance) {
      setShareStatus('Misskey のインスタンスを設定してください。')
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

    void trackAction({
      actionType: actionMap[target],
      articleId: shareTarget.id,
      source: 'direct',
      meta: target === 'misskey' ? { instance: misskeyInstance } : undefined,
    })
  }

  function handleArticleAction(type: ActionType, articleId: string) {
    const article =
      filteredArticles.find((item) => item.id === articleId) ??
      visibleSearchArticles.find((item) => item.id === articleId) ??
      null
    if (!article) return

    if (type === 'share_open') {
      setShareTarget(article)
      setShareStatus(null)
      void trackAction({ actionType: 'share_open', articleId, source: 'direct' })
      return
    }

    if (type === 'critique_expand') {
      setShowCritique((current) => !current)
      void trackAction({ actionType: 'critique_expand', articleId, source: 'direct' })
      return
    }

    if (type === 'expand_200') {
      const nextExpanded = expandedArticleId === articleId ? null : articleId
      setExpandedArticleId(nextExpanded)
      setFocusedArticleId(articleId)
      void trackAction({
        actionType: 'expand_200',
        articleId,
        source: 'direct',
      })
      return
    }

    if (type === 'save' || type === 'unsave') {
      handleSaveToggle(articleId)
      return
    }

    if (type === 'topic_group_open') {
      setTopicGroupArticleId(articleId)
      setFocusedArticleId(articleId)
      document.getElementById('topic-group-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      void trackAction({
        actionType: 'topic_group_open',
        articleId,
        source: 'topic_group',
        meta: { topic_group_id: article.topic_group_id },
      })
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Header
        searchValue={searchDraft}
        critiqueVisible={showCritique}
        onSearchChange={setSearchDraft}
        onSearchSubmit={handleSearchSubmit}
      />

      <div className="fixed bottom-0 left-0 top-[52px] hidden w-[120px] bg-dim-fg xl:block" />
      <div className="fixed bottom-0 right-0 top-[52px] hidden w-[120px] bg-dim-fg xl:block" />

      <main className="mx-auto max-w-[1440px] px-4 pb-10 pt-[68px] md:px-6 xl:px-[120px]">
        <section className="border-b border-black/5 px-1 py-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
            ))}
          </div>
        </section>

        <section className="mt-3 flex flex-col gap-3 xl:flex-row">
          <div className="flex-1 rounded-[14px] bg-white/10 p-2.5">
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#f4d9c1] bg-[#fff8ef] px-3 py-2 text-[11px] text-accent-darker">
              <span className="font-bold">Focus</span>
              <span>{trendState.message ?? '表示状態を確認中です。'}</span>
            </div>

            <Toolbar activeTab={activeTab} onTabChange={setActiveTab} period={period} onPeriodChange={setPeriod} />

            <div className="mt-2 flex flex-wrap items-center gap-2 px-2">
              <ModeButton active={summaryMode === 100} onClick={() => setSummaryMode(100)}>
                100字
              </ModeButton>
              <ModeButton active={summaryMode === 200} onClick={() => setSummaryMode(200)}>
                200字
              </ModeButton>
              <ModeButton active={showCritique} onClick={() => setShowCritique((current) => !current)}>
                批評表示
              </ModeButton>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {trendState.loading ? (
                <LoadingGrid />
              ) : filteredArticles.length > 0 ? (
                filteredArticles.map((article, index) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    rank={index + 1}
                    summaryMode={expandedArticleId === article.id ? 200 : summaryMode}
                    showCritique={showCritique}
                    isFocused={focusedArticleId === article.id}
                    isSaved={savedArticleIds.includes(article.id)}
                    onAction={handleArticleAction}
                    onOpenArticle={handleOpenArticle}
                  />
                ))
              ) : (
                <EmptyState title="記事がありません" description="カテゴリまたは期間を変更してください。" />
              )}
            </div>

            <div id="topic-group-section">
              <SectionLabel>[5] Topic Group</SectionLabel>
              <BoxSection
                title={topicGroupItems.title}
                subtitle="暫定実装です。いまはカード押下でこのセクションへスクロールし、対象トピックを固定表示します。"
              >
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                  <TopicColumn
                    title="動画"
                    tone="bg-[#fef3c7] text-[#92400e]"
                    items={topicGroupItems.items.filter((article) => article.source_type === 'video')}
                  />
                  <TopicColumn
                    title="公式"
                    tone="bg-[#dbeafe] text-[#1e40af]"
                    items={topicGroupItems.items.filter((article) => article.source_type === 'official')}
                  />
                  <TopicColumn
                    title="ブログ"
                    tone="bg-[#d1fae5] text-[#065f46]"
                    items={topicGroupItems.items.filter((article) => article.source_type === 'blog')}
                  />
                </div>
              </BoxSection>
            </div>

            <SectionLabel>[6] 検索結果</SectionLabel>
            <BoxSection
              title="検索 / タグ絞り込み"
              subtitle={
                searchQuery
                  ? `現在の検索語: ${searchQuery} / ${visibleSearchArticles.length}件`
                  : 'Enter または検索ボタンで実行します。'
              }
            >
              <div className="mb-3 mt-2 flex flex-wrap gap-1.5">
                {['LLM', 'Google', 'Agent', 'Coding', 'Security'].map((tag, index) => (
                  <span
                    key={tag}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    style={{
                      background: index === 0 ? 'var(--color-accent-lighter)' : 'var(--color-card-second)',
                      borderColor: 'rgba(0,0,0,0.05)',
                      color: index === 0 ? 'var(--color-accent-darker)' : 'var(--color-ink)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {searchState.loading ? (
                <LoadingGrid compact />
              ) : searchQuery ? (
                visibleSearchArticles.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {visibleSearchArticles.map((article) => (
                      <ArticleCard
                        key={`search-${article.id}`}
                        article={article}
                        summaryMode={expandedArticleId === article.id ? 200 : summaryMode}
                        showCritique={showCritique}
                        isFocused={focusedArticleId === article.id}
                        isSaved={savedArticleIds.includes(article.id)}
                        onAction={handleArticleAction}
                        onOpenArticle={handleOpenArticle}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="該当記事なし" description={searchState.message ?? '検索語またはカテゴリを変更してください。'} />
                )
              ) : (
                <EmptyState title="検索待ち" description="ヘッダーの検索フォームからキーワードを送信してください。" />
              )}
            </BoxSection>

            <SectionLabel>[7] ダイジェスト</SectionLabel>
            <BoxSection title="07:00 朝の AI ダイジェスト" subtitle="共有向けに整理した上位3件">
              <div className="mt-2 flex flex-col gap-2">
                {digestItems.map((item) => (
                  <div key={item.id} className="flex overflow-hidden rounded-[10px] border border-black/5 bg-card-second">
                    <div className="w-[70px] bg-[linear-gradient(145deg,#ffe8d6,#ffd8bd)]" />
                    <div className="flex flex-1 flex-col gap-1 p-2 text-[11px]">
                      <div className="flex gap-2">
                        <span className="text-[18px] font-extrabold text-[#f2dfd0]">{item.digestRank}</span>
                        <span className="font-extrabold leading-[1.3]">{item.title}</span>
                      </div>
                      <p className="text-muted">{item.summary_100 ?? '要約準備中'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </BoxSection>

            <SectionLabel>[8] PWA</SectionLabel>
            <PwaInstallBanner />
          </div>

          <RightSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            unread={savedArticleIds.length}
            topRated={homeStats.topRatedCount}
            savedLater={savedArticleIds.length}
            shareCountLastHour={homeActivity.shareCountLastHour}
            activeArticlesLastHour={homeActivity.activeArticlesLastHour}
            notifTimes={notifTimes}
            onNotifToggle={(index) =>
              setNotifTimes((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, on: !item.on } : item)))
            }
          />
        </section>
      </main>

      {shareTarget ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/10 px-4" onClick={() => setShareTarget(null)}>
          <div
            className="w-full max-w-[560px] rounded-xl border border-black/5 bg-card-second shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <span className="text-[13px] font-extrabold">この記事を共有</span>
              <button type="button" className="text-xl text-muted" onClick={() => setShareTarget(null)}>
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <textarea
                className="min-h-24 rounded-lg border border-black/5 p-2 text-[12px] leading-6 outline-none"
                value={shareText}
                readOnly
              />
              <label className="flex items-center gap-2 text-[11px] text-muted">
                <input
                  type="checkbox"
                  checked={appendAiHubTag}
                  onChange={(event) => {
                    setAppendAiHubTagState(event.target.checked)
                    setShareAppendTag(event.target.checked)
                  }}
                />
                <span>#AIHub タグを URL の後ろに付ける</span>
              </label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <ShareButton label="X" onClick={() => void handleShareAction('x')} />
                <ShareButton label="Threads" onClick={() => void handleShareAction('threads')} />
                <ShareButton label="Slack" onClick={() => void handleShareAction('slack')} />
                <ShareButton label="Misskey" onClick={() => void handleShareAction('misskey')} />
                <ShareButton label="URLをコピー" accent onClick={() => void handleShareAction('copy')} />
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="flex flex-col gap-0.5 rounded-xl bg-white p-2.5">
      <div className="text-[11px] text-subtle">{label}</div>
      <div className="text-[22px] font-extrabold text-ink">{value}</div>
    </article>
  )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-[11px] font-bold"
      style={{
        background: active ? 'var(--color-accent-lighter)' : '#fff',
        color: active ? 'var(--color-accent-darker)' : 'var(--color-subtle)',
        borderColor: active ? '#f4c29a' : 'rgba(0,0,0,0.05)',
      }}
    >
      {children}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-4 inline-block rounded-md bg-[#f2dfd0] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#7a4525]">
      {children}
    </div>
  )
}

function BoxSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mb-2.5 rounded-2xl border border-black/5 bg-transparent p-3.5 shadow-[0_2px_2px_rgba(0,0,0,0.1)]">
      <h2 className="text-[16px] font-extrabold">{title}</h2>
      <p className="mb-2 text-[12px] text-subtle">{subtitle}</p>
      {children}
    </section>
  )
}

function TopicColumn({ title, items, tone }: { title: string; items: UiArticle[]; tone: string }) {
  const item = items[0] ?? null

  return (
    <div className="overflow-hidden rounded-[10px] border border-black/5 bg-card-second">
      <div className={`px-2.5 py-1.5 text-[10px] font-extrabold ${tone}`}>{title}</div>
      <div className="flex flex-col gap-1.5 p-2 text-[11px]">
        <div className="h-[60px] rounded-md bg-[linear-gradient(145deg,#ffe8d6,#ffd8bd)]" />
        <div className="font-extrabold">{item?.title ?? '関連項目を収集中'}</div>
        <div className="text-muted">{item ? `${title} 導線の暫定実装です。` : '最終導線は implementation-wait.md 管理。'}</div>
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-card-second px-5 py-10 text-center text-muted">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[#f2dfd0] text-[11px] font-extrabold text-accent-darker">
        NO
      </div>
      <div className="mb-1 text-[14px] font-extrabold text-ink">{title}</div>
      <div className="text-[11px] leading-5">{description}</div>
    </div>
  )
}

function LoadingGrid({ compact = false }: { compact?: boolean }) {
  const count = compact ? 1 : 2

  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="min-h-[210px] animate-pulse rounded-xl border border-black/5 bg-card-second p-3">
          <div className="flex gap-3">
            <div className="h-[163px] w-[94px] rounded-lg bg-[#f2dfd0]" />
            <div className="flex flex-1 flex-col gap-3">
              <div className="h-4 w-4/5 rounded bg-[#f2dfd0]" />
              <div className="h-3 w-1/2 rounded bg-[#f2dfd0]" />
              <div className="h-3 w-full rounded bg-[#f2dfd0]" />
              <div className="h-3 w-4/5 rounded bg-[#f2dfd0]" />
              <div className="h-3 w-3/5 rounded bg-[#f2dfd0]" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

function ShareButton({ label, accent = false, onClick }: { label: string; accent?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-lg border px-3 py-2 text-[11px] font-bold"
      style={{
        background: accent ? 'var(--color-orange)' : '#fff',
        color: accent ? '#fff' : 'var(--color-ink)',
        borderColor: accent ? 'var(--color-orange)' : 'rgba(0,0,0,0.05)',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
