# AI Trend Hub Implementation Hangover

最終更新: 2026-04-02

## 1. このファイルの役割

次セッション再開時に最初に読む短い handoff。履歴の詳細は残さず、現在有効な前提だけを維持する。

## 2. 現在の要点

- ブランチは `dev-default`
- 主要な L1 → L2 → L4 パイプラインは稼働済み
- 定時 batch は 2026-04-02 時点で GitHub Actions schedule を復旧済み
- 主要な残タスクは「タグ整理の確定」ではなく「公開面導線の実装と評価」
- Topic Group はスキーマ受け口のみで、本実装は未着手

## 3. いま有効な運用前提

- `alphaXiv` は source にしない
- `arXiv` を source とし、表示リンクだけ `alphaXiv` に置換する
- `arxiv-ai` は例外運用とし、5 か月超 raw は enrich 対象外、L4 は 2 か月保持上限
- `hourly-enrich` は毎時 `:05 / :10 / :15 / :20 / :25 / :30 / :35 / :40`
- `enrich-worker` の基本設定は `limit=20`, `summaryBatchSize=20`, `maxSummaryBatches=1`
- `hourly-publish` は毎時 `:50`
- `monthly-public-archive` は月次 batch として追加済み

## 4. タグ整理まわりの固定方針

- 1周目ではカテゴリを先に固定しない
- 主タグ / 周辺分野タグ / 新規立項タグ候補を属性として全件再構築する
- 2周目着手前にカテゴリ / 主タグ / 周辺分野タグの境界を確定する
- カテゴリは公開面サイドバー導線に使う前提
- 周辺分野タグは当面、通常タグと同じクリック導線に留める
- `paper` 専用タグマスタ新設は後続タスク

主タグの完全除外:
- `llm`
- `generative-ai`
- `rag`
- `agent`
- `huggingface`
- `hugging face`
- `paper`
- `policy`
- `safety`

カテゴリからも不要:
- `llm`
- `agent`
- `voice`

観察中のカテゴリ候補:
- `paper`
- `official`
- `news`
- `search-rag`
- `oss`
- `enterprise-ai`

## 5. 実装済みとして扱うもの

- `content_language`
- 日本語ソース 14 件
- `thumbnail_url` 内部テンプレート運用
- admin Phase 3
- OGP / sitemap / robots
- `daily-tag-dedup`
- `hourly-compute-ranks` 最適化
- 隣接分野タグ基盤と `thumbnail_bg_theme`
- L2/L4 全件 retag スクリプト
- Phase 1 正本に基づく新規主タグ 13 件の昇格と broad tag の inactive 化
- Home の自動更新停止と PWA/service worker の既定無効化

## 6. 次に見るファイル

1. `docs/imp/implementation-wait.md`
2. `docs/imp/implementation-plan.md`
3. `docs/imp/data-flow.md`
4. `agents-task-status.md`

## 7. 次セッションの first action

1. 公開面のカテゴリ / 主タグ / 周辺分野タグ導線を Web 実装として進める
2. 実画面を見ながらカテゴリ配置とタグ導線を評価する
3. 必要ならタグ参照 SQL を使って昇格 / 保留 / 導線判断を進める
4. `paper` 専用タグ群の要否は後続タスクとして切り分けたまま維持する
