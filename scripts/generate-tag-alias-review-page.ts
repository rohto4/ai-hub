#!/usr/bin/env npx tsx
import fs from 'node:fs'
import path from 'node:path'

type AliasAiStatus = 'alias' | 'separate' | 'review' | 'error'

type AliasReviewReport = {
  generatedAt: string
  sourceSummaryPath: string
  totalGroups: number
  groups: Array<{
    groupId: string
    comparableKey: string
    heuristics: string[]
    suggestedCanonicalKey: string
    suggestedCanonicalLabel: string
    aiEvaluation: {
      status: AliasAiStatus
      confidence: 'high' | 'medium' | 'low'
      recommendedCanonicalKey: string | null
      recommendedCanonicalLabel: string | null
      rationaleJa: string
      cautionJa: string
    }
    terms: Array<{
      key: string
      label: string
      sourceType: string
      articleCount?: number
      seenCount?: number
      note?: string
    }>
  }>
}

type ReviewDecision =
  | '同一グループでよい'
  | '保留'
  | '別扱い'
  | 'タグ採用'
  | 'カテゴリ行き'
  | '廃止'

const REVIEW_DECISIONS: ReviewDecision[] = [
  '同一グループでよい',
  '保留',
  '別扱い',
  'タグ採用',
  'カテゴリ行き',
  '廃止',
]

function readArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function suggestedDecision(status: AliasAiStatus): ReviewDecision {
  if (status === 'alias') return '同一グループでよい'
  if (status === 'separate') return '別扱い'
  return '保留'
}

function renderHtml(report: AliasReviewReport): string {
  const embedded = JSON.stringify({
    report,
    reviewDecisions: REVIEW_DECISIONS,
  })

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tag Alias Review</title>
  <style>
    :root {
      --bg: #f4efe6;
      --panel: #fffaf2;
      --ink: #1f2328;
      --muted: #667085;
      --line: #d8c6a8;
      --accent: #0f766e;
      --accent-soft: #d8f3ef;
      --warn: #9a3412;
      --warn-soft: #fff1e2;
      --bad: #b42318;
      --bad-soft: #ffe4e4;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Hiragino Sans", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, #fff5dd 0, transparent 26%),
        radial-gradient(circle at right top, #e3f6f1 0, transparent 28%),
        var(--bg);
    }
    .page {
      max-width: 1440px;
      margin: 0 auto;
      padding: 28px;
    }
    .hero, .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 12px 28px rgba(31, 35, 40, 0.06);
    }
    .hero {
      padding: 24px;
      margin-bottom: 20px;
    }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 30px; margin-bottom: 10px; }
    h2 { font-size: 20px; margin-bottom: 12px; }
    h3 { font-size: 17px; }
    p { line-height: 1.6; }
    .muted { color: var(--muted); }
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
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #f9f2e6;
    }
    .stat strong {
      display: block;
      margin-top: 6px;
      font-size: 24px;
    }
    input[type="search"], select, textarea {
      width: 100%;
      font: inherit;
      color: inherit;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
    }
    textarea { min-height: 220px; resize: vertical; }
    .toolbar {
      display: grid;
      gap: 12px;
    }
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
    button.secondary { background: #6b7280; }
    .note {
      padding: 12px;
      border-radius: 14px;
      background: var(--warn-soft);
      color: var(--warn);
      font-size: 13px;
      line-height: 1.6;
    }
    .cards {
      display: grid;
      gap: 14px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 18px;
      background: #fff;
      padding: 16px;
      display: grid;
      gap: 12px;
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .meta span, .term span {
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #f4ede1;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 600;
    }
    .ai-alias { background: var(--accent-soft); color: var(--accent); }
    .ai-separate { background: var(--bad-soft); color: var(--bad); }
    .ai-review, .ai-error { background: var(--warn-soft); color: var(--warn); }
    .term-list {
      display: grid;
      gap: 10px;
    }
    .term {
      border: 1px dashed var(--line);
      border-radius: 14px;
      padding: 12px;
      display: grid;
      gap: 8px;
      background: #fffdf8;
    }
    .term-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
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
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #faf6ef;
      padding: 7px 10px;
      font-size: 13px;
      cursor: pointer;
    }
    .small { font-size: 12px; }
    @media (max-width: 1120px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="hero">
      <h1>Tag Alias Review</h1>
      <p class="muted">既存タグと新規候補をまたいで、表記ゆれ alias 候補グループを作成し、Gemini の判定を付けたレビュー用ページです。各グループで「同一グループでよい / 保留 / 別扱い」などを選び、その場で JSON / Markdown / CSV に書き出せます。</p>
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
            <p class="muted small">AI 判定、決定状態、グループ内語を検索できます。</p>
          </div>
          <input id="searchInput" type="search" placeholder="group key / term / note を検索" />
          <select id="aiStatusFilter">
            <option value="">AI 判定すべて</option>
          </select>
          <select id="decisionFilter">
            <option value="">決定状態すべて</option>
          </select>
          <div class="btn-row">
            <button id="applySuggestedButton" type="button">AI 推奨を反映</button>
            <button id="clearButton" class="secondary" type="button">決定をクリア</button>
          </div>
          <div class="note">
            alias は表記ゆれとして統合寄り、separate は別語寄り、review は人手確認前提です。ここでの判断は alias 候補の整理用であり、まだ DB 更新は行いません。
          </div>
        </section>

        <section class="panel toolbar">
          <div>
            <h2>出力</h2>
            <p class="muted small">現在の判断結果を JSON / Markdown / CSV に変換します。</p>
          </div>
          <div class="btn-row">
            <button id="jsonButton" type="button">JSON</button>
            <button id="markdownButton" type="button">Markdown</button>
            <button id="csvButton" type="button">CSV</button>
          </div>
          <textarea id="outputArea" placeholder="ここに出力が表示されます"></textarea>
        </section>
      </aside>

      <main class="content">
        <section class="panel">
          <h2>Alias Groups</h2>
          <div class="cards" id="cardsRoot"></div>
        </section>
      </main>
    </div>
  </div>

  <script>
    const DATA = ${embedded};
    const state = {
      decisions: new Map(DATA.report.groups.map((group) => [group.groupId, suggestedDecision(group.aiEvaluation.status)])),
    };

    function suggestedDecision(status) {
      if (status === 'alias') return '同一グループでよい';
      if (status === 'separate') return '別扱い';
      return '保留';
    }

    const statsRoot = document.getElementById('stats');
    const cardsRoot = document.getElementById('cardsRoot');
    const outputArea = document.getElementById('outputArea');
    const searchInput = document.getElementById('searchInput');
    const aiStatusFilter = document.getElementById('aiStatusFilter');
    const decisionFilter = document.getElementById('decisionFilter');

    function buildStats() {
      const aliasCount = DATA.report.groups.filter((group) => group.aiEvaluation.status === 'alias').length;
      const reviewCount = DATA.report.groups.filter((group) => group.aiEvaluation.status === 'review').length;
      const separateCount = DATA.report.groups.filter((group) => group.aiEvaluation.status === 'separate').length;
      const stats = [
        ['総グループ数', DATA.report.totalGroups],
        ['AI alias', aliasCount],
        ['AI review', reviewCount],
        ['AI separate', separateCount],
      ];
      statsRoot.innerHTML = stats.map(([label, value]) => \`
        <div class="stat">
          <div class="muted small">\${label}</div>
          <strong>\${value}</strong>
        </div>
      \`).join('');
    }

    function buildFilters() {
      const aiStatuses = [...new Set(DATA.report.groups.map((group) => group.aiEvaluation.status))].sort();
      for (const value of aiStatuses) {
        aiStatusFilter.innerHTML += \`<option value="\${value}">\${value}</option>\`;
      }
      for (const value of DATA.reviewDecisions) {
        decisionFilter.innerHTML += \`<option value="\${value}">\${value}</option>\`;
      }
    }

    function currentDecision(groupId) {
      return state.decisions.get(groupId) || '';
    }

    function matches(group) {
      if (aiStatusFilter.value && group.aiEvaluation.status !== aiStatusFilter.value) return false;
      if (decisionFilter.value && currentDecision(group.groupId) !== decisionFilter.value) return false;

      const search = searchInput.value.trim().toLowerCase();
      if (!search) return true;

      const haystack = [
        group.groupId,
        group.comparableKey,
        group.suggestedCanonicalKey,
        group.suggestedCanonicalLabel,
        group.aiEvaluation.rationaleJa,
        group.aiEvaluation.cautionJa,
        group.heuristics.join(' '),
        ...group.terms.flatMap((term) => [term.key, term.label, term.note || '', term.sourceType]),
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    }

    function aiClass(status) {
      return \`ai-\${status}\`;
    }

    function renderTerms(group) {
      return group.terms.map((term) => \`
        <div class="term">
          <div class="term-head">
            <div>
              <strong>\${term.label}</strong>
              <div class="muted small">\${term.key}</div>
            </div>
            <span>\${term.sourceType}</span>
          </div>
          <div class="meta">
            \${term.articleCount ? \`<span>articleCount: \${term.articleCount}</span>\` : ''}
            \${term.seenCount ? \`<span>seenCount: \${term.seenCount}</span>\` : ''}
          </div>
          <div class="muted small">\${term.note || ''}</div>
        </div>
      \`).join('');
    }

    function renderCards() {
      const groups = DATA.report.groups.filter(matches);
      cardsRoot.innerHTML = groups.map((group) => \`
        <article class="card" data-group-id="\${group.groupId}">
          <div class="card-top">
            <div>
              <h3>\${group.groupId}</h3>
              <div class="muted small">comparableKey: \${group.comparableKey}</div>
            </div>
            <div class="meta">
              <span class="\${aiClass(group.aiEvaluation.status)}">AI: \${group.aiEvaluation.status}</span>
              <span>\${group.aiEvaluation.confidence}</span>
            </div>
          </div>
          <div class="meta">
            <span>heuristics: \${group.heuristics.join(', ')}</span>
            <span>canonical key: \${group.aiEvaluation.recommendedCanonicalKey || group.suggestedCanonicalKey}</span>
            <span>canonical label: \${group.aiEvaluation.recommendedCanonicalLabel || group.suggestedCanonicalLabel}</span>
          </div>
          <div class="muted small">\${group.aiEvaluation.rationaleJa}</div>
          <div class="note">\${group.aiEvaluation.cautionJa || '補足なし'}</div>
          <div class="radios">
            \${DATA.reviewDecisions.map((decision) => \`
              <label>
                <input
                  type="radio"
                  name="decision-\${group.groupId}"
                  value="\${decision}"
                  \${currentDecision(group.groupId) === decision ? 'checked' : ''}
                />
                <span>\${decision}</span>
              </label>
            \`).join('')}
          </div>
          <div class="term-list">
            \${renderTerms(group)}
          </div>
        </article>
      \`).join('');

      document.querySelectorAll('input[type="radio"]').forEach((input) => {
        input.addEventListener('change', (event) => {
          const target = event.currentTarget;
          const card = target.closest('[data-group-id]');
          if (!card) return;
          state.decisions.set(card.dataset.groupId, target.value);
        });
      });
    }

    function exportRows() {
      return DATA.report.groups.map((group) => ({
        groupId: group.groupId,
        comparableKey: group.comparableKey,
        heuristics: group.heuristics,
        aiStatus: group.aiEvaluation.status,
        aiConfidence: group.aiEvaluation.confidence,
        recommendedCanonicalKey: group.aiEvaluation.recommendedCanonicalKey || group.suggestedCanonicalKey,
        recommendedCanonicalLabel: group.aiEvaluation.recommendedCanonicalLabel || group.suggestedCanonicalLabel,
        decision: currentDecision(group.groupId),
        rationaleJa: group.aiEvaluation.rationaleJa,
        cautionJa: group.aiEvaluation.cautionJa,
        terms: group.terms,
      }));
    }

    function exportJson() {
      outputArea.value = JSON.stringify({
        generatedAt: new Date().toISOString(),
        decisions: exportRows(),
      }, null, 2);
    }

    function exportMarkdown() {
      const header = '| group_id | comparable_key | ai_status | ai_confidence | canonical_key | decision | terms | rationale | caution |';
      const sep = '| --- | --- | --- | --- | --- | --- | --- | --- | --- |';
      const lines = exportRows().map((row) => \`| \${row.groupId} | \${row.comparableKey} | \${row.aiStatus} | \${row.aiConfidence} | \${row.recommendedCanonicalKey} | \${row.decision} | \${row.terms.map((term) => term.key).join(', ')} | \${(row.rationaleJa || '').replace(/\\|/g, '/')} | \${(row.cautionJa || '').replace(/\\|/g, '/')} |\`);
      outputArea.value = ['# Tag Alias Decisions', '', header, sep, ...lines].join('\\n');
    }

    function csvEscape(value) {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      return '"' + text.replaceAll('"', '""') + '"';
    }

    function exportCsv() {
      const lines = [
        ['groupId', 'comparableKey', 'aiStatus', 'aiConfidence', 'recommendedCanonicalKey', 'recommendedCanonicalLabel', 'decision', 'terms', 'rationaleJa', 'cautionJa']
          .map(csvEscape)
          .join(','),
        ...exportRows().map((row) => [
          row.groupId,
          row.comparableKey,
          row.aiStatus,
          row.aiConfidence,
          row.recommendedCanonicalKey,
          row.recommendedCanonicalLabel,
          row.decision,
          row.terms.map((term) => term.key).join(', '),
          row.rationaleJa,
          row.cautionJa,
        ].map(csvEscape).join(',')),
      ];
      outputArea.value = lines.join('\\n');
    }

    document.getElementById('applySuggestedButton').addEventListener('click', () => {
      state.decisions = new Map(DATA.report.groups.map((group) => [group.groupId, suggestedDecision(group.aiEvaluation.status)]));
      renderCards();
    });
    document.getElementById('clearButton').addEventListener('click', () => {
      state.decisions = new Map();
      renderCards();
    });
    document.getElementById('jsonButton').addEventListener('click', exportJson);
    document.getElementById('markdownButton').addEventListener('click', exportMarkdown);
    document.getElementById('csvButton').addEventListener('click', exportCsv);
    searchInput.addEventListener('input', renderCards);
    aiStatusFilter.addEventListener('change', renderCards);
    decisionFilter.addEventListener('change', renderCards);

    buildStats();
    buildFilters();
    renderCards();
    exportJson();
  </script>
</body>
</html>`
}

async function main(): Promise<void> {
  const rootDir = readArg('--root', path.join(process.cwd(), 'af-20260326', 'phase1-retag'))
  const reportPath = path.join(rootDir, 'tag-alias-review.json')
  const outPath = path.join(rootDir, 'tag-alias-review.html')

  if (!fs.existsSync(reportPath)) {
    throw new Error(`tag alias review report not found: ${reportPath}`)
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as AliasReviewReport
  fs.writeFileSync(outPath, renderHtml(report), 'utf8')
  console.log(`outPath=${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
