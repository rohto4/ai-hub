# AI Trend Hub 実装ステータス

最終更新: 2026-03-25

運用ルール:
- 履歴は最新 50 件相当までを目安に残し、古い詳細は別ファイルへ逃がす
- 先頭には必ず「現在の状態」と「次の確認事項」を置く
- 実装履歴の詳細な時系列は `agents-task-status.md` と `imp-hangover.md` に分散しすぎない

## 1. 現在の状態

- Layer 1 → Layer 2 → Layer 4 の自動パイプラインは稼働済み
- `content_language`、日本語ソース 14 件、`thumbnail_url`、admin Phase 3、OGP、sitemap、robots は実装済み
- `daily-tag-dedup` まで含めてタグ系の基本運用は実装済み
- `hourly-compute-ranks` は最適化済みだが、係数調整は未着手
- Topic Group はスキーマ受け口のみで、本実装は未着手

## 2. 直近で重要な運用状態

### 2.1 公開・収集まわり

- `alphaXiv` は収集 source にしない
- `arXiv` を収集 source とし、公開画面でだけ `alphaXiv` へ置換する
- `paper` は同一ドメイン 1 件まで、それ以外は同一ドメイン 2 件までに抑制する
- `enrich-worker` は 6 か月超の raw を claim 前に skip する
- `arxiv-ai` は例外運用とし、5 か月超 raw は enrich 対象外、L4 は 2 か月保持上限とする実装を追加した
- 定時 enrich は `limit=20`, `summaryBatchSize=20`, `maxSummaryBatches=1` を毎時 8 回（`:05`〜`:40` の 5 分刻み）で回す構成に更新した

### 2.2 `arxiv-ai` backlog

- `alphaxiv-ai` は停止済み
- `arxiv-ai` は再有効化済み
- 直近確認時点で `articles_raw total=1870`, `unprocessed=1840`
- `source_published_at < now() - 5 months` は 0 件、`public_articles` の 2 か月超も 0 件
- `job_run_id=563` の `hourly-fetch` が進行していた形跡あり
- `enrich` は未実行。件数・時間帯・Gemini API 負荷を見てから判断する

## 3. 今の残タスク

### 優先

1. `arxiv-ai` backlog の現状確認
2. `job_run_id=563` 周辺の fetch 停滞有無確認
3. enrich 実行可否の判断材料整理

### 後続

1. `hourly-compute-ranks` 係数を実データで点検・調整する
2. Topic Group 本実装
3. 言語フィルタ UI の要否判断
4. tag alias 管理 UI の要否判断
5. `push_subscriptions.genres` rename の判断

## 4. 直近の重要変更

1. `alphaXiv` 非採用、`arXiv` 収集 + 公開時置換へ方針固定
2. `enrich-worker` に 6 か月超 raw の skip を追加
3. `arxiv-ai` は 5 か月超 raw を enrich 対象外、L4 は 2 か月保持にする方針で確定
4. `arxiv-ai` の source 別保持月数を `src/lib/source-retention.ts` に集約し、enrich / archive 両方から参照する実装を追加
5. `enrich-worker` の基本設定を `20件 x 8回/時` に拡張し、scheduler / route / docs を同期更新
6. `/admin/jobs` 向けの `job_runs` 件数定義をレコード単位へ寄せ、all success 時に `処理 n / 成功 n` になりやすいよう整理した
7. 公開一覧系にドメイン偏重抑制を追加
8. `thumbnail_url` backfill を追加し既存データへ再同期
9. 旧 `/api/thumb` URL の互換維持を追加
10. サムネイルを icon-only 合成へ変更
11. `icon_pending` 可視化を `/admin/tags` に追加
12. `daily-tag-dedup` を追加し、L2/L4 への遡及タグ付けを実装
13. `hourly-compute-ranks` を `job_runs` に追加
14. `public_article_sources` bigint バグを修正し全件バックフィル
15. admin Phase 3 を実装
16. `content_language` を公開 API へ常時伝搬
17. 日本語ソース 14 件を seed 済み
18. OGP / sitemap / robots を追加
19. `monthly-public-archive` を追加

## 5. 参照順

1. `docs/imp/imp-hangover.md`
2. `docs/imp/implementation-wait.md`
3. `docs/imp/implementation-plan.md`
4. `docs/imp/data-flow.md`
5. `agents-task-status.md`
