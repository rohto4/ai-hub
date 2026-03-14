# AI Trend Hub 実装計画

最終更新: 2026-03-13

## 1. 現在の実装方針

1. Neon/PostgreSQL を正として進める
2. データ設計は `layer1 -> layer2 -> layer3 -> layer4`
3. サイトは `layer4` のみを参照する
4. `layer3` は手動承認層ではなく運用データ層
5. タグマスタ追加だけ、人の確認余地を残す
6. タグ候補昇格閾値は暫定で `seen_count >= 5`
7. Google Trends 一致判定は日本語基準の類似一致で進める
8. 類似重複は P0 では本格実装せず、後続は `pgvector` 寄りで扱う
9. `public_rankings` は 1 週間でスコアが `1/5` になる時間減衰を暫定採用する
10. `share_count` と `save_count` は同重み、`source_open_count` はその 2 倍、`impression_count` はその 1/2 とする
11. ソース別優先度は初期未実装とし、`source_priority_rules` 初期値はソース間優先差なしで始める
12. 運営即時反映は P0 では `hide_article` を優先対象にする
13. `layer4` は P0 はテーブル中心とし、一部 view を許容する
14. タグ人手レビュー UI は実装対象とし、自動モードと判断待ちモードを持てる前提で進める

## 2. 直近で完了したこと

1. `layer1` から `layer4` の設計を文書化した
2. migrations を新設計に合わせて刷新した
3. `docs/spec` を取得系中心に更新した
4. `docs/mock3` を追加し、公開層中心のモックを作成した

## 2.5 現在地

### いま進めているフェーズ

1. 現在の主対象は `Layer1 -> Layer2` の品質改善
2. 目的は「情報蓄積を高品質で安定開始できる状態」にすること
3. `Layer3` と `Layer4` はいったん保留

### このフェーズで完了したもの

1. `source_targets` 本番 seed
2. `source_priority_rules` 初期 seed
3. `tags_master` 初期 seed
4. `hourly-fetch` 実装
5. `daily-enrich` 実装
6. `job_runs` / `job_run_items` によるジョブ監視
7. Google Alerts redirect URL の補正
8. `db:check-layer12` による抽出診断
9. `similar_candidate` による初期 dedupe

### いま改善中のもの

1. `content_path=full` の比率改善
2. `tag_candidate_pool` のノイズ削減
3. URL 一致より先の dedupe 強化
4. blocked domain と通常 fetch failure の切り分け

### 現時点で分かっていること

1. 本文抽出率が低かった主因は、Google Alerts が実記事 URL ではなく `google.com/url` を保存していたこと
2. URL 補正後、`content_path=full` は `2` から `10` まで改善
3. `time.com` は取得・抽出可能
4. `cdt.org` は現在 Cloudflare により `domain_snippet_only` 扱い
5. dedupe は `similar_candidate` が出始めている

### 次の優先

1. 候補タグの条件をさらに厳しくして一般名詞ノイズを減らす
2. title ベース dedupe を広げて `similar_candidate` の検出精度を上げる
3. snippet-only にすべき blocked domain を増やして切り分けを明確にする
4. `content_path=full` をさらに増やす
5. Layer2 品質が十分になってから `Layer3` と `Layer4` を再開する

## 2.6 全体タスク一覧

### A. Layer1 / Layer2 品質改善

1. Google Alerts 系 source のノイズ削減
2. `content_path=full` 抽出率の改善
3. blocked domain / snippet-only domain の整理
4. dedupe の精度改善
5. `tag_candidate_pool` のノイズ削減
6. `publish_candidate` 判定の見直し
7. `db:check-layer12` と `job_runs` の監視拡張

### B. Layer1 / Layer2 運用整備

1. seed / repair / check 系スクリプトの整理
2. 定期実行時の再処理方針整理
3. source 単位エラーの蓄積と可視化
4. 初回投入後の運用チェック手順の固定化

### C. Tag 運用

1. `tag_candidate_pool` から `tags_master` への昇格基準整理
2. alias 整備
3. Google Trends 連携の前提整理
4. タグ review 用の運用フロー整理

### D. Publish 系

1. `hourly-publish`
2. `public_articles`
3. `public_article_sources`
4. `public_article_tags`
5. `public_rankings`

### E. Layer3

1. `activity_logs`
2. `activity_metrics_hourly`
3. `admin_operation_logs`
4. `priority_processing_queue`
5. `hide_article` などの運用系処理

### F. Layer4

1. 公開 API 接続
2. 閲覧 UI
3. ランキング表示
4. タグページ
5. 運用 UI

### 推奨着手順

1. まず `Layer1 -> Layer2` の品質改善を完了する
2. 次に Layer2 運用整備と tag 運用を固める
3. そのあと publish 系を実装する
4. 最後に `Layer3` と `Layer4` を再開する

## 2.7 タスクごとの進め方

### A. Layer1 / Layer2 品質改善

#### A-1. Google Alerts 系 source のノイズ削減

- 何をやるか:
  - source ごとの relevance 判定を強めて、alert 語に引っ張られた誤収集を減らす
- どうやるか:
  - `source_key` ごとに title / snippet の必須語・除外語を見直す
  - Google redirect URL は unwrap 済み前提で、実記事 URL ベースに判定する
  - `db:check-layer12` の `Latest Enriched` と `score=34/59` 群を見て誤判定を潰す
- 完了条件:
  - 明らかなノイズ記事が `publish_candidate=true` に乗らない

#### A-2. `content_path=full` 抽出率の改善

- 何をやるか:
  - snippet ではなく本文を使える記事を増やす
- どうやるか:
  - extractor の selector を追加する
  - blocked domain は `domain_snippet_only` として分離する
  - `db:check-layer12` の `Latest Enrich Diagnostics` で `extracted` / `fetch_error` / `domain_snippet_only` を追う
- 完了条件:
  - 対象 source のうち、本文取得できる媒体は安定して `full` に入る

#### A-3. blocked domain / snippet-only domain の整理

- 何をやるか:
  - 取得できない媒体を「障害」ではなく「仕様として snippet-only」に切り分ける
- どうやるか:
  - Cloudflare / 403 / bot block の媒体を洗い出す
  - `resolveArticleContent` で domain 単位の扱いを追加する
- 完了条件:
  - fetch block が一般的な `fetch_error` と混ざらない

#### A-4. dedupe の精度改善

- 何をやるか:
  - URL 一致だけでなく、見出し近似で同一話題を束ねる
- どうやるか:
  - `buildHeadlineSignature()` を使って `similar_candidate` を増やす
  - 再処理で同一話題の別 URL 記事を流し、`dedupe_status` を確認する
- 完了条件:
  - 同一話題の複数記事が `similar_candidate` でまとまり始める

#### A-5. `tag_candidate_pool` のノイズ削減

- 何をやるか:
  - 一般名詞や文脈依存語ではなく、昇格候補になる語だけを残す
- どうやるか:
  - candidate 生成を `full` 記事中心に寄せる
  - stopword / generic phrase を増やす
  - 必要なら既存候補を prune する
- 完了条件:
  - `player`, `china`, `buffet` のような汎用語が上位に出続けない

#### A-6. `publish_candidate` 判定の見直し

- 何をやるか:
  - `full=true` だけで publish 候補になりすぎるのを防ぐ
- どうやるか:
  - relevance, dedupe, tag 数, source 種別を組み合わせて条件を調整する
- 完了条件:
  - 明らかに公開向きでない記事が `publish_candidate=true` になりにくい

#### A-7. `db:check-layer12` と `job_runs` の監視拡張

- 何をやるか:
  - 改善サイクルを DB とターミナルだけで回せるようにする
- どうやるか:
  - 最新ジョブ結果、失敗記事、抽出段階、候補タグ上位を見える化する
- 完了条件:
  - 「何が失敗したか」「どこを直すべきか」が毎回すぐ分かる

### B. Layer1 / Layer2 運用整備

#### B-1. seed / repair / check 系スクリプトの整理

- 何をやるか:
  - 初期化・補正・確認の作業を定型化する
- どうやるか:
  - `db:seed`, `db:repair-google-alerts-urls`, `db:prune-tag-candidates`, `db:check-layer12` を整理する
- 完了条件:
  - 手動運用時の実行順が固定できる

#### B-2. 定期実行時の再処理方針整理

- 何をやるか:
  - 失敗時・仕様変更時の再実行方法を決める
- どうやるか:
  - `is_processed=false`, `process_after=now()` の再処理手順を文書化する
- 完了条件:
  - 再実行手順が人に依存しない

#### B-3. source 単位エラーの蓄積と可視化

- 何をやるか:
  - source 単位の失敗をあとから追えるようにする
- どうやるか:
  - `job_runs` / `job_run_items` に source 情報を積む
  - 必要なら `implementation-wait.md` の pending を解消する
- 完了条件:
  - source ごとの失敗傾向を確認できる

#### B-4. 初回投入後の運用チェック手順の固定化

- 何をやるか:
  - 新環境で同じ確認を再現できるようにする
- どうやるか:
  - setup 手順、確認 SQL、監視コマンドを plan / status に残す
- 完了条件:
  - 別タイミングでも同じ品質確認ができる

### C. Tag 運用

#### C-1. `tag_candidate_pool` から `tags_master` への昇格基準整理

- 何をやるか:
  - どの候補を本タグに昇格させるか決める
- どうやるか:
  - `seen_count`, source の広がり、Google Trends, 手動 review を条件化する
- 完了条件:
  - 昇格基準が定義される

#### C-2. alias 整備

- 何をやるか:
  - 同義語・表記揺れを tag match に吸収させる
- どうやるか:
  - `tag_aliases` を更新し、match 精度を上げる
- 完了条件:
  - 同じ概念が複数 candidate に割れにくくなる

#### C-3. Google Trends 連携の前提整理

- 何をやるか:
  - tag 候補の裏取り方法を決める
- どうやるか:
  - 取得方法、頻度、スコア保存先を整理する
- 完了条件:
  - 実装前提が固まる

#### C-4. タグ review 用の運用フロー整理

- 何をやるか:
  - 人手確認が必要な箇所を限定する
- どうやるか:
  - `manual_review`, `promoted`, `rejected` の扱いを決める
- 完了条件:
  - tag review の運用が説明できる

### D. Publish 系

- 何をやるか:
  - Layer2 から公開用テーブル群を作る
- どうやるか:
  - `hourly-publish` で representative source, tags, rankings を投影する
- 完了条件:
  - `public_*` テーブルを UI が読める

### E. Layer3

- 何をやるか:
  - 運用ログ・行動ログ・優先処理キューを整備する
- どうやるか:
  - `activity_logs`, `activity_metrics_hourly`, `admin_operation_logs`, `priority_processing_queue` を順に実装する
- 完了条件:
  - 運用系の変更や後続処理を記録できる

### F. Layer4

- 何をやるか:
  - 公開 UI と API をつなぐ
- どうやるか:
  - `public_articles` 系を読む API / 画面を実装する
- 完了条件:
  - サイトが `Layer4` だけを参照して表示できる

## 3. 全体の次フェーズ

### Phase A: DB 基盤

1. `migrations/001` から `009` までの整合確認
2. Neon 上で migration 適用確認
3. 初期 seed 方針の確定

### Phase B: Layer1

1. `source_targets` seed
2. URL 正規化 utility
3. hourly fetch job
4. `articles_raw` insert / update detection helper

### Phase C: Layer2

1. extractor abstraction
2. summarizer
3. tag matcher
4. `articles_enriched` writer
5. `articles_enriched_history` 保存
6. `tag_candidate_pool` 更新

### Phase D: Publish

1. representative source selector
2. `public_articles` projector
3. `public_article_sources` projector
4. `public_article_tags` projector
5. `public_rankings` calculator
6. 暫定ランキング式の実装

### Phase E: Layer3

1. `activity_logs` 収集 API
2. `activity_metrics_hourly` 集計
3. `admin_operation_logs` 記録
4. `priority_processing_queue` 実行 worker
5. P0 は `hide_article` 即時反映を優先

### Phase F: Tag Operations

1. 日次タグ候補集計
2. Google Trends 照合
3. `tags_master` / `tag_aliases` 昇格
4. 再タグ付け処理
5. タグ人手レビュー UI 前提の review 状態管理

### Phase G: Archive / Operations

1. `articles_raw` 週次アーカイブ
2. 履歴・補助データ整理
3. 監視ログ整備

## 4. Layer1 / Layer2 実装区画

この区画は、NeonDB に migration を適用し、実際に `layer1` と `layer2` を動かすための実装だけに絞る。  
再開時はこの区画から順に着手する。

### 4.0 先に開くドキュメント

1. `docs/imp/imp-hangover.md`
2. `docs/spec/11-batch-job-design.md`
3. `docs/memo/20260313_source_target_candidates.md`
4. `docs/spec/10-ingestion-layer-design.md`
5. `docs/spec/05-ingestion-and-ai-pipeline.md`
6. `docs/spec/04-data-model-and-sql.md`
7. `migrations/001_extensions.sql` から `migrations/009_rls.sql`

### 4.1 ゴール

1. Neon 上に `source_targets` / `articles_raw` / `articles_enriched` 系テーブルを作成する
2. 外部取得データを `articles_raw` へ投入できる
3. `articles_raw` から `articles_enriched` を生成できる
4. 更新検知時に再整形できる
5. 記事単位失敗でスキップしつつジョブ全体を継続できる

### 4.2 対象 migration

1. `migrations/001_extensions.sql`
   - `pgcrypto`, `vector`
2. `migrations/002_source_targets.sql`
   - `source_targets`, `source_priority_rules`
3. `migrations/003_articles_raw.sql`
   - `articles_raw`, `articles_raw_history`
4. `migrations/004_articles_enriched.sql`
   - `tags_master`, `tag_aliases`, `tag_candidate_pool`, `articles_enriched`, `articles_enriched_history`, `articles_enriched_tags`
5. `migrations/008_batch_support.sql`
   - `updated_at` trigger
6. `migrations/009_rls.sql`
   - 公開 / 内部の権限境界

### 4.3 Neon 適用手順

1. `DATABASE_URL` と `DATABASE_URL_UNPOOLED` を確認する
2. Neon の対象 branch を確認する
3. migration を順番に適用する
4. `source_targets` の seed を投入する
5. `source_priority_rules` の seed を投入する
6. `tags_master` の初期 seed を投入する

### 4.4 Layer1 実装タスク

1. `source_targets` を読む collector registry を作る
2. URL 正規化 utility を作る
3. `articles_raw` insert helper を作る
4. `source_target_id + normalized_url + source_updated_at / snippet_hash` で更新検知する
5. hourly fetch job を実装する
6. 失敗時は `articles_raw.last_error` に記録する

### 4.5 Layer2 実装タスク

1. 未処理 `articles_raw` を取得する reader を作る
2. `full` / `snippet` 判定付きの extractor abstraction を作る
3. summarizer を作る
4. tag matcher を作る
5. `tag_candidate_pool` updater を作る
6. Google Trends 照合対象の暫定閾値 `seen_count >= 5` を定数化する
7. 確定重複判定を `dedupe_status` に反映する
8. `articles_enriched` writer を作る
9. 更新時は旧版を `articles_enriched_history` に退避する
10. `articles_enriched_tags` を同期する

### 4.6 ジョブ分割

1. `hourly-fetch`
   - 取得して `articles_raw` に入れる
2. `daily-enrich`
   - `articles_raw` から `articles_enriched` を生成する
3. `daily-tag-promote`
   - `tag_candidate_pool` を集計し `tags_master` へ昇格する
   - 日本語基準の類似一致で Google Trends を照合する
4. `weekly-archive`
   - `articles_raw` を `articles_raw_history` へ移す

### 4.6.1 暫定運用ルール

1. タグ昇格:
   - `seen_count >= 5` を Google Trends 照合対象にする
2. Google Trends:
   - 日本語基準の類似一致で評価する
3. 類似重複:
   - P0 では確定重複のみ実装し、類似重複は後続へ送る
4. ランキング:
   - 1 週間でスコアが `1/5` になる時間減衰を採用する
   - `share_count` と `save_count` は同重み
   - `source_open_count` はその 2 倍重み
   - `impression_count` はその 1/2 重み
5. 即時反映キュー:
   - P0 では `hide_article` を優先対象にする
6. `source_priority_rules`:
   - 初期はソース間優先差なしで開始する

### 4.7 実行順チェックリスト

1. Neon 接続情報を確認する
   - `DATABASE_URL`
   - `DATABASE_URL_UNPOOLED`
2. migration を適用する
   - `001_extensions.sql`
   - `002_source_targets.sql`
   - `003_articles_raw.sql`
   - `004_articles_enriched.sql`
   - `008_batch_support.sql`
   - `009_rls.sql`
3. 初期 seed を投入する
   - `source_targets`
   - `source_priority_rules`
   - `tags_master`
4. `hourly-fetch` を手動実行し、`articles_raw` へ投入確認する
5. `daily-enrich` を手動実行し、`articles_enriched` / `articles_enriched_tags` / `tag_candidate_pool` を確認する
6. 更新データを再投入し、`articles_enriched_history` への退避を確認する

### 4.8 実装単位

1. `src/lib/collectors`
   - `source_targets` を読む collector registry
2. `src/lib/dedupe`
   - URL 正規化
   - 確定重複判定
3. `src/lib/extractors`
   - `full` / `snippet` 判定
4. `src/lib/ai`
   - summarizer
5. `src/lib/tags`
   - tag matcher
   - candidate updater
6. `src/lib/db`
   - `articles_raw` helper
   - `articles_enriched` helper
   - history writer
7. `src/app/api/cron`
   - `hourly-fetch`
   - `daily-enrich`

### 4.9 検証観点

1. `articles_raw`
   - `normalized_url` が期待通りに入る
   - `is_processed` 初期値が `false`
   - 更新時に `has_source_update` が立つ
2. `articles_enriched`
   - `summary_100` / `summary_200` / `summary_300` が入る
   - `content_path` が `full` または `snippet`
   - `dedupe_status` が確定重複条件に応じて更新される
3. `articles_enriched_tags`
   - マスタ一致タグだけ入る
4. `tag_candidate_pool`
   - 未採用タグだけ入る
5. `articles_enriched_history`
   - 更新時のみ旧版が残る

### 4.10 完了条件

1. 手動で `source_targets` を 1 件以上投入すると `articles_raw` へデータが入る
2. `articles_raw` に未処理データがあると `articles_enriched` が生成される
3. `articles_enriched_tags` と `tag_candidate_pool` が更新される
4. 同一記事更新時に `articles_enriched_history` へ旧版が残る
5. 1 件失敗しても残り記事は継続処理される

### 4.11 2026-03-13 時点の実績

1. `npm run db:migrate` 実行済み
2. `npm run db:seed` を `layer1 / layer2` 向け seed に刷新して実行済み
3. 確認済み件数
   - `source_targets`: 3
   - `articles_raw`: 3
   - `articles_enriched`: 3
4. `articles_raw.is_processed = true` まで確認済み

## 5. ウェブサイト側が進められる状態

現時点で、ウェブサイト側は次を前に進められる。

1. `layer4` を前提にした一覧 API 設計
2. `public_articles` / `public_article_tags` / `public_rankings` を前提にした UI 実装
3. 関連ソース表示の設計
4. タグレーダー、運用キュー、Digest 表示の UI 検討

## 6. 実装チェックポイント

1. 確定重複は `normalized_url` / 同一引用元だけで扱う
2. 類似重複は後段判定に回す
3. 更新検知は `source_updated_at` または `snippet_hash` 差分で行う
4. 記事単位失敗でスキップし、ジョブ全体は止めない
5. サイトは `layer2` を直接参照しない

## 7. 関連ドキュメント

1. `docs/memo/20260312-data-design.md`
2. `docs/spec/04-data-model-and-sql.md`
3. `docs/spec/05-ingestion-and-ai-pipeline.md`
4. `docs/spec/10-ingestion-layer-design.md`
5. `docs/spec/11-batch-job-design.md`
6. `docs/memo/20260313_source_target_candidates.md`
7. `docs/imp/imp-hangover.md`
## 現在地

最終更新: 2026-03-14

### いま進めているフェーズ

- 現在の主対象: `Layer1 -> Layer2` の品質改善
- 現在の主目的: 情報蓄積を高品質で安定開始できる状態にする
- いったん保留: `Layer3`, `Layer4`

### このフェーズで完了したもの

- `source_targets` 本番 seed
- `source_priority_rules` 初期 seed
- `tags_master` 初期 seed
- `hourly-fetch` 実装
- `daily-enrich` 実装
- `job_runs` / `job_run_items` によるジョブ監視
- Google Alerts redirect URL の補正
- `db:check-layer12` による抽出診断
- `similar_candidate` による初期重複判定

### いま改善中のもの

- `content_path=full` の比率改善
- `tag_candidate_pool` のノイズ削減
- URL 一致より先の dedupe 強化
- blocked domain と通常 fetch failure の切り分け

### 現時点で分かっていること

- 本文抽出率が低かった主因は、Google Alerts が実記事 URL ではなく `google.com/url` を保存していたこと
- URL 補正後、`content_path=full` は `2` から `10` まで改善
- `time.com` は取得・抽出可能
- `cdt.org` は現在 Cloudflare により `domain_snippet_only` 扱い
- dedupe は `similar_candidate` が出始めている

### 次の優先

1. 候補タグの条件をさらに厳しくして一般名詞ノイズを減らす
2. title ベース dedupe を広げて `similar_candidate` の検出精度を上げる
3. snippet-only にすべき blocked domain を増やして切り分けを明確にする
4. `content_path=full` をさらに増やす
5. Layer2 品質が十分になってから `Layer3` と `Layer4` を再開する
### 全体タスク一覧

#### A. Layer1 / Layer2 品質改善

1. Google Alerts 系 source のノイズ削減
2. `content_path=full` 抽出率の改善
3. blocked domain / snippet-only domain の整理
4. dedupe の精度改善
5. `tag_candidate_pool` のノイズ削減
6. `publish_candidate` 判定の見直し
7. `db:check-layer12` と `job_runs` の監視拡張

#### B. Layer1 / Layer2 運用整備

1. seed / repair / check 系スクリプトの整理
2. 定期実行時の再処理方針整理
3. source 単位エラーの蓄積と可視化
4. 初回投入後の運用チェック手順の固定化

#### C. Tag 運用

1. `tag_candidate_pool` から `tags_master` への昇格基準整理
2. alias 整備
3. Google Trends 連携の前提整理
4. タグ review 用の運用フロー整理

#### D. Publish 系

1. `hourly-publish`
2. `public_articles`
3. `public_article_sources`
4. `public_article_tags`
5. `public_rankings`

#### E. Layer3

1. `activity_logs`
2. `activity_metrics_hourly`
3. `admin_operation_logs`
4. `priority_processing_queue`
5. `hide_article` などの運用系処理

#### F. Layer4

1. 公開 API 接続
2. 閲覧 UI
3. ランキング表示
4. タグページ
5. 運用 UI

### 推奨着手順

1. まず `Layer1 -> Layer2` の品質改善を完了する
2. 次に Layer2 運用整備と tag 運用を固める
3. そのあと publish 系を実装する
4. 最後に `Layer3` と `Layer4` を再開する
