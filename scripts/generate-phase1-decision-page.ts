#!/usr/bin/env npx tsx
import fs from 'node:fs'
import path from 'node:path'
import {
  PHASE1_CATEGORY_CANDIDATE_KEYS,
  PHASE1_PRIMARY_TAG_EXCLUSION_KEYS,
} from '@/lib/tags/retag-phase1'

type SummaryTag = {
  tagKey: string
  displayName: string
  articleCount: number
}

type SummaryCandidate = {
  candidateKey: string
  displayName: string
  seenCount: number
  reviewStatus: string
  manualReviewRequired: boolean
  latestTrendsScore: number | null
  categoryCandidate: boolean
  originTitle: string | null
  sourceUrl: string | null
}

type SummaryCategory = {
  key: string
  publishedArticleCount: number
}

type SummarySheet = {
  currentTags: SummaryTag[]
  newTagCandidates: SummaryCandidate[]
  currentCategories: {
    sourceCategory: SummaryCategory[]
    sourceType: SummaryCategory[]
  }
  categoryCandidates: Array<{
    key: string
    candidateSeenCount: number
    candidateStatus: string
    existingTagArticleCount: number
    currentSourceCategoryCount: number
    currentSourceTypeCount: number
  }>
}

type DecisionOption =
  | '採用'
  | '保留'
  | '不採用'
  | '廃止'
  | 'カテゴリ行き'
  | 'タグ行き'

type DecisionItem = {
  id: string
  section: string
  itemType: string
  key: string
  label: string
  counts: Record<string, number | string | boolean | null>
  note: string
  suggestedDecision: DecisionOption
}

const DECISION_OPTIONS: DecisionOption[] = [
  '採用',
  '保留',
  '不採用',
  '廃止',
  'カテゴリ行き',
  'タグ行き',
]

const TAG_KEYS_TO_CATEGORY = new Set([
  'paper',
  'open source',
  'enterprise-ai',
  'official',
  'news',
  'search-rag',
  'oss',
])

const SOURCE_CATEGORY_REMOVE = new Set(['llm', 'agent', 'voice', 'policy', 'safety'])
const SOURCE_CATEGORY_REMAP = new Map<string, string>([['search', 'search-rag']])

function readArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function buildDecisionItems(summary: SummarySheet): DecisionItem[] {
  const items: DecisionItem[] = []

  for (const tag of summary.currentTags) {
    let suggestedDecision: DecisionOption = 'タグ行き'
    let note = '既存主タグ。固有名詞・製品名・企業名・モデル名・OSS固有名は主タグ側に残す。'

    if (PHASE1_PRIMARY_TAG_EXCLUSION_KEYS.includes(tag.tagKey as never)) {
      suggestedDecision = '廃止'
      note = '会話で完全除外に合意した既存タグ。'
    } else if (TAG_KEYS_TO_CATEGORY.has(tag.tagKey)) {
      suggestedDecision = 'カテゴリ行き'
      note = '会話でカテゴリ寄せが妥当とした既存タグ。'
    }

    items.push({
      id: `current-tag:${tag.tagKey}`,
      section: '現状タグ一覧',
      itemType: 'current-tag',
      key: tag.tagKey,
      label: tag.displayName,
      counts: { articleCount: tag.articleCount },
      note,
      suggestedDecision,
    })
  }

  for (const candidate of summary.newTagCandidates) {
    items.push({
      id: `new-tag:${candidate.candidateKey}`,
      section: '新規立項タグ一覧',
      itemType: 'new-tag-candidate',
      key: candidate.candidateKey,
      label: candidate.displayName,
      counts: {
        seenCount: candidate.seenCount,
        manualReviewRequired: candidate.manualReviewRequired,
      },
      note: candidate.originTitle ?? '',
      suggestedDecision: '保留',
    })
  }

  for (const category of summary.currentCategories.sourceCategory) {
    let suggestedDecision: DecisionOption = '保留'
    let note = '現行 source_category。1周目後の大きな導線変更で再設計対象。'

    if (SOURCE_CATEGORY_REMOVE.has(category.key)) {
      suggestedDecision = '廃止'
      note = '会話でカテゴリからも不要とした現行 source_category。'
    } else if (SOURCE_CATEGORY_REMAP.has(category.key)) {
      suggestedDecision = 'カテゴリ行き'
      note = `将来カテゴリ候補 ${SOURCE_CATEGORY_REMAP.get(category.key)} への寄せ先候補。`
    }

    items.push({
      id: `current-source-category:${category.key}`,
      section: 'カテゴリ一覧',
      itemType: 'current-source-category',
      key: category.key,
      label: category.key,
      counts: { publishedArticleCount: category.publishedArticleCount },
      note,
      suggestedDecision,
    })
  }

  for (const category of summary.currentCategories.sourceType) {
    items.push({
      id: `current-source-type:${category.key}`,
      section: 'カテゴリ一覧',
      itemType: 'current-source-type',
      key: category.key,
      label: category.key,
      counts: { publishedArticleCount: category.publishedArticleCount },
      note: '現行 source_type。表示導線の既存軸。',
      suggestedDecision: '保留',
    })
  }

  for (const category of summary.categoryCandidates) {
    items.push({
      id: `category-candidate:${category.key}`,
      section: 'カテゴリ候補一覧',
      itemType: 'category-candidate',
      key: category.key,
      label: category.key,
      counts: {
        existingTagArticleCount: category.existingTagArticleCount,
        currentSourceCategoryCount: category.currentSourceCategoryCount,
        currentSourceTypeCount: category.currentSourceTypeCount,
        candidateSeenCount: category.candidateSeenCount,
      },
      note: '会話でカテゴリ候補に寄せた語彙。',
      suggestedDecision: 'カテゴリ行き',
    })
  }

  return items
}

function renderHtml(summary: SummarySheet, decisionItems: DecisionItem[]): string {
  const embedded = JSON.stringify({
    summary,
    decisionItems,
    decisionOptions: DECISION_OPTIONS,
  })

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Phase 1 Decision Sheet</title>
  <style>
    :root {
      --bg: #f5f1e8;
      --panel: #fffaf2;
      --ink: #1f2328;
      --muted: #6b7280;
      --line: #d6c7ae;
      --accent: #0f766e;
      --accent-soft: #d7f3ef;
      --warn: #92400e;
      --warn-soft: #fff1d6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Hiragino Sans", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, #fff6de 0, transparent 28%),
        radial-gradient(circle at top right, #e6f4ef 0, transparent 30%),
        var(--bg);
    }
    .page {
      max-width: 1480px;
      margin: 0 auto;
      padding: 28px;
    }
    .hero, .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 12px 32px rgba(31, 35, 40, 0.07);
    }
    .hero {
      padding: 24px;
      margin-bottom: 20px;
    }
    h1, h2, h3 { margin: 0; }
    h1 { font-size: 30px; margin-bottom: 10px; }
    h2 { font-size: 20px; margin-bottom: 14px; }
    h3 { font-size: 15px; margin-bottom: 8px; }
    p { margin: 0; line-height: 1.6; }
    .muted { color: var(--muted); }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .chip {
      padding: 8px 12px;
      border-radius: 999px;
      background: #f3eadb;
      border: 1px solid var(--line);
      font-size: 13px;
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 20px;
      align-items: start;
    }
    .sidebar, .content {
      display: grid;
      gap: 18px;
    }
    .panel { padding: 18px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .stat {
      padding: 12px;
      border-radius: 14px;
      background: #f9f3e7;
      border: 1px solid var(--line);
    }
    .stat strong {
      display: block;
      font-size: 22px;
      margin-top: 6px;
    }
    .toolbar {
      display: grid;
      gap: 12px;
    }
    input[type="search"], select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
      font: inherit;
      background: #fff;
      color: inherit;
    }
    textarea { min-height: 240px; resize: vertical; }
    .btn-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    button {
      border: 0;
      border-radius: 12px;
      padding: 10px 14px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      color: #fff;
      background: var(--accent);
    }
    button.secondary {
      background: #6b7280;
    }
    .note {
      padding: 12px;
      border-radius: 14px;
      background: var(--warn-soft);
      color: var(--warn);
      font-size: 13px;
      line-height: 1.5;
    }
    .section {
      display: grid;
      gap: 14px;
      margin-bottom: 22px;
    }
    .section-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: end;
    }
    .section-count {
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }
    .cards {
      display: grid;
      gap: 12px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #fff;
      padding: 14px;
      display: grid;
      gap: 12px;
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: start;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .meta span {
      background: #f5efe4;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 600;
    }
    .suggested {
      background: var(--accent-soft);
      color: var(--accent);
    }
    .radios {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .radios label {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 7px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #faf6ef;
      font-size: 13px;
      cursor: pointer;
    }
    .radios input { margin: 0; }
    .small { font-size: 12px; }
    .hidden { display: none !important; }
    @media (max-width: 1100px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="hero">
      <h1>Phase 1 Decision Sheet</h1>
      <p class="muted">会話で固めたルールをもとに、既存タグ・新規立項候補・カテゴリ・カテゴリ候補を一括判定するページです。各行でラジオボタンを選ぶと、右下の出力欄に JSON / Markdown / CSV を生成できます。</p>
      <div class="chips">
        <span class="chip">完全除外: ${PHASE1_PRIMARY_TAG_EXCLUSION_KEYS.join(', ')}</span>
        <span class="chip">カテゴリ候補: ${PHASE1_CATEGORY_CANDIDATE_KEYS.join(', ')}</span>
        <span class="chip">主タグは固有名詞中心</span>
        <span class="chip">カテゴリ / 主タグ / 隣接タグを分離</span>
      </div>
    </div>

    <div class="grid">
      <aside class="sidebar">
        <section class="panel">
          <h2>概要</h2>
          <div class="stats" id="stats"></div>
        </section>

        <section class="panel toolbar">
          <div>
            <h2>フィルタ</h2>
            <p class="muted small">セクション、推奨値、キーワードで絞り込みます。</p>
          </div>
          <input id="searchInput" type="search" placeholder="タグ名 / 候補名 / note を検索" />
          <select id="sectionFilter">
            <option value="">全セクション</option>
          </select>
          <select id="suggestedFilter">
            <option value="">推奨値すべて</option>
          </select>
          <select id="decisionFilter">
            <option value="">現在の選択すべて</option>
          </select>
          <div class="btn-row">
            <button id="applySuggestedButton" type="button">推奨値を一括適用</button>
            <button id="clearButton" class="secondary" type="button">選択をクリア</button>
          </div>
          <div class="note">
            推奨値は会話の整理をベースにした初期案です。最終決定ではありません。
          </div>
        </section>

        <section class="panel toolbar">
          <div>
            <h2>出力</h2>
            <p class="muted small">現在の判定結果を JSON / Markdown / CSV で生成します。</p>
          </div>
          <div class="btn-row">
            <button id="jsonButton" type="button">JSON</button>
            <button id="markdownButton" type="button">Markdown</button>
            <button id="csvButton" type="button">CSV</button>
          </div>
          <textarea id="outputArea" placeholder="ここに出力結果が入ります"></textarea>
        </section>
      </aside>

      <main class="content" id="content"></main>
    </div>
  </div>

  <script>
    const DATA = ${embedded};
    const state = {
      decisions: new Map(DATA.decisionItems.map((item) => [item.id, item.suggestedDecision])),
    };

    const statsRoot = document.getElementById('stats');
    const contentRoot = document.getElementById('content');
    const outputArea = document.getElementById('outputArea');
    const searchInput = document.getElementById('searchInput');
    const sectionFilter = document.getElementById('sectionFilter');
    const suggestedFilter = document.getElementById('suggestedFilter');
    const decisionFilter = document.getElementById('decisionFilter');

    function buildStats() {
      const overview = DATA.summary.overview;
      const stats = [
        ['現状タグ', overview.currentActiveTagCount],
        ['新規候補', overview.newTagCandidateCount],
        ['現行カテゴリ', overview.currentSourceCategoryCount + overview.currentSourceTypeCount],
        ['カテゴリ候補', overview.phase1CategoryCandidateCount],
      ];
      statsRoot.innerHTML = stats.map(([label, value]) => \`
        <div class="stat">
          <div class="muted small">\${label}</div>
          <strong>\${value}</strong>
        </div>
      \`).join('');
    }

    function uniqueValues(values) {
      return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ja'));
    }

    function buildFilters() {
      const sections = uniqueValues(DATA.decisionItems.map((item) => item.section));
      const suggested = uniqueValues(DATA.decisionItems.map((item) => item.suggestedDecision));
      const decisions = uniqueValues(DATA.decisionOptions);

      sectionFilter.innerHTML += sections.map((value) => \`<option value="\${value}">\${value}</option>\`).join('');
      suggestedFilter.innerHTML += suggested.map((value) => \`<option value="\${value}">\${value}</option>\`).join('');
      decisionFilter.innerHTML += decisions.map((value) => \`<option value="\${value}">\${value}</option>\`).join('');
    }

    function getCurrentDecision(itemId) {
      return state.decisions.get(itemId) || '';
    }

    function matchesFilter(item) {
      const search = searchInput.value.trim().toLowerCase();
      const section = sectionFilter.value;
      const suggested = suggestedFilter.value;
      const currentDecision = decisionFilter.value;

      if (section && item.section !== section) return false;
      if (suggested && item.suggestedDecision !== suggested) return false;
      if (currentDecision && getCurrentDecision(item.id) !== currentDecision) return false;

      if (!search) return true;

      const haystack = [
        item.key,
        item.label,
        item.note,
        item.section,
        JSON.stringify(item.counts),
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    }

    function formatCountBadges(counts) {
      return Object.entries(counts)
        .filter(([, value]) => value !== null && value !== '' && value !== false)
        .map(([key, value]) => \`<span>\${key}: \${value}</span>\`)
        .join('');
    }

    function renderSections() {
      const filtered = DATA.decisionItems.filter(matchesFilter);
      const grouped = new Map();

      for (const item of filtered) {
        const bucket = grouped.get(item.section) || [];
        bucket.push(item);
        grouped.set(item.section, bucket);
      }

      const sections = [...grouped.entries()].map(([section, items]) => {
        const sortedItems = sortItems(items);
        return \`
          <section class="panel section">
            <div class="section-head">
              <div>
                <h2>\${section}</h2>
                <p class="muted small">クリックだけで判定できます。推奨値は右上チップ表示です。</p>
              </div>
              <div class="section-count">\${sortedItems.length} items</div>
            </div>
            <div class="cards">
              \${sortedItems.map(renderCard).join('')}
            </div>
          </section>
        \`;
      });

      contentRoot.innerHTML = sections.join('') || '<section class="panel"><p>条件に一致する項目がありません。</p></section>';
      attachRadioHandlers();
    }

    function sortItems(items) {
      const scoreKey = items[0]?.itemType === 'new-tag-candidate' ? 'seenCount' : items[0]?.itemType?.includes('category') ? 'publishedArticleCount' : 'articleCount';
      return [...items].sort((left, right) => {
        const leftScore = Number(
          left.counts.articleCount ??
          left.counts.seenCount ??
          left.counts.publishedArticleCount ??
          left.counts.existingTagArticleCount ??
          0
        );
        const rightScore = Number(
          right.counts.articleCount ??
          right.counts.seenCount ??
          right.counts.publishedArticleCount ??
          right.counts.existingTagArticleCount ??
          0
        );
        return rightScore - leftScore || left.key.localeCompare(right.key, 'ja');
      });
    }

    function renderCard(item) {
      const currentDecision = getCurrentDecision(item.id);
      return \`
        <article class="card" data-item-id="\${item.id}">
          <div class="card-top">
            <div>
              <h3>\${item.label}</h3>
              <div class="muted small">\${item.key}</div>
            </div>
            <div class="meta">
              <span class="suggested">推奨: \${item.suggestedDecision}</span>
              <span>\${item.itemType}</span>
            </div>
          </div>
          <div class="meta">\${formatCountBadges(item.counts)}</div>
          <div class="muted small">\${item.note || ''}</div>
          <div class="radios">
            \${DATA.decisionOptions.map((option) => \`
              <label>
                <input
                  type="radio"
                  name="decision-\${item.id}"
                  value="\${option}"
                  \${currentDecision === option ? 'checked' : ''}
                />
                <span>\${option}</span>
              </label>
            \`).join('')}
          </div>
        </article>
      \`;
    }

    function attachRadioHandlers() {
      document.querySelectorAll('input[type="radio"]').forEach((input) => {
        input.addEventListener('change', (event) => {
          const target = event.currentTarget;
          const card = target.closest('[data-item-id]');
          if (!card) return;
          state.decisions.set(card.dataset.itemId, target.value);
        });
      });
    }

    function applySuggested() {
      for (const item of DATA.decisionItems) {
        state.decisions.set(item.id, item.suggestedDecision);
      }
      renderSections();
    }

    function clearDecisions() {
      state.decisions = new Map();
      renderSections();
    }

    function buildExportRows() {
      return DATA.decisionItems.map((item) => ({
        section: item.section,
        itemType: item.itemType,
        key: item.key,
        label: item.label,
        suggestedDecision: item.suggestedDecision,
        decision: getCurrentDecision(item.id),
        counts: item.counts,
        note: item.note,
      }));
    }

    function exportJson() {
      const payload = {
        generatedAt: new Date().toISOString(),
        decisions: buildExportRows(),
      };
      outputArea.value = JSON.stringify(payload, null, 2);
    }

    function exportMarkdown() {
      const rows = buildExportRows();
      const header = '| section | item_type | key | label | suggested | decision | counts | note |';
      const sep = '| --- | --- | --- | --- | --- | --- | --- | --- |';
      const body = rows.map((row) => \`| \${row.section} | \${row.itemType} | \${row.key} | \${row.label} | \${row.suggestedDecision} | \${row.decision} | \${JSON.stringify(row.counts).replace(/\\|/g, '/')} | \${(row.note || '').replace(/\\|/g, '/')} |\`);
      outputArea.value = ['# Phase 1 Decisions', '', header, sep, ...body].join('\\n');
    }

    function csvEscape(value) {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      return '"' + text.replaceAll('"', '""') + '"';
    }

    function exportCsv() {
      const rows = buildExportRows();
      const lines = [
        ['section', 'itemType', 'key', 'label', 'suggestedDecision', 'decision', 'counts', 'note']
          .map(csvEscape)
          .join(','),
        ...rows.map((row) =>
          [
            row.section,
            row.itemType,
            row.key,
            row.label,
            row.suggestedDecision,
            row.decision,
            JSON.stringify(row.counts),
            row.note || '',
          ].map(csvEscape).join(',')
        ),
      ];
      outputArea.value = lines.join('\\n');
    }

    searchInput.addEventListener('input', renderSections);
    sectionFilter.addEventListener('change', renderSections);
    suggestedFilter.addEventListener('change', renderSections);
    decisionFilter.addEventListener('change', renderSections);
    document.getElementById('applySuggestedButton').addEventListener('click', applySuggested);
    document.getElementById('clearButton').addEventListener('click', clearDecisions);
    document.getElementById('jsonButton').addEventListener('click', exportJson);
    document.getElementById('markdownButton').addEventListener('click', exportMarkdown);
    document.getElementById('csvButton').addEventListener('click', exportCsv);

    buildStats();
    buildFilters();
    renderSections();
    exportJson();
  </script>
</body>
</html>`;
}

async function main(): Promise<void> {
  const rootDir = readArg('--root', path.join(process.cwd(), 'af-20260326', 'phase1-retag'))
  const summaryPath = path.join(rootDir, 'summary-sheet.json')
  const outPath = path.join(rootDir, 'decision-sheet.html')

  if (!fs.existsSync(summaryPath)) {
    throw new Error(`summary sheet not found: ${summaryPath}`)
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as SummarySheet
  const decisionItems = buildDecisionItems(summary)
  const html = renderHtml(summary, decisionItems)

  fs.writeFileSync(outPath, html, 'utf8')
  console.log(`outPath=${outPath}`)
  console.log(`decisionItemCount=${decisionItems.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
