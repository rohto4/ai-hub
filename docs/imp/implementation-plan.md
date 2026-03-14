# AI Trend Hub 実装計画

最終更新: 2026-03-15

## 1. 前提方針

1. Neon / PostgreSQL を正として進める
2. データ設計は `Layer1 -> Layer2 -> Layer3 -> Layer4`
3. サイトは `Layer4` のみを参照する
4. `Layer3` は手動承認層ではなく、運用データ層として扱う
5. タグマスタ追加だけは人の確認余地を残す
6. `source_priority_rules` の初期値はソース間優先差なしで始める
7. 類似重複は P0 では軽量実装に留め、必要なら後続で `pgvector` 寄りに拡張する

## 2. 現在地

### 2.1 いま進めているフェーズ

1. 現在の主対象は `Layer1 -> Layer2` の品質改善
2. 目的は「毎時バッチで Layer2 に安定して情報蓄積を開始できる状態」にすること
3. `Layer3` と `Layer4` はいったん保留

### 2.2 すでに完了したもの

1. `source_targets` 本番 seed
2. `source_priority_rules` 初期 seed
3. `tags_master` 初期 seed
4. `hourly-fetch` 実装
5. `daily-enrich` 実装
6. `job_runs` / `job_run_items` によるジョブ監視
7. Google Alerts redirect URL の補正
8. `db:check-layer12` による Layer1 / Layer2 診断
9. `similar_candidate` による初期 dedupe
10. `articles_enriched.is_provisional` / `provisional_reason` による仮蓄積フラグ追加
11. `hourly-layer12` 入口を追加し、`fetch -> enrich` の直列実行を route 化
12. GitHub Actions workflow `hourly-layer12.yml` を追加
13. `db:requeue-raw`, `db:check-snippet-domains`, `db:promote-tag-candidates` を追加

### 2.3 現在の実データ観測

1. `articles_raw = 162`
2. `articles_enriched = 162`
3. `source_targets` の有効件数は `11`
4. `content_access_policy` は `feed_only=9`, `fulltext_allowed=2`
5. 厳格運用へ切り替えた結果、現時点の `content_path=full = 2`, `is_provisional = 160`
6. `cdt.org` など blocked domain は `domain_snippet_only` で扱うが、P0 の主方針は source policy 優先
7. `dedupe_status` は `similar_candidate` が出始めている
8. `ai-news-roundup` は placeholder source のため `is_active=false` に切り替えた
9. `nvidia` は `tags_master` へ昇格済み

### 2.4 今の主課題

1. `source_targets.content_access_policy` の整理と維持
  - `db:check-source-policies` で source ごとの `policy / raw / full / provisional` を見る
  - `db:set-source-policy -- --requeue` で昇格と再処理を一体で行う
2. `tag_candidate_pool` のノイズ削減
3. URL 一致より先の dedupe 強化
4. blocked domain と source policy の切り分け
5. 毎時バッチの直列実行と小分け処理の運用固定
6. source ごとの 404 / feed 廃止候補の見直し
7. residual snippet-only domain 群の整理
8. `tag_candidate_pool` の昇格後ノイズ抑制

## 3. 全体タスク一覧

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
5. 毎時バッチの直列実行フロー確定

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

## 4. いま何をどう進めるか

### 4.1 Layer1 / Layer2 品質改善

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
  - 許可された source だけ本文を使い、それ以外は snippet で評価継続する
- どうやるか:
 - `source_targets.content_access_policy` を `feed_only` / `fulltext_allowed` / `blocked_snippet_only` で管理する
  - `fulltext_allowed` source に限って extractor 改善を行う
  - `db:check-layer12` の `Latest Enrich Diagnostics` / `Latest Enrich Failures` と `provisional_reason=feed_only_policy` で policy 起因の snippet 蓄積を確認する
- 完了条件:
  - 本文取得可否が policy に反しない形で安定する

#### A-3. blocked domain / snippet-only domain の整理

- 何をやるか:
  - 取得できない媒体を「障害」ではなく「仕様として snippet-only」に切り分ける
- どうやるか:
  - Cloudflare / 403 / bot block の媒体を洗い出す
  - `resolveArticleContent` で domain 単位の扱いを追加する
  - `articles_enriched.is_provisional` / `provisional_reason` と `db:check-snippet-domains` で snippet-only 群を可視化する
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
  - `is_provisional=true` の記事は `publish_candidate=false` に固定する
- 完了条件:
  - 明らかに公開向きでない記事が `publish_candidate=true` になりにくい

#### A-7. `db:check-layer12` と `job_runs` の監視拡張

- 何をやるか:
  - 改善サイクルを DB とターミナルだけで回せるようにする
- どうやるか:
  - 最新ジョブ結果、失敗記事、抽出段階、候補タグ上位を見える化する
  - provisional 件数 / provisional reason / snippet domain 上位を見える化する
- 完了条件:
  - 「何が失敗したか」「どこを直すべきか」が毎回すぐ分かる

### 4.2 Layer1 / Layer2 運用整備

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
  - 特定 raw を再投入する `db:requeue-raw` を使える状態にする
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

#### B-5. 毎時バッチの直列実行フロー確定

- 何をやるか:
  - 毎時蓄積を「fetch のあと enrich が直列に小分け実行される」形にする
- どうやるか:
  - `daily-enrich` 相当の命名・入口を毎時運用向けに整理する
  - 1 回あたりの件数を小分けにして、直列に流す
  - 実行順を `fetch -> enrich` に固定する
  - route `hourly-layer12` と GitHub Actions `hourly-layer12.yml` を揃える
- 完了条件:
  - 起床後に source 追加と軽微な閾値調整だけで毎時蓄積を開始できる

### 4.3 Tag 運用

#### C-1. `tag_candidate_pool` から `tags_master` への昇格基準整理

- 何をやるか:
  - どの候補を本タグに昇格させるか決める
- どうやるか:
  - `seen_count`, source の広がり、Google Trends, 手動 review を条件化する
  - P0 は `seen_count >= 8` の高閾値で保守運用し、`db:promote-tag-candidates` で dry-run / apply できる状態にする
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

### 4.4 Publish 系

- 何をやるか:
  - Layer2 から公開用テーブル群を作る
- どうやるか:
  - `hourly-publish` で representative source, tags, rankings を投影する
- 完了条件:
  - `public_*` テーブルを UI が読める

### 4.5 Layer3

- 何をやるか:
  - 運用ログ・行動ログ・優先処理キューを整備する
- どうやるか:
  - `activity_logs`, `activity_metrics_hourly`, `admin_operation_logs`, `priority_processing_queue` を順に実装する
- 完了条件:
  - 運用系の変更や後続処理を記録できる

### 4.6 Layer4

- 何をやるか:
  - 公開 UI と API をつなぐ
- どうやるか:
  - `public_articles` 系を読む API / 画面を実装する
- 完了条件:
  - サイトが `Layer4` だけを参照して表示できる

## 5. 直近の着手順

1. まず `Layer1 -> Layer2` の品質改善を完了する
2. 次に Layer2 運用整備と tag 運用を固める
3. そのあと publish 系を実装する
4. 最後に `Layer3` と `Layer4` を再開する

## 6. Layer1 / Layer2 実行チェックリスト

1. `DATABASE_URL` と `DATABASE_URL_UNPOOLED` を確認する
2. migration を適用する
3. 初期 seed を投入する
4. `hourly-fetch` を手動実行し、`articles_raw` への投入を確認する
5. enrich ジョブを手動実行し、`articles_enriched` / `articles_enriched_tags` / `tag_candidate_pool` を確認する
6. `db:check-layer12` で件数・失敗・抽出診断・provisional 状態を確認する
7. `db:check-snippet-domains` で blocked / snippet-only 傾向を確認する
8. 必要に応じて repair / prune / 再処理を行う

## 7. 関連ドキュメント

1. `docs/imp/imp-hangover.md`
2. `docs/imp/imp-status.md`
3. `docs/imp/implementation-wait.md`
4. `docs/spec/04-data-model-and-sql.md`
5. `docs/spec/05-ingestion-and-ai-pipeline.md`
6. `docs/spec/10-ingestion-layer-design.md`
7. `docs/spec/11-batch-job-design.md`
8. `docs/memo/20260313_source_target_candidates.md`
