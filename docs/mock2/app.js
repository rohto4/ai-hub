const navItems = [
  { id: 'home', label: 'Home Feed', hint: 'いま追うべき記事を起点に回遊する' },
  { id: 'search', label: 'Search Results', hint: '検索から比較して絞り込む' },
  { id: 'topic', label: 'Topic Group', hint: '類似トピックをまとめて確認する' },
  { id: 'digest', label: 'Digest Center', hint: '短時間で消化する朝昼夕の確認導線' },
  { id: 'saved', label: 'Saved Queue', hint: '保存と後で見るを整理する' },
  { id: 'settings', label: 'Preferences', hint: '通知と表示モードを管理する' },
]

const articles = [
  {
    id: 'gemini',
    title: 'Gemini 2.0 Flash が軽量モデルの実運用ラインを押し上げる',
    summary100: 'Google が低遅延と扱いやすさを前面に出した新モデルを紹介。社内ツールや要約系ワークフローへの展開が見えやすい。',
    summary300: 'Google は Gemini 2.0 Flash を新たに打ち出し、速度とコスト効率を重視する現場向けの選択肢として訴求している。要約、分類、社内検索補助のような日常業務に寄せた使い方が見えやすく、巨大モデルに寄せすぎない設計が印象的。比較対象として GPT-4o mini や既存 Flash 系をどう位置付けるかで、導入判断の粒度が変わる。',
    critique: '性能だけでなく、どの業務に刺さるのかを一目で示す比較導線が重要。',
    source: 'Official',
    genre: 'LLM',
    topic: 'lightweight-models',
    url: 'https://example.com/gemini-flash',
  },
  {
    id: 'claude',
    title: 'Claude のレビュー活用が実務の初期確認フローに入り始める',
    summary100: 'レビュー用途の利用が広がり、実装前の見落とし確認や論点整理に強いという評価が増えている。',
    summary300: 'Claude は実装支援だけでなく、レビューや論点整理の相棒として使われる場面が増えている。特に初期設計の粗を拾う用途や、実装前に危険な前提を洗い出す用途で評価が高い。一方で IDE 統合やチーム運用の流れに自然に溶け込ませないと、単発の壁打ちで終わりやすい。導入時はレビュー観点のテンプレート化が鍵になる。',
    critique: '使いどころの明確化と、チーム運用へ落とす導線設計が必要。',
    source: 'Blog',
    genre: 'Coding',
    topic: 'coding-agents',
    url: 'https://example.com/claude-review',
  },
  {
    id: 'agent',
    title: 'Agent 設計の評価軸が単機能実演から運用耐性に移る',
    summary100: '派手なデモより、失敗時の復旧や権限境界を含めた運用設計が議論の中心に寄ってきた。',
    summary300: 'Agent 設計では、タスク完遂率だけでなく、失敗時の復旧性、権限の境界、監査性といった運用寄りの論点が前面に出てきた。単発の成功デモよりも、長時間運用での安定性と責務分離が評価される流れが強い。結果として、ツール呼び出しの見える化や、人間が途中介入できる UI 導線の質がより重要になっている。',
    critique: 'UX だけでなく、運用上の安全性を見える形で置く必要がある。',
    source: 'News',
    genre: 'Agent',
    topic: 'coding-agents',
    url: 'https://example.com/agent-ops',
  },
]

const topicGroups = {
  'lightweight-models': [
    {
      id: 'gemini-video',
      source: 'Video',
      genre: 'Explainer',
      title: 'Gemini 2.0 Flash を試してわかった向き不向き',
      summary100: '導入のしやすさとユースケースの広さを実演中心で整理している。',
      summary300: 'Gemini 2.0 Flash を実際に使いながら、速度感、手元タスクでの精度、どの用途に向くかを確認する内容。公式情報だけでは見えにくい、運用時のクセや相性の良い仕事がつかみやすい。短時間で感触を掴みたい人向けの補助線として機能する。',
      critique: '一次情報の補助としては強いが、比較条件の揃え方は別途確認したい。',
      note: '動画で速度感と要約精度を比較している。',
      url: 'https://example.com/gemini-video',
      topic: 'lightweight-models',
    },
    {
      id: 'gemini-official',
      source: 'Official',
      genre: 'Release',
      title: 'Gemini 2.0 Flash 公式発表',
      summary100: '性能レンジ、用途、API での扱い方が簡潔にまとまっている。',
      summary300: 'Gemini 2.0 Flash の公式発表で、想定ユースケース、性能レンジ、API での扱い方がまとまっている。実装側が事実関係を確認するための起点に向いており、比較記事を読む前に押さえておくと全体像がぶれにくい。',
      critique: '位置づけ確認には最適だが、実運用の癖までは別ソースで補う必要がある。',
      note: '仕様と位置づけを押さえる一次情報。',
      url: 'https://example.com/gemini-release',
      topic: 'lightweight-models',
    },
    {
      id: 'gemini-compare',
      source: 'Blog',
      genre: 'Compare',
      title: 'Flash と GPT-4o mini を比較して運用コストをみる',
      summary100: '比較軸をコストと安定運用に寄せていて判断しやすい。',
      summary300: 'Flash と GPT-4o mini を、単純な性能勝負ではなく、コスト、安定運用、日常タスクへの落とし込みやすさで比較している。導入判断の現実的な論点が並んでおり、実務でどちらを優先するかの整理に向く。',
      critique: '前提条件が自チームと合うかどうかを見ながら読む必要がある。',
      note: '日常運用向けの比較観点が多い。',
      url: 'https://example.com/gemini-compare',
      topic: 'lightweight-models',
    },
  ],
  'coding-agents': [
    {
      id: 'agent-video',
      source: 'Video',
      genre: 'Explainer',
      title: 'Agent 実装の失敗パターンを分解する',
      summary100: '権限と復旧導線の設計を中心に整理している。',
      summary300: 'Agent 実装で起こりやすい失敗を、権限境界、失敗時復旧、人間の介入ポイントの観点で分解している。デモでは見えにくい運用論点を先に掴めるため、導入前の危険予知に向いている。',
      critique: '抽象度はやや高めなので、自分のプロダクトへ写像しながら読む必要がある。',
      note: '失敗時の介入ポイントに焦点を当てている。',
      url: 'https://example.com/agent-video',
      topic: 'coding-agents',
    },
    {
      id: 'agent-official',
      source: 'Official',
      genre: 'Guide',
      title: '安全な tool use の設計指針',
      summary100: '実行境界と検証ステップの設計が具体的に説明されている。',
      summary300: '安全な tool use のために、実行境界、確認ステップ、権限管理、監査性をどう設計するかを具体的に説明している。Agent 系の導入を設計から見直す時の基準線になりやすい一次情報。',
      critique: '原則は強いが、UI 側でどう見せるかは別途補完が要る。',
      note: '運用設計の原則を確認する一次情報。',
      url: 'https://example.com/agent-guide',
      topic: 'coding-agents',
    },
    {
      id: 'agent-blog',
      source: 'Blog',
      genre: 'Case',
      title: 'Claude をレビュー役として使うチーム運用',
      summary100: '設計確認の導線にレビュー AI をどう差し込むかが整理されている。',
      summary300: 'Claude をレビュー役として差し込み、設計確認や実装前レビューを回している事例。個人の壁打ちで終わらせず、チームの確認導線に落とし込むためのルール設計が中心で、導入初期の参考にしやすい。',
      critique: 'チーム文化に依存する要素も大きく、丸ごと真似はしにくい。',
      note: '導入時のルール作りが見えるケーススタディ。',
      url: 'https://example.com/agent-blog',
      topic: 'coding-agents',
    },
  ],
}

const state = {
  route: 'home',
  selectedArticleId: 'gemini',
  selectedTopic: 'lightweight-models',
  searchQuery: '',
  shareTag: true,
  misskeyInstance: 'misskey.io',
  saved: ['claude'],
  later: ['agent'],
  digestMode: 'consume',
  digestSeen: [],
  digestDate: todayKey(),
  flowLog: [
    { title: 'Mock2 loaded', detail: 'Home Feed から導線確認を開始', when: 'now' },
  ],
}

const relatedArticles = Object.values(topicGroups).flat()
const articleIndex = [...articles, ...relatedArticles]

const routeMeta = {
  home: 'Feed 起点で 300文字、元記事、共有、保存、後で見る、類似トピックへ進む。',
  search: '検索結果でも Home と同じ操作配置で比較と回遊を続ける。',
  topic: '類似トピックを見る画面で一次情報と比較記事を横断する。',
  digest: '既読で減っていくモードを既定にし、残すモードへ切り替えもできる。',
  saved: '保存と後で見るを分けて再訪しやすくする。',
  settings: '通知、Digest 表示、共有設定をまとめて確認する。',
}

const root = document.getElementById('view-root')
const contextRoot = document.getElementById('context-root')
const routeTitle = document.getElementById('route-title')
const routeMetaNode = document.getElementById('route-meta')
const navRoot = document.getElementById('global-nav')
const flowLog = document.getElementById('flow-log')
const shareModal = document.getElementById('share-modal')
const shareText = document.getElementById('share-text')
const shareTagToggle = document.getElementById('share-tag-toggle')
const misskeyInput = document.getElementById('misskey-instance')

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function syncDigestDate() {
  const current = todayKey()
  if (state.digestDate !== current) {
    state.digestDate = current
    state.digestSeen = []
    logFlow('Digest reset', '日付変更により既読状態をリセット')
  }
}

function selectedArticle() {
  return articleIndex.find((item) => item.id === state.selectedArticleId) ?? articles[0]
}

function articleById(articleId) {
  return articleIndex.find((item) => item.id === articleId)
}

function articleFromTopic(topicId) {
  return articles.find((item) => item.topic === topicId) ?? articles[0]
}

function currentTopicItems() {
  return topicGroups[state.selectedTopic] ?? []
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function logFlow(title, detail) {
  state.flowLog.unshift({
    title,
    detail,
    when: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
  })
  renderFlowLog()
}

function setRoute(route, detail) {
  syncDigestDate()
  state.route = route
  if (detail) logFlow(`Route → ${navItems.find((item) => item.id === route).label}`, detail)
  render()
}

function openSummary(articleId, reason) {
  const article = articleById(articleId)
  if (!article) return
  state.selectedArticleId = articleId
  state.selectedTopic = article.topic
  logFlow('Open 300文字', `${reason}: ${article.title}`)
  renderContext()
}

function openSource(articleId, reason) {
  const article = articleById(articleId)
  if (!article) return
  state.selectedArticleId = articleId
  state.selectedTopic = article.topic
  logFlow('元記事を開く', `${reason}: ${article.title}`)
  renderContext()
}

function openTopic(topicId, reason) {
  const baseArticle = articleFromTopic(topicId)
  state.selectedTopic = topicId
  state.selectedArticleId = baseArticle.id
  setRoute('topic', reason)
}

function openShare(articleId, from) {
  const article = articleById(articleId)
  if (!article) return
  state.selectedArticleId = articleId
  state.selectedTopic = article.topic
  shareModal.classList.remove('hidden')
  refreshShareText()
  logFlow('共有を開く', `${from}: ${article.title}`)
}

function refreshShareText() {
  const article = selectedArticle()
  shareText.value = [
    article.title,
    article.summary100,
    state.shareTag ? `${article.url}\n#AIHub` : article.url,
  ].join('\n\n')
}

function toggleList(key, articleId, addLabel, removeLabel) {
  if (state[key].includes(articleId)) {
    state[key] = state[key].filter((item) => item !== articleId)
    logFlow(removeLabel, `${articleById(articleId).title} を一覧から外した`)
  } else {
    state[key] = [...state[key], articleId]
    logFlow(addLabel, `${articleById(articleId).title} を一覧へ追加`)
  }
  render()
}

function markDigestSeen(articleId) {
  syncDigestDate()
  if (state.digestMode !== 'consume') return
  if (!state.digestSeen.includes(articleId)) {
    state.digestSeen = [...state.digestSeen, articleId]
    logFlow('Digest consumed', `${articleById(articleId).title} を既読にした`)
    render()
  }
}

function digestArticles() {
  syncDigestDate()
  return state.digestMode === 'consume'
    ? articles.filter((article) => !state.digestSeen.includes(article.id))
    : articles
}

function renderNav() {
  navRoot.innerHTML = navItems
    .map(
      (item) => `
        <button class="${state.route === item.id ? 'active' : ''}" data-nav="${item.id}">
          <span>
            <strong>${item.label}</strong>
            <small>${item.hint}</small>
          </span>
          <span>→</span>
        </button>
      `
    )
    .join('')
}

function renderCardActions(article, options = {}) {
  const sourceLabel = options.sourceLabel ?? '元記事を開く'
  const summaryLabel = options.summaryLabel ?? '300文字開く'
  const shareLabel = options.shareLabel ?? '共有'

  return `
    <div class="card-actions">
      <div class="card-actions-left">
        <div class="action-row action-row-primary">
          <button class="pill strong" data-open-source="${article.id}">${sourceLabel}</button>
          <button class="pill ghost" data-open-summary="${article.id}">${summaryLabel}</button>
        </div>
        <div class="action-row action-row-secondary">
          <button class="pill ghost" data-save="${article.id}">${state.saved.includes(article.id) ? '保存済み' : '保存'}</button>
          <button class="pill ghost" data-later="${article.id}">${state.later.includes(article.id) ? '後で見る済み' : '後で見る'}</button>
        </div>
      </div>
      <button class="pill strong share-pill" data-share="${article.id}">
        <span class="share-icon" aria-hidden="true">⤴</span>
        <span>${shareLabel}</span>
      </button>
    </div>
  `
}

function renderHome() {
  return `
    <section class="kpi-row">
      ${['本日の新着 36', 'Digest 完了率 18%', '保存 12', '類似トピック 9'].map(
        (item) => `
          <article class="kpi"><p class="eyebrow">Signal</p><strong>${item}</strong></article>
        `
      ).join('')}
    </section>
    <section class="summary-card">
      <p class="eyebrow">Recommended Flow</p>
      <strong>Home から元記事を開く、300文字で理解する、共有する、保存する、類似トピックを見る。</strong>
      <span>主要導線をカード内で完結させつつ、右ペインで 300 文字と批評を維持して全体の行き来を速くする。</span>
    </section>
    <section class="flow-cards">
      ${articles.map((article) => `
        <article class="feed-card">
          <div class="thumb"></div>
          <div class="feed-body">
            <div class="feed-head">
              <div>
                <p class="eyebrow">${article.source} · ${article.genre}</p>
                <h3>${article.title}</h3>
              </div>
              <button class="pill ghost" data-route="topic" data-topic="${article.topic}">類似トピックを見る</button>
            </div>
            <p>${article.summary100}</p>
            ${renderCardActions(article)}
          </div>
        </article>
      `).join('')}
    </section>
  `
}

function renderSearch() {
  const query = state.searchQuery || 'Gemini'
  const results = articles.filter(
    (article) => article.title.includes(query) || article.genre.includes(query)
  )

  return `
    <section class="summary-card">
      <p class="eyebrow">Search Intent</p>
      <strong>「${escapeHtml(query)}」に関連する記事を同一操作配置で比較する。</strong>
      <div class="chip-row">
        <span class="pill">LLM</span>
        <span class="pill ghost">Agent</span>
        <span class="pill ghost">Safety</span>
        <span class="pill ghost">Coding</span>
      </div>
    </section>
    <section class="flow-cards">
      ${results.map((article) => `
        <article class="feed-card">
          <div class="thumb"></div>
          <div class="feed-body">
            <div class="feed-head">
              <div>
                <p class="eyebrow">${article.source} · ${article.genre}</p>
                <h3>${article.title}</h3>
              </div>
              <button class="pill ghost" data-route="topic" data-topic="${article.topic}">類似トピックを見る</button>
            </div>
            <p>${article.summary100}</p>
            ${renderCardActions(article)}
          </div>
        </article>
      `).join('')}
      ${results.length === 0 ? `
        <article class="summary-card empty-state">
          <p class="eyebrow">No Results</p>
          <strong>検索結果がないので Home Feed から再探索する。</strong>
          <button class="pill strong" data-route="home">Home Feed を見る</button>
        </article>
      ` : ''}
    </section>
  `
}

function renderTopic() {
  const article = articleFromTopic(state.selectedTopic)
  const group = currentTopicItems()

  return `
    <section class="summary-card topic-summary">
      <p class="eyebrow">類似トピックを見る</p>
      <strong>${article.title}</strong>
      <span>同じ文脈の記事を比較しながら、一次情報と解説の往復をしやすくする。</span>
      <div class="topic-summary-actions">
        <button class="pill ghost" data-route="home">Feedへ戻る</button>
      </div>
    </section>
    <section class="digest-grid">
      ${group.map((item) => `
        <article class="topic-card">
          <div class="topic-thumb"></div>
          <div class="feed-body">
            <div class="feed-head">
              <div>
                <p class="eyebrow">${item.source} · ${item.genre}</p>
                <h3>${item.title}</h3>
              </div>
            </div>
            <p>${item.summary100}</p>
            <p class="topic-note">${item.note}</p>
            ${renderCardActions(item, { sourceLabel: '元記事を開く', summaryLabel: '300文字開く' })}
          </div>
        </article>
      `).join('')}
    </section>
  `
}

function renderDigest() {
  const modeLabel = state.digestMode === 'consume' ? '既読で減っていく' : '残り続ける'
  const items = digestArticles()

  return `
    <section class="summary-card">
      <p class="eyebrow">07:00 Digest</p>
      <strong>既定は「見ると記事が減っていく」モード。必要なら残り続けるモードへ切り替える。</strong>
      <div class="digest-toolbar">
        <button class="pill ${state.digestMode === 'consume' ? 'strong' : 'ghost'}" data-digest-mode="consume">既読で減っていく</button>
        <button class="pill ${state.digestMode === 'keep' ? 'strong' : 'ghost'}" data-digest-mode="keep">残り続ける</button>
        <span class="eyebrow">日付変更で既読はリセット: ${state.digestDate}</span>
      </div>
      <span>現在の表示モード: ${modeLabel} / 残り ${items.length} 件</span>
    </section>
    <section class="digest-grid">
      ${items.map((article, index) => `
        <article class="timeline-card">
          <p class="eyebrow">#${index + 1}</p>
          <h3>${article.title}</h3>
          <p>${article.summary100}</p>
          ${renderCardActions(article)}
        </article>
      `).join('')}
      ${items.length === 0 ? `
        <article class="summary-card empty-state">
          <p class="eyebrow">Digest Complete</p>
          <strong>この時間帯の Digest は読み切った。</strong>
          <span>日付をまたぐと自動でリセットされる。残り続けるモードに切り替えると全件を再表示できる。</span>
          <button class="pill ghost" data-digest-mode="keep">残り続けるモードで見直す</button>
        </article>
      ` : ''}
    </section>
  `
}

function renderSaved() {
  const savedItems = articleIndex.filter((article) => state.saved.includes(article.id))
  const laterItems = articleIndex.filter((article) => state.later.includes(article.id))

  return `
    <section class="summary-card">
      <p class="eyebrow">Saved Queue</p>
      <strong>保存と後で見るを分けておき、用途別に再訪しやすくする。</strong>
      <span>保存は残したい記事、後で見るは消化待ちの一時置き場として扱う。</span>
    </section>
    <section class="saved-sections">
      <div>
        <div class="section-head">
          <h2>保存</h2>
          <span class="eyebrow">${savedItems.length} items</span>
        </div>
        <div class="saved-grid">
          ${savedItems.map((article) => `
            <article class="saved-card">
              <p class="eyebrow">${article.genre}</p>
              <h3>${article.title}</h3>
              <p>${article.summary100}</p>
              ${renderCardActions(article)}
            </article>
          `).join('')}
        </div>
      </div>
      <div>
        <div class="section-head">
          <h2>後で見る</h2>
          <span class="eyebrow">${laterItems.length} items</span>
        </div>
        <div class="saved-grid">
          ${laterItems.map((article) => `
            <article class="saved-card">
              <p class="eyebrow">${article.genre}</p>
              <h3>${article.title}</h3>
              <p>${article.summary100}</p>
              ${renderCardActions(article)}
            </article>
          `).join('')}
        </div>
      </div>
    </section>
  `
}

function renderSettings() {
  return `
    <section class="summary-card">
      <p class="eyebrow">Preferences</p>
      <strong>通知、Digest、共有導線の設定を 1 画面で把握する。</strong>
      <span>Digest の既読モードはここでも確認でき、共有タグや配信時間の想定も見える。</span>
    </section>
    <section class="settings-grid">
      <article class="setting-card">
        <p class="eyebrow">Interest Pack</p>
        <h3>興味分野</h3>
        <div class="chip-row">
          <span class="pill">LLM</span>
          <span class="pill">Agent</span>
          <span class="pill ghost">Voice</span>
          <span class="pill ghost">Safety</span>
        </div>
      </article>
      <article class="setting-card">
        <p class="eyebrow">Digest Mode</p>
        <h3>${state.digestMode === 'consume' ? '既読で減っていく' : '残り続ける'}</h3>
        <p>日付変更で既読状態をリセットし、次の日はまたゼロから確認できる。</p>
        <div class="pill-row">
          <button class="pill ${state.digestMode === 'consume' ? 'strong' : 'ghost'}" data-digest-mode="consume">既読で減っていく</button>
          <button class="pill ${state.digestMode === 'keep' ? 'strong' : 'ghost'}" data-digest-mode="keep">残り続ける</button>
        </div>
      </article>
    </section>
  `
}

function renderContext() {
  const article = selectedArticle()
  contextRoot.innerHTML = `
    <div class="summary-card">
      <p class="eyebrow">Focused Article</p>
      <strong>${article.title}</strong>
      <p>${article.summary300}</p>
      <p class="eyebrow">Critique</p>
      <p>${article.critique}</p>
      <div class="pill-row">
        <button class="pill strong" data-open-source="${article.id}">元記事を開く</button>
        <button class="pill ghost" data-route="topic" data-topic="${article.topic}">類似トピックを見る</button>
      </div>
    </div>
  `
}

function renderFlowLog() {
  flowLog.innerHTML = state.flowLog
    .map(
      (item) => `
        <div class="log-item">
          <strong>${item.title}</strong>
          <div>${item.detail}</div>
          <small>${item.when}</small>
        </div>
      `
    )
    .join('')
}

function render() {
  renderNav()
  routeTitle.textContent = navItems.find((item) => item.id === state.route).label
  routeMetaNode.innerHTML = `<span>${routeMeta[state.route]}</span><span class="pill ghost">${state.route}</span>`

  const viewByRoute = {
    home: renderHome,
    search: renderSearch,
    topic: renderTopic,
    digest: renderDigest,
    saved: renderSaved,
    settings: renderSettings,
  }

  root.innerHTML = viewByRoute[state.route]()
  renderContext()
  renderFlowLog()
}

document.addEventListener('click', (event) => {
  const target = event.target.closest(
    '[data-nav],[data-route],[data-open-summary],[data-open-source],[data-share],[data-save],[data-later],[data-digest-mode]'
  )

  if (!target) return

  if (target.dataset.nav) {
    setRoute(target.dataset.nav, 'グローバルナビゲーションから移動')
    return
  }

  if (target.dataset.route) {
    if (target.dataset.topic) {
      openTopic(target.dataset.topic, 'カードから類似トピックへ移動')
      return
    }
    setRoute(target.dataset.route, '画面内 CTA から移動')
    return
  }

  if (target.dataset.openSummary) {
    openSummary(target.dataset.openSummary, 'カード操作')
    if (state.route === 'digest') markDigestSeen(target.dataset.openSummary)
    return
  }

  if (target.dataset.openSource) {
    openSource(target.dataset.openSource, 'カード操作')
    if (state.route === 'digest') markDigestSeen(target.dataset.openSource)
    return
  }

  if (target.dataset.share) {
    openShare(target.dataset.share, 'カード操作')
    if (state.route === 'digest') markDigestSeen(target.dataset.share)
    return
  }

  if (target.dataset.save) {
    toggleList('saved', target.dataset.save, '保存に追加', '保存から削除')
    return
  }

  if (target.dataset.later) {
    toggleList('later', target.dataset.later, '後で見るに追加', '後で見るから削除')
    return
  }

  if (target.dataset.digestMode) {
    state.digestMode = target.dataset.digestMode
    logFlow('Digest mode', `${state.digestMode === 'consume' ? '既読で減っていく' : '残り続ける'} に切替`)
    render()
  }
})

document.getElementById('close-share').addEventListener('click', () => {
  shareModal.classList.add('hidden')
})

shareModal.addEventListener('click', (event) => {
  if (event.target === shareModal) shareModal.classList.add('hidden')
})

shareTagToggle.addEventListener('change', (event) => {
  state.shareTag = event.target.checked
  refreshShareText()
  logFlow('Share setting', `#AIHub ${state.shareTag ? 'on' : 'off'}`)
})

document.querySelector('.share-grid').addEventListener('click', (event) => {
  const target = event.target.closest('[data-share-target]')
  if (!target) return
  logFlow('Share action', `${target.dataset.shareTarget} へ共有`)
})

document.getElementById('save-misskey').addEventListener('click', () => {
  state.misskeyInstance = misskeyInput.value
  logFlow('Misskey saved', `${state.misskeyInstance} を保存`)
})

document.getElementById('search-submit').addEventListener('click', () => {
  state.searchQuery = document.getElementById('global-search').value.trim() || 'Gemini'
  setRoute('search', `グローバル検索で「${state.searchQuery}」を実行`)
})

document.getElementById('open-digest').addEventListener('click', () => {
  setRoute('digest', 'トップバーの Digest CTA から移動')
})

render()
