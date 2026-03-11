const navItems = [
  { id: 'home', label: 'Home Feed', hint: '最初に見る面。探索の起点' },
  { id: 'search', label: 'Search Results', hint: '検索とタグ絞り込み' },
  { id: 'topic', label: 'Topic Group', hint: '同一話題の比較導線' },
  { id: 'digest', label: 'Digest Center', hint: '通知から戻る面' },
  { id: 'saved', label: 'Saved Queue', hint: '後で読む回遊' },
  { id: 'settings', label: 'Preferences', hint: '興味分野と通知設定' },
]

const articles = [
  {
    id: 'gemini',
    title: 'Gemini 2.0 Flash が軽量推論を押し上げる',
    summary100: 'Google が速度と単価を両立。社内導入やサポート用途への組み込みが急に現実的になった。',
    summary300: 'Google が Gemini 2.0 Flash を刷新。低コスト・高速推論を前面に出し、社内導入やサポート用途への組み込みが急に現実的になった。巨大モデルの常時稼働より、軽量モデルを複数箇所に置く設計が再評価されている。',
    critique: '差別化は性能の一点突破より、導入摩擦の低さにある。',
    source: 'Official',
    topic: 'lightweight-models',
    genre: 'LLM',
  },
  {
    id: 'claude',
    title: 'Claude のレビュー用途が実運用で定着し始める',
    summary100: '単発生成よりもレビューと差分整理に強いという評価が増え、開発現場での役割が明確化した。',
    summary300: 'Claude は単発生成よりレビューと差分整理に強いという評価が増え、開発現場での役割が明確化した。コード生成より仕様の穴を拾うレビュアとして置く方が、成果の再現性が高い。',
    critique: 'IDE 補完より、仕様確認の相棒として使う方が UX が安定する。',
    source: 'Blog',
    topic: 'coding-agents',
    genre: 'Coding',
  },
  {
    id: 'agent',
    title: 'Agent 設計は権限制御先行が主流に',
    summary100: 'モデル選定より先にタスク分解と権限制御を決める流れが主流化しつつある。',
    summary300: 'Agent 設計はモデル選定より先にタスク分解と権限制御を決める流れが主流化しつつある。万能 agent を作るより、限定権限の小さな agent をつなぐ構造の方が失敗半径を制御しやすい。',
    critique: '賢さよりも壊れた時の被害範囲が UX に直結する。',
    source: 'News',
    topic: 'coding-agents',
    genre: 'Agent',
  },
]

const topicGroups = {
  'lightweight-models': [
    { source: 'Video', title: 'Gemini 2.0 Flash を触ってみた', note: '速度検証とユースケース' },
    { source: 'Official', title: 'Gemini 2.0 Flash 公式発表', note: '価格とモデル仕様' },
    { source: 'Blog', title: 'Flash と GPT-4o mini を比較', note: '実装コストの見え方' },
  ],
  'coding-agents': [
    { source: 'Video', title: 'Agent 実装の失敗集', note: '権限設計の勘所' },
    { source: 'Official', title: '安全な tool use の原則', note: '監査ログと境界' },
    { source: 'Blog', title: 'Claude をレビュアとして使う', note: '手戻り削減の実例' },
  ],
}

const state = {
  route: 'home',
  selectedArticleId: 'gemini',
  searchQuery: '',
  shareTag: true,
  misskeyInstance: 'misskey.io',
  saved: ['claude'],
  flowLog: [
    { title: 'Mock2 loaded', detail: 'Home から導線確認を開始', when: 'now' },
  ],
}

const routeMeta = {
  home: 'Feed → 300字 → Share / Topic Group へ分岐する起点面',
  search: '検索起点で回遊する導線。結果から Topic Group / Share へ進む',
  topic: '同一話題の比較。動画 / 公式 / ブログの読み分け導線',
  digest: '通知クリックから戻る面。共有と保存へ最短で戻れる',
  saved: '後で読むストック面。再開と比較の導線',
  settings: '興味分野、通知、共有設定の確認面',
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

function selectedArticle() {
  return articles.find((item) => item.id === state.selectedArticleId) ?? articles[0]
}

function logFlow(title, detail) {
  state.flowLog.unshift({ title, detail, when: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) })
  renderFlowLog()
}

function setRoute(route, detail) {
  state.route = route
  if (detail) logFlow(`Route → ${route}`, detail)
  render()
}

function openArticle(articleId, reason) {
  state.selectedArticleId = articleId
  logFlow('Open 300 summary', `${reason}: ${articles.find((item) => item.id === articleId).title}`)
  renderContext()
}

function openShare(articleId, from) {
  state.selectedArticleId = articleId
  shareModal.classList.remove('hidden')
  refreshShareText()
  logFlow('Share composer', `${from} から共有ポップアップを起動`)
}

function refreshShareText() {
  const article = selectedArticle()
  shareText.value = [article.title, article.summary100, state.shareTag ? `https://aitrendhub.mock/${article.id}\n#AIHub` : `https://aitrendhub.mock/${article.id}`].join('\n\n')
}

function renderNav() {
  navRoot.innerHTML = navItems.map((item) => `
    <button class="${state.route === item.id ? 'active' : ''}" data-nav="${item.id}">
      <span>
        <strong>${item.label}</strong>
        <small>${item.hint}</small>
      </span>
      <span>→</span>
    </button>
  `).join('')
}

function renderHome() {
  return `
    <section class="kpi-row">
      ${['本日の新着 36', '通知クリック率 18%', '保存キュー 12', 'Topic Group 遷移 9'].map((item) => `
        <article class="kpi"><p class="eyebrow">Signal</p><strong>${item}</strong></article>
      `).join('')}
    </section>
    <section class="summary-card">
      <p class="eyebrow">Recommended Flow</p>
      <strong>Home → 300字 → Share / Topic Group → Saved / Digest へ戻る</strong>
      <span>一覧を見ながら、「いま価値が伝わる共有」と「比較して理解する遷移」を最短で往復できる構成。</span>
    </section>
    <section class="flow-cards">
      ${articles.map((article) => `
        <article class="feed-card">
          <div class="thumb"></div>
          <div>
            <div class="feed-head">
              <div>
                <p class="eyebrow">${article.source} · ${article.genre}</p>
                <h3>${article.title}</h3>
              </div>
              <button class="pill ghost" data-route="topic" data-topic="${article.topic}">Topic Group</button>
            </div>
            <p>${article.summary100}</p>
            <div class="pill-row">
              <button class="pill" data-open-summary="${article.id}">300字を開く</button>
              <button class="pill strong" data-share="${article.id}">共有</button>
              <button class="pill ghost" data-save="${article.id}">${state.saved.includes(article.id) ? '保存済み' : '保存'}</button>
              <button class="pill ghost" data-external="${article.id}">元記事へ</button>
            </div>
          </div>
        </article>
      `).join('')}
    </section>
  `
}

function renderSearch() {
  const query = state.searchQuery || 'Gemini'
  const results = articles.filter((article) => article.title.includes(query) || article.genre.includes(query))
  return `
    <section class="summary-card">
      <p class="eyebrow">Search Intent</p>
      <strong>検索語「${query}」に対して、結果から Topic Group と Share に流す</strong>
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
          <div>
            <p class="eyebrow">${article.genre}</p>
            <h3>${article.title}</h3>
            <p>${article.summary100}</p>
            <div class="pill-row">
              <button class="pill" data-open-summary="${article.id}">300字</button>
              <button class="pill strong" data-share="${article.id}">共有</button>
              <button class="pill ghost" data-route="topic" data-topic="${article.topic}">Topic Group</button>
            </div>
          </div>
        </article>
      `).join('')}
    </section>
  `
}

function renderTopic() {
  const article = selectedArticle()
  const group = topicGroups[article.topic] || []
  return `
    <section class="summary-card">
      <p class="eyebrow">Topic Group</p>
      <strong>${article.title}</strong>
      <span>ここでは「どの情報源で理解するか」を選ばせる。Home へ戻るより、比較を終えてから戻る構成。</span>
    </section>
    <section class="digest-grid">
      ${group.map((item) => `
        <article class="topic-card">
          <div class="topic-thumb"></div>
          <p class="eyebrow">${item.source}</p>
          <h3>${item.title}</h3>
          <p>${item.note}</p>
          <div class="pill-row">
            <button class="pill" data-open-summary="${article.id}">300字</button>
            <button class="pill strong" data-share="${article.id}">共有</button>
            <button class="pill ghost" data-route="home">Feedへ戻る</button>
          </div>
        </article>
      `).join('')}
    </section>
  `
}

function renderDigest() {
  return `
    <section class="summary-card">
      <p class="eyebrow">07:00 Digest</p>
      <strong>通知クリック後の受け皿は、一覧ではなく「次の行動が早いまとめ面」にする</strong>
      <span>各カードから 300字 / Share / Save へ直接流す。</span>
    </section>
    <section class="digest-grid">
      ${articles.map((article, index) => `
        <article class="timeline-card">
          <p class="eyebrow">#${index + 1}</p>
          <h3>${article.title}</h3>
          <p>${article.summary100}</p>
          <div class="pill-row">
            <button class="pill" data-open-summary="${article.id}">300字</button>
            <button class="pill strong" data-share="${article.id}">共有</button>
            <button class="pill ghost" data-save="${article.id}">${state.saved.includes(article.id) ? '保存済み' : '保存'}</button>
          </div>
        </article>
      `).join('')}
    </section>
  `
}

function renderSaved() {
  const savedItems = articles.filter((article) => state.saved.includes(article.id))
  return `
    <section class="summary-card">
      <p class="eyebrow">Saved Queue</p>
      <strong>保存から再開した時に、どこへ戻るかを明確にする</strong>
      <span>保存面から 300字 → Topic Group → Share の順で再開できる。</span>
    </section>
    <section class="saved-grid">
      ${savedItems.map((article) => `
        <article class="saved-card">
          <p class="eyebrow">${article.genre}</p>
          <h3>${article.title}</h3>
          <p>${article.summary100}</p>
          <div class="pill-row">
            <button class="pill" data-open-summary="${article.id}">300字</button>
            <button class="pill ghost" data-route="topic" data-topic="${article.topic}">Topic Group</button>
            <button class="pill strong" data-share="${article.id}">共有</button>
          </div>
        </article>
      `).join('')}
    </section>
  `
}

function renderSettings() {
  return `
    <section class="summary-card">
      <p class="eyebrow">Preferences</p>
      <strong>設定面は「編集する」より「配信面にどう効くか」を見せる</strong>
      <span>通知や興味分野を変更した結果、Digest に何が届くかを近い位置で確認する。</span>
    </section>
    <section class="settings-grid">
      <article class="setting-card">
        <p class="eyebrow">Interest Pack</p>
        <h3>興味分野</h3>
        <div class="chip-row">
          <span class="pill">LLM</span><span class="pill">Agent</span><span class="pill ghost">Voice</span><span class="pill ghost">Safety</span>
        </div>
      </article>
      <article class="setting-card">
        <p class="eyebrow">Notification</p>
        <h3>07:00 / 12:00 / 18:00</h3>
        <p>日刊上位3件、または興味分野加重ランキング案を比較中。</p>
        <div class="pill-row"><button class="pill" data-route="digest">Digest を確認</button></div>
      </article>
    </section>
  `
}

function renderContext() {
  const article = selectedArticle()
  contextRoot.innerHTML = `
    <div class="summary-card">
      <p class="eyebrow">300 Summary</p>
      <strong>${article.title}</strong>
      <p>${article.summary300}</p>
      <p class="eyebrow">Critique</p>
      <p>${article.critique}</p>
      <div class="pill-row">
        <button class="pill strong" data-share="${article.id}">共有</button>
        <button class="pill ghost" data-route="topic" data-topic="${article.topic}">Topic Group</button>
      </div>
    </div>
  `
}

function renderFlowLog() {
  flowLog.innerHTML = state.flowLog.map((item) => `
    <div class="log-item">
      <strong>${item.title}</strong>
      <div>${item.detail}</div>
      <small>${item.when}</small>
    </div>
  `).join('')
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
  const target = event.target.closest('[data-nav],[data-route],[data-open-summary],[data-share],[data-save],[data-external]')
  if (!target) return

  if (target.dataset.nav) {
    setRoute(target.dataset.nav, '左ナビゲーションから遷移')
    return
  }

  if (target.dataset.route) {
    if (target.dataset.topic) {
      const article = articles.find((item) => item.topic === target.dataset.topic)
      if (article) state.selectedArticleId = article.id
    }
    setRoute(target.dataset.route, '導線ボタンから遷移')
    return
  }

  if (target.dataset.openSummary) {
    openArticle(target.dataset.openSummary, 'カード内 CTA')
    return
  }

  if (target.dataset.share) {
    openShare(target.dataset.share, 'カードまたは右コンテキスト')
    return
  }

  if (target.dataset.save) {
    const id = target.dataset.save
    if (state.saved.includes(id)) {
      state.saved = state.saved.filter((item) => item !== id)
      logFlow('Save removed', '保存キューから外した')
    } else {
      state.saved.push(id)
      logFlow('Save added', '保存キューへ追加')
    }
    render()
    return
  }

  if (target.dataset.external) {
    logFlow('External source', '元記事へ遷移する想定')
  }
})

document.getElementById('close-share').addEventListener('click', () => shareModal.classList.add('hidden'))
shareModal.addEventListener('click', (event) => {
  if (event.target === shareModal) shareModal.classList.add('hidden')
})

shareTagToggle.addEventListener('change', (event) => {
  state.shareTag = event.target.checked
  refreshShareText()
  logFlow('Share setting', `#AIHub ${state.shareTag ? 'on' : 'off'}`)
})

document.querySelectorAll('[data-share]').forEach(() => {})
document.querySelector('.share-grid').addEventListener('click', (event) => {
  const target = event.target.closest('[data-share]')
  if (!target) return
  logFlow('Share action', `${target.dataset.share} の投稿導線を確認`)
})

document.getElementById('save-misskey').addEventListener('click', () => {
  state.misskeyInstance = misskeyInput.value
  logFlow('Misskey saved', `${state.misskeyInstance} を共有先として保持`)
})

document.getElementById('search-submit').addEventListener('click', () => {
  state.searchQuery = document.getElementById('global-search').value.trim() || 'Gemini'
  setRoute('search', `グローバル検索から「${state.searchQuery}」へ`)
})

document.getElementById('open-digest').addEventListener('click', () => {
  setRoute('digest', 'ダイジェスト CTA から遷移')
})

render()
