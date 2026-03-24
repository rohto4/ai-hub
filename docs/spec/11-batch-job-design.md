# バッチジョブ設計

最終更新: 2026-03-15

## 1. 目的

この文書は、AI Trend Hub の定期実行ジョブと即時実行ジョブを、実装単位で固定するための仕様書です。  
`05-ingestion-and-ai-pipeline.md` が全体フロー、`10-ingestion-layer-design.md` が取得系のレイヤー責務を扱うのに対し、この文書は「どのジョブが、何を入力にして、何を更新し、どの順で動くか」を正とします。

## 2. バッチ設計の基本方針

1. P0 ではジョブを責務単位で分割する
2. 時間粒度と責務粒度は一致させない
3. enrich は現行実装名が `daily-enrich` でも、運用上は毎時実行前提で扱う
4. 要約 API 呼び出しは 1 記事ずつではなく、`summaryBatchSize=20` を基本とする
5. Gemini / OpenAI へ渡す要約指示は固定テンプレートファイルを使い、毎回同じルールを明示する
4. 毎時運用は `fetch -> enrich` を直列にし、enrich は小分けで回す
5. 即時反映は定期バッチに混ぜず、優先キュー経由で処理する
6. 記事単位失敗でスキップし、ジョブ全体は止めない
7. ローカル定期実行と GitHub Actions scheduled の両方から呼べる entrypoint にする
8. GitHub Actions の定期実行入口は `/api/cron/hourly-layer12` とし、`APP_URL` / `CRON_SECRET` を使う

## 3. P0 で必要なジョブ一覧

1. `hourly-fetch`
2. `daily-enrich`（運用上は毎時 enrich）
3. `hourly-publish`
4. `daily-tag-promote`
5. `weekly-archive`
6. `priority-queue-worker`

## 4. ジョブ別仕様

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
  - Google Alerts URL を実記事 URL に unwrap する
  - URL 正規化を行う
  - `source_target_id + normalized_url + source_updated_at / snippet_hash` で更新検知する
  - `articles_raw` を追加する
  - 更新対象には `has_source_update = true` を立てる
  - source 単位失敗はジョブ監視へ残す

- 更新先
  - `articles_raw`
  - `job_runs`
  - `job_run_items`

- 出力
  - 未処理または再処理対象の raw レコード

### 4.2 `daily-enrich`（運用上は毎時 enrich）

> `layer1` から `layer2` を生成する整形ジョブ。現行実装名は `daily-enrich` だが、P0 運用では毎時実行を前提にする。

- 目的
  - `layer1` の raw データを整形し、`layer2` を生成する

- 入力
  - `articles_raw`
  - `tags_master`
  - `tag_aliases`

- 主処理
  - 未処理または再整形対象の raw を小分けで取得する
  - 定時実行の基本設定は `limit=20`, `summaryBatchSize=20`, `maxSummaryBatches=1` とする
  - まず `source_targets.content_access_policy` を見る
  - `fulltext_allowed` source に限って本文取得を試みる
  - `feed_only` source は snippet ベースで継続する
  - `full` / `snippet` を判定する
  - 本文未取得時は `snippet` ベースで仮蓄積する
  - `is_provisional` / `provisional_reason` を更新する
  - `publication_basis` / `publication_text` を更新する
  - `summary_input_basis` を更新する
  - blocked domain は `domain_snippet_only` として区別する
  - 要約を生成する
    - `summary_100`
    - `summary_200`
    - provider 順は `Gemini(primary) -> Gemini(secondary) -> OpenAI gpt-5-mini`
    - 両 provider が落ちた場合は `template fallback` へは落とさず `manual_pending` に回す
    - `manual_pending` 行は `hold` のまま保持し、手動 import 用 JSON を `artifacts/manual-pending/` へ出力する
  - タグ候補を抽出する
  - `tags_master` / `tag_aliases` に照合する
    - 一致タグを `articles_enriched_tags` へ保存する
    - 未採用タグを `tag_candidate_pool` へ蓄積する
  - URL 一致と headline signature で重複を判定する
  - `articles_enriched` を upsert する
  - 更新時は旧版を `articles_enriched_history` に退避する
  - `articles_raw.is_processed = true` を更新する
  - `hold` 行だけ `publish_candidate=false` に固定する
  - 抽出段階や失敗理由をジョブ監視へ残す

- 更新先
  - `articles_enriched`
  - `articles_enriched_history`
  - `articles_enriched_tags`
  - `tag_candidate_pool`
  - `articles_raw`
  - `job_runs`
  - `job_run_items`

- 出力
  - 仮蓄積を含む整形済記事

- P0 の実装範囲
  - extractor abstraction
  - summarizer
  - tag matcher
  - candidate updater
  - enriched writer
  - history writer
  - 小分け実行前提の batch 制御

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

### 4.4 `daily-tag-promote`

> 未採用タグ候補を標準タグへ昇格させる日次ジョブ。

- 目的
  - 未採用タグ候補をタグマスタへ昇格させる

- 入力
  - `tag_candidate_pool`
  - Google Trends

- 主処理
  - 高閾値で候補を取得する
  - 日本語基準の類似一致で Google Trends を照合する
  - 一致候補を `tags_master` に昇格する
  - 必要なら `tag_aliases` を追加する
  - 候補の `review_status` を更新する

### 4.5 `weekly-archive`

> 生データの保持ポリシーを守るための整理ジョブ。

- 目的
  - `layer1` の保管期間を守り、古い raw を履歴へ移す

### 4.6 `priority-queue-worker`

> 定期バッチ待ちにしない即時反映ジョブ。

- 目的
  - 運営操作を定期バッチ待ちにせず反映する

## 5. 実行順序

### 5.1 毎時の基本順

1. `hourly-fetch`
2. `daily-enrich`（毎時運用、直列、小分け）
3. `hourly-publish`

補足:

1. 現行実装名は `daily-enrich` だが、運用上は毎時 `hourly-fetch` の後に小分けで直列実行する
2. 実装入口は `/api/cron/hourly-layer12` とし、内部で `fetch -> enrich` を直列に回す
3. GitHub Actions では `hourly-layer12.yml` から `APP_URL/api/cron/hourly-layer12` を叩く
4. `hourly-enrich.yml` は毎時 `:05 / :10 / :15 / :20 / :25 / :30 / :35 / :40` の 8 回実行する
