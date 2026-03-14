# バッチジョブ設計

最終更新: 2026-03-13

## 1. 目的

この文書は、AI Trend Hub の定期実行ジョブと即時実行ジョブを、実装単位で固定するための仕様書です。  
`05-ingestion-and-ai-pipeline.md` が全体フロー、`10-ingestion-layer-design.md` が取得系のレイヤー責務を扱うのに対し、この文書は「どのジョブが、何を入力にして、何を更新し、どの順で動くか」を正とします。

## 2. バッチ設計の基本方針

1. P0 ではジョブを責務単位で分割する
2. 時間粒度と責務粒度は一致させない
3. 毎時系は `fetch` と `publish` を別ジョブに分ける
4. 即時反映は定期バッチに混ぜず、優先キュー経由で処理する
5. 記事単位失敗でスキップし、ジョブ全体は止めない
6. ローカル定期実行と GitHub Actions scheduled の両方から呼べる entrypoint にする

## 3. P0 で必要なジョブ一覧

1. `hourly-fetch`
2. `daily-enrich`
3. `hourly-publish`
4. `daily-tag-promote`
5. `weekly-archive`
6. `priority-queue-worker`

## 4. ジョブ別仕様

---

> ==========================================================================================

### 4.1 `hourly-fetch`

> 毎時で新着・更新候補を取り込み、`layer1` を更新する入口ジョブ。

- 目的
    - 有効な取得元から新着・更新候補を取得し、`layer1` を更新する

- 入力
    - `source_targets`
    - 外部 RSS / API / Alerts

- 主処理
    - 実行対象 `source_targets` を取得する
    - source ごとに collector を選ぶ
    - 取得結果を標準フォーマットへ変換する
    - URL 正規化を行う
    - `source_target_id + normalized_url + source_updated_at / snippet_hash` で更新検知する
    - `articles_raw` を追加する
    - 更新対象には `has_source_update = true` を立てる
    - 失敗時は `last_error` を残す

- 更新先
    - `articles_raw`

- 出力
    - 未処理または再処理対象の raw レコード

- P0 の実装範囲
    - collector registry
    - URL 正規化
    - raw insert helper
    - 更新検知

---
> ==========================================================================================

### 4.2 `daily-enrich`

> `layer1` から `layer2` を生成する整形ジョブ。取得系の中核。

- 目的
    - `layer1` の raw データを整形し、`layer2` を生成する

- 入力
    - `articles_raw`
    - `tags_master`
    - `tag_aliases`

- 主処理
    - 未処理または再整形対象の raw を取得する
    - `full` / `snippet` を判定する
    - 要約を生成する
      - `summary_100`
      - `summary_200`
      - `summary_300`
    - タグ候補を抽出する
    - `tags_master` / `tag_aliases` に照合する
      - 一致タグを `articles_enriched_tags` へ保存する
      - 未採用タグを `tag_candidate_pool` へ蓄積する
    - 確定重複を判定する
    - `articles_enriched` を upsert する
    - 更新時は旧版を `articles_enriched_history` に退避する
    - `articles_raw.is_processed = true` を更新する

- 更新先
    - `articles_enriched`
    - `articles_enriched_history`
    - `articles_enriched_tags`
    - `tag_candidate_pool`
    - `articles_raw`

- 出力
    - 公開候補になりうる整形済記事

- P0 の実装範囲
    - extractor abstraction
    - summarizer
    - tag matcher
    - candidate updater
    - enriched writer
    - history writer

---
> ==========================================================================================

### 4.3 `hourly-publish`

> `layer2` と運用データを使って `layer4` を更新する公開反映ジョブ。

- 目的
    - `layer2` と `layer3` を使って、公開層 `layer4` を更新する

- 入力
    - `articles_enriched`
    - `articles_enriched_tags`
    - `source_priority_rules`
    - `activity_metrics_hourly`
    - `priority_processing_queue`

- 主処理
    - 公開候補を抽出する
    - 必要なら `priority_processing_queue` を先に処理する
    - 重複群ごとに代表ソースを決める
    - `public_articles` を更新する
    - `public_article_sources` を更新する
    - `public_article_tags` を更新する
    - `public_rankings` を更新する

- 更新先
    - `public_articles`
    - `public_article_sources`
    - `public_article_tags`
    - `public_rankings`

- 出力
    - サイトが参照する公開データ

- P0 の実装範囲
    - representative source selector
    - public projector 群
    - 暫定ランキング式

---
> ==========================================================================================

### 4.4 `daily-tag-promote`

> 未採用タグ候補を標準タグへ昇格させる日次ジョブ。

- 目的
    - 未採用タグ候補をタグマスタへ昇格させる

- 入力
    - `tag_candidate_pool`
    - Google Trends

- 主処理
    - `seen_count >= 5` の候補を取得する
    - 日本語基準の類似一致で Google Trends を照合する
    - 一致候補を `tags_master` に昇格する
    - 必要なら `tag_aliases` を追加する
    - 候補の `review_status` を更新する
    - 再タグ付け対象を publish 側へ渡せる状態にする

- 更新先
    - `tags_master`
    - `tag_aliases`
    - `tag_candidate_pool`

- 出力
    - 新たな標準タグ
    - 次回 publish / retag の対象

- P0 の実装範囲
    - 閾値は暫定で定数化
    - 人手レビュー UI 前提の状態管理を持つ

---
> ==========================================================================================

### 4.5 `weekly-archive`

> 生データの保持ポリシーを守るための整理ジョブ。

- 目的
    - `layer1` の保管期間を守り、古い raw を履歴へ移す

- 入力
    - `articles_raw`
    - 必要に応じて補助テーブル

- 主処理
    - 1 か月超の `articles_raw` を抽出する
    - `articles_raw_history` へコピーする
    - 元の `articles_raw` から削除する
    - 古い補助データを整理する

- 更新先
    - `articles_raw_history`
    - `articles_raw`

- 出力
    - 保持ポリシーに沿った raw データ構成

---
> ==========================================================================================

### 4.6 `priority-queue-worker`

> 定期バッチ待ちにしない即時反映ジョブ。

- 目的
    - 運営操作を定期バッチ待ちにせず反映する

- 入力
    - `priority_processing_queue`
    - 管理 API から投入された操作

- 主処理
    - `queued` 状態のキューを優先順で取得する
    - 対象ごとの反映処理を実行する
    - 成功時は `done` を更新する
    - 失敗時は `failed` と `last_error` を更新する

- 更新先
    - `priority_processing_queue`
    - `public_articles` 系
    - `admin_operation_logs`

- P0 の実装範囲
    - `hide_article` を最優先
    - `retag` / `republish` / `rebuild_rank` / `admin_override` は後続
    
---
> ==========================================================================================

## 5. 実行順序

### 5.1 日中の基本順

1. `hourly-fetch`
2. `daily-enrich`
3. `hourly-publish`

補足:

1. 実時間では `daily-enrich` は日次だが、依存関係としては `fetch` の後、`publish` の前に位置する
2. `priority-queue-worker` は独立して随時実行する

### 5.2 定期実行の優先順位

1. `hourly-fetch`
2. `hourly-publish`
3. `daily-enrich`
4. `daily-tag-promote`
5. `weekly-archive`

理由:

1. 新着取得を最優先にする
2. 公開更新を止めない
3. 整形は重いため日次へ寄せる
4. タグ昇格は公開系より後ろでよい
5. アーカイブは最下位でよい

### 5.3 実装順

1. `hourly-fetch`
2. `daily-enrich`
3. `hourly-publish`
4. `priority-queue-worker`
5. `daily-tag-promote`
6. `weekly-archive`

理由:

1. `layer1` と `layer2` を先に安定させる
2. 公開面を成立させるには `hourly-publish` が必要
3. 即時反映は P0 では `hide_article` に絞れば早めに入れられる
4. タグ昇格とアーカイブは後回しでも公開面は成立する

## 6. ジョブ間依存

1. `hourly-fetch` は `source_targets` が必要
2. `daily-enrich` は `articles_raw` が必要
3. `hourly-publish` は `articles_enriched` が必要
4. `daily-tag-promote` は `tag_candidate_pool` が必要
5. `priority-queue-worker` は管理 API と `priority_processing_queue` が必要
6. `weekly-archive` は `articles_raw` の保持ポリシーに依存する

## 7. P0 で未実装にするもの

1. 類似重複の本格統合
2. ソース別優先度のランキング反映
3. `hide_article` 以外の即時反映
4. 失敗リトライ専用ジョブ
5. Digest 配信ジョブ
6. Push 購読の掃除ジョブ
7. 監視集計専用ジョブ

## 8. 実装時の注意

1. 入口はローカル定期実行でも GitHub Actions でも呼べるようにする
2. ジョブ本体は HTTP 依存より関数実行を優先する
3. 実行ログと失敗理由を残す
4. 同一ジョブの再実行で破綻しないよう、冪等性を意識する
5. ドキュメントと実装がずれたら、このファイルを優先して更新する
