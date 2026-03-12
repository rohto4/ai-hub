const navItems = [
  { id: "feed", label: "Public Feed", hint: "layer4 の公開記事を見る" },
  { id: "sources", label: "Related Sources", hint: "代表ソースと関連ソースを見る" },
  { id: "tags", label: "Tag Radar", hint: "タグマスタと新語候補を見る" },
  { id: "ops", label: "Ops Queue", hint: "即時反映キューを見る" },
  { id: "digest", label: "Digest", hint: "ランキング上位の再構成を見る" },
];

const publicArticles = [
  mkArticle("gemini-flash", "Gemini 2.0 Flash が軽量モデル更新を公開", "Google が軽量モデルの更新内容を公開し、実装者向けの差分確認がしやすくなった。", "Google は Gemini 2.0 Flash を軽量モデルとして整理し直し、速度とコストの見直しを行った。評価条件や想定利用シーンも明示され、実装者は用途ごとの選定材料を得やすくなった。", ["llm", "lightweight-model", "google-ai"], "Google AI Blog", 4, 1, 28, "2026-03-12 18:00", "lightweight-models"),
  mkArticle("claude-review", "Claude のレビュー支援が設計チェック用途で目立つ", "設計レビュー用途で Claude を使うケースが増え、チェック観点の整理に注目が集まっている。", "Claude は単なる文章生成ではなく、設計レビューや仕様差分の確認用途でも使われ始めている。特に人間の確認観点を並べやすく、テンプレート化されたレビュー補助としての利用価値が高まっている。", ["coding-ai", "review", "anthropic"], "Engineering Blog", 3, 2, 21, "2026-03-12 18:00", "coding-agents"),
  mkArticle("agent-ops", "Agent 設計で運用性が課題として再浮上", "タスク達成率だけでなく、監視や失敗時の扱いを含めた運用設計が注目されている。", "Agent 設計では、単にタスク成功率を見るだけでは足りず、監視性や再試行方針、失敗時の扱いを含む運用設計が重要視されている。特に複数ツールをまたぐ処理では、挙動を後から追える設計が求められている。", ["agent", "ops", "tool-use"], "AI News", 5, 3, 17, "2026-03-12 18:00", "coding-agents"),
  mkArticle("voice-stack", "Voice AI が中規模オペレーション導入へ進む", "音声入力や通話要約の導入が広がり、業務フローへの組み込みが現実味を増している。", "Voice AI は研究デモ段階を超え、通話要約や業務入力支援を中心に導入が進み始めた。特に入力コスト削減と業務フロー接続が評価され、中規模運用での採用が増えている。", ["voice-ai", "workflow", "enterprise"], "Voice Product Blog", 4, 4, 15, "2026-03-12 18:00", "voice-workflows"),
  mkArticle("safety-eval", "Safety 評価がモデル導入の前提条件として再注目", "速度やコストだけではなく、評価手順の透明性を含めて比較する流れが強まっている。", "Safety 評価は後付け要素ではなく、導入前の前提条件として扱われる場面が増えている。評価手順の透明性や公開可能な結果の有無まで含めて比較するケースが増え、実運用へ入る際の重要要件になっている。", ["safety", "evaluation", "governance"], "Research Digest", 3, 5, 12, "2026-03-12 18:00", "safety-evals"),
  mkArticle("rag-refresh", "RAG の検索改善が再び注目される", "新規モデルだけでなく、検索・索引・更新設計の見直しが成果に直結する。", "RAG は検索性能と更新設計の見直しだけでも大きく改善する場面が多い。新規モデル導入より先に、索引更新や取得ルールの設計を見直す流れが再評価されている。", ["rag", "search", "refresh"], "Infra Notes", 4, 6, 11, "2026-03-12 18:00", "rag-refresh"),
  mkArticle("image-pipeline", "画像生成モデル比較より運用パイプラインの差が大きい", "生成品質だけでなく、アセット管理やキャッシュ設計まで含めた運用差が目立っている。", "画像生成ではモデル比較だけでなく、アセット保存、再生成、配信キャッシュまで含めた運用設計の差が成果を左右している。単体精度よりもパイプライン設計が目立つ場面が増えている。", ["image-generation", "workflow", "asset"], "Design Systems Blog", 3, 7, 9, "2026-03-12 18:00", "image-pipeline"),
  mkArticle("regulation-watch", "AI 規制ウォッチが実装計画の前提へ移る", "政策ニュースの要約だけでなく、運用影響の整理が重要になっている。", "AI 規制の追跡はリーガル確認だけでなく、運用影響や公開方針の整理に結びつく情報として重要度を増している。特にログ保持や説明可能性に関する要求が実装へ直結し始めている。", ["regulation", "governance", "policy"], "Policy Watch", 2, 8, 8, "2026-03-12 18:00", "regulation-watch"),
  mkArticle("open-source-rush", "OSS 側の実装速度が商用 API 比較を揺らす", "OSS の更新速度が速く、商用 API だけでは追い切れない場面が出てきている。", "OSS の更新速度が上がり、商用 API だけでは比較が不十分になるケースが増えている。導入判断では、更新頻度や自前運用可能性まで含めて OSS をどう扱うかが焦点になっている。", ["oss", "deployment", "strategy"], "Open Source News", 4, 9, 7, "2026-03-12 18:00", "oss-speed"),
];

const relatedSources = {
  "lightweight-models": [
    { source: "Google AI Blog", role: "代表ソース", note: "一次情報", strength: "実装指針が明確" },
    { source: "YouTube Review", role: "関連ソース", note: "動画レビュー", strength: "理解補助" },
    { source: "Dev Blog", role: "関連ソース", note: "比較記事", strength: "導入判断向け" },
  ],
  "coding-agents": [
    { source: "Anthropic Docs", role: "代表ソース", note: "仕様説明", strength: "設計判断向け" },
    { source: "Engineering Blog", role: "関連ソース", note: "導入所感", strength: "運用視点がある" },
    { source: "AI News", role: "関連ソース", note: "要約記事", strength: "全体把握向け" },
  ],
  "voice-workflows": [
    { source: "Voice Product Blog", role: "代表ソース", note: "プロダクト更新", strength: "導入想定が具体的" },
    { source: "Case Study", role: "関連ソース", note: "事例紹介", strength: "運用像が見える" },
  ],
};

const tagRadar = [
  { label: "lightweight-model", count: 18, trend: "matched", status: "タグマスタ登録済み" },
  { label: "agent-observability", count: 11, trend: "matched", status: "次回バッチで再タグ付け" },
  { label: "voice-ops", count: 7, trend: "watch", status: "件数増加を監視中" },
  { label: "compliance-runtime", count: 4, trend: "candidate", status: "新語候補" },
];

const opsQueue = [
  { type: "hide_article", target: "regulation-watch", note: "説明調整のため一時非表示候補", status: "queued", priority: 1 },
  { type: "retag", target: "agent-ops", note: "新タグ昇格後の再反映", status: "processing", priority: 2 },
  { type: "rebuild_rank", target: "feed-hourly", note: "行動集計更新後の順位再計算", status: "queued", priority: 3 },
];

const systemNotes = [
  "取得元は source_targets を参照して layer1 へ投入する",
  "layer1 から layer2 で要約とタグ照合を行う",
  "layer2 から layer4 を毎時更新する",
  "日次で tag_candidate_pool を集計し Google Trends と照合する",
  "週次で articles_raw を articles_raw_history へ移す",
];

const state = {
  route: "feed",
  selectedArticleId: publicArticles[0].id,
  searchQuery: "",
};

const routeMeta = {
  feed: "public_articles / public_article_tags / public_rankings の見え方を確認する。",
  sources: "public_article_sources による代表ソースと関連ソースのまとまりを見る。",
  tags: "tags_master と tag_candidate_pool の流れを確認する。",
  ops: "運営操作と priority_processing_queue の優先反映を見る。",
  digest: "public_rankings 上位から再構成した digest の見え方を見る。",
};

const root = document.getElementById("view-root");
const navRoot = document.getElementById("global-nav");
const routeTitle = document.getElementById("route-title");
const routeMetaNode = document.getElementById("route-meta");
const contextRoot = document.getElementById("context-root");
const flowLog = document.getElementById("flow-log");

function mkArticle(id, title, summary100, summary300, tags, source, sourceCount, rank, activity, updatedAt, groupKey) {
  return { id, title, summary100, summary300, tags, source, sourceCount, rank, activity, updatedAt, groupKey, url: `https://example.com/${id}` };
}

function selectedArticle() {
  return publicArticles.find((item) => item.id === state.selectedArticleId) ?? publicArticles[0];
}

function filteredArticles() {
  const query = state.searchQuery.trim().toLowerCase();
  if (!query) return publicArticles;
  return publicArticles.filter((item) =>
    [item.title, item.summary100, item.tags.join(" ")].join(" ").toLowerCase().includes(query),
  );
}

function renderNav() {
  navRoot.innerHTML = navItems.map((item) => `
    <button class="${item.id === state.route ? "active" : ""}" data-nav="${item.id}">
      <div>
        <strong>${item.label}</strong>
        <small>${item.hint}</small>
      </div>
    </button>
  `).join("");
}

function renderHero() {
  return `
    <section class="hero-grid">
      <article class="hero-card"><p class="eyebrow">Layer4</p><strong>${publicArticles.length} 件</strong><span class="meta">公開記事TBL</span></article>
      <article class="hero-card"><p class="eyebrow">Hourly Refresh</p><strong>18:00</strong><span class="meta">次回 19:00 更新</span></article>
      <article class="hero-card"><p class="eyebrow">Tag Radar</p><strong>${tagRadar.length} 件</strong><span class="meta">新語候補と昇格状況</span></article>
      <article class="hero-card"><p class="eyebrow">Ops Queue</p><strong>${opsQueue.length} 件</strong><span class="meta">優先処理の保留件数</span></article>
    </section>
  `;
}

function renderFeed() {
  const results = filteredArticles();
  return `
    ${renderHero()}
    <section class="article-grid">
      ${results.map((article) => `
        <article class="article-card">
          <div class="thumb"></div>
          <div class="article-head">
            <div>
              <p class="eyebrow">#${article.rank} / ${article.source} / ${article.sourceCount} sources</p>
              <h3>${article.title}</h3>
            </div>
            <span class="pill ghost">${article.activity} shares/h</span>
          </div>
          <p>${article.summary100}</p>
          <div class="tag-row">
            ${article.tags.map((tag) => `<span class="pill">${tag}</span>`).join("")}
          </div>
          <div class="action-row">
            <button class="pill strong" data-pick="${article.id}">300字を見る</button>
            <button class="pill ghost" data-route="sources" data-group="${article.groupKey}" data-pick="${article.id}">関連ソース</button>
            <button class="pill ghost" data-open="${article.url}">元記事</button>
          </div>
          <span class="meta">更新: ${article.updatedAt}</span>
        </article>
      `).join("")}
    </section>
  `;
}

function renderSources() {
  const article = selectedArticle();
  const items = relatedSources[article.groupKey] ?? [];
  return `
    <section class="panel-card">
      <p class="eyebrow">代表ソースと関連ソース</p>
      <h3>${article.title}</h3>
      <span class="meta">source_priority_rules により代表ソースを決定し、関連ソースをあわせて表示する。</span>
    </section>
    <section class="panel-grid">
      ${items.map((item) => `
        <article class="panel-card">
          <p class="eyebrow">${item.role}</p>
          <h3>${item.source}</h3>
          <p>${item.note}</p>
          <span class="meta">${item.strength}</span>
        </article>
      `).join("")}
    </section>
  `;
}

function renderTags() {
  return `
    <section class="panel-grid">
      <article class="panel-card">
        <p class="eyebrow">タグマスタTBL</p>
        <h3>既存タグ</h3>
        <div class="tag-row">
          <span class="pill">llm</span>
          <span class="pill">agent</span>
          <span class="pill">safety</span>
          <span class="pill">voice-ai</span>
          <span class="pill">rag</span>
          <span class="pill">regulation</span>
        </div>
      </article>
      <article class="panel-card">
        <p class="eyebrow">日次処理</p>
        <h3>Google Trends 照合</h3>
        <span class="meta">一定件数を超えた候補だけを照合し、一致したものを tags_master に追加する。</span>
      </article>
    </section>
    <section class="tag-grid">
      ${tagRadar.map((item) => `
        <article class="note-card">
          <p class="eyebrow">${item.status}</p>
          <h3>${item.label}</h3>
          <p>出現回数: ${item.count}</p>
          <span class="meta">trend status: ${item.trend}</span>
        </article>
      `).join("")}
    </section>
  `;
}

function renderOps() {
  return `
    <section class="panel-card">
      <p class="eyebrow">即時反映</p>
      <h3>priority_processing_queue を優先処理する</h3>
      <span class="meta">非表示、再タグ付け、再公開、順位再計算などを毎時処理より前に反映する。</span>
    </section>
    <section class="ops-grid">
      ${opsQueue.map((item) => `
        <article class="note-card">
          <p class="eyebrow">priority ${item.priority} / ${item.status}</p>
          <h3>${item.type}</h3>
          <p>target: ${item.target}</p>
          <span class="meta">${item.note}</span>
        </article>
      `).join("")}
    </section>
  `;
}

function renderDigest() {
  return `
    <section class="panel-card">
      <p class="eyebrow">Hourly Digest</p>
      <h3>ランキング上位から再構成する</h3>
      <span class="meta">public_rankings 24h 上位を基準に、通知やまとめ表示へ流用する。</span>
    </section>
    <section class="digest-grid">
      ${publicArticles.slice(0, 6).map((article) => `
        <article class="article-card">
          <p class="eyebrow">Rank #${article.rank}</p>
          <h3>${article.title}</h3>
          <p>${article.summary100}</p>
          <div class="tag-row">
            ${article.tags.slice(0, 3).map((tag) => `<span class="pill">${tag}</span>`).join("")}
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function renderContext() {
  const article = selectedArticle();
  contextRoot.innerHTML = `
    <div class="panel-card">
      <p class="eyebrow">public_articles</p>
      <h3>${article.title}</h3>
      <p>${article.summary300}</p>
      <div class="tag-row">
        ${article.tags.map((tag) => `<span class="pill">${tag}</span>`).join("")}
      </div>
      <span class="meta">代表ソース: ${article.source}</span><br />
      <span class="meta">関連ソース数: ${article.sourceCount}</span><br />
      <span class="meta">更新時刻: ${article.updatedAt}</span>
    </div>
  `;
}

function renderNotes() {
  flowLog.innerHTML = systemNotes.map((item) => `<div class="log-item">${item}</div>`).join("");
}

function render() {
  renderNav();
  routeTitle.textContent = navItems.find((item) => item.id === state.route).label;
  routeMetaNode.innerHTML = `<span>${routeMeta[state.route]}</span><span class="pill ghost">${state.route}</span>`;

  const viewByRoute = {
    feed: renderFeed,
    sources: renderSources,
    tags: renderTags,
    ops: renderOps,
    digest: renderDigest,
  };

  root.innerHTML = viewByRoute[state.route]();
  renderContext();
  renderNotes();
}

function setRoute(route) {
  state.route = route;
  render();
}

function pickArticle(articleId) {
  state.selectedArticleId = articleId;
  renderContext();
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    setRoute(nav.dataset.nav);
    return;
  }

  const pick = event.target.closest("[data-pick]");
  if (pick) {
    pickArticle(pick.dataset.pick);
  }

  const route = event.target.closest("[data-route]");
  if (route) {
    if (route.dataset.group) {
      const target = publicArticles.find((item) => item.groupKey === route.dataset.group);
      if (target) pickArticle(target.id);
    }
    setRoute(route.dataset.route);
    return;
  }

  const open = event.target.closest("[data-open]");
  if (open) {
    window.open(open.dataset.open, "_blank", "noopener,noreferrer");
  }
});

document.getElementById("search-submit").addEventListener("click", () => {
  state.searchQuery = document.getElementById("global-search").value;
  setRoute("feed");
});

render();
