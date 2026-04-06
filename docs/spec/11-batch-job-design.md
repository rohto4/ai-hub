# バッチジョブ設計

最終更新: 2026-04-07

> **注意**: このファイルは 2026-03-15 の設計書です。現在の実装状態・運用手順は `docs/imp/batch-ops.md` が正です。
> 本ファイルは仕様の設計根拠として保持し、実装が変わったときに合わせて更新します。
>
> 主な現況:
> - ジョブ名は `daily-tag-dedup` が正
> - `hourly-compute-ranks` は独立した `lib/jobs` + CLI 入口あり
> - GitHub Actions schedule は 2026-04-02 に復旧済み
> - `monthly-public-archive` は workflow / route / job 実装済み
> - `priority-queue-worker` と `weekly-archive` は未実装の後続論点
> - `paper` は通常の主タグ照合 + `source_category` fallback で retag する
> - `voice` / `search` / `news` はカテゴリ専用キーとして扱う
> - Home random は `public_articles.content_score` ベースの weighted selection を使う
> - `tag_aliases` は表記揺れ正規化専用であり、親子タグ relation は `tag_relations` で L2 保存前に展開する
> - 親子タグの意味論は L2 で完結させ、新しい定時 batch は増やさない
> - relation 変更時の既存データ反映は `retag-layer2-layer4` を使い、`hourly-publish` は L2 の結果を転写するだけに留める
> - `/admin/enrich-queue` の publish 件数は「publish 可能件数」ではなく `public_refreshed_at` 基準の未反映件数へ修正済み
> - scheduled enrich は `hourly-enrich-non-paper` と `hourly-enrich-paper` に分離し、`queueType` 引数で同じ route を切り替える

## 1. 目的

この文書は、AI Trend Hub の定期実行ジョブと即時実行ジョブを、実装単位で固定するための仕様書です。  
`05-ingestion-and-ai-pipeline.md` が全体フロー、`10-ingestion-layer-design.md` が取得系のレイヤー責務を扱うのに対し、この文書は「どのジョブが、何を入力にして、何を更新し、どの順で動くか」を正とします。

## 2. バッチ設計の基本方針

1. P0 ではジョブを責務単位で分割する
2. 時間粒度と責務粒度は一致させない
3. enrich は `enrich-worker` / `enrich-worker-paper` として、運用上は `queueType` 切替で別ジョブ運用する
4. 要約 API 呼び出しは 1 記事ずつではなく、`summaryBatchSize=20` を基本とする
5. Gemini / OpenAI へ渡す要約指示は固定テンプレートファイルを使い、毎回同じルールを明示する
6. 毎時運用は `fetch -> enrich` を直列にし、enrich は小分けで回す
7. 即時反映は定期バッチに混ぜず、優先キュー経由で処理する
8. 記事単位失敗でスキップし、ジョブ全体は止めない
9. ローカル定期実行と GitHub Actions scheduled の両方から呼べる entrypoint にする
10. GitHub Actions からは各 cron route を直接叩く
11. alias 正規化と親子タグ展開は分けて扱い、タグ個別の UI 特例で意味論を補正しない

## 3. P0 で必要なジョブ一覧

1. `hourly-fetch`
2. `enrich-worker`
3. `hourly-publish`
4. `hourly-compute-ranks`
5. `daily-tag-dedup`
6. `monthly-public-archive`

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

### 4.2 `enrich-worker`

> `layer1` から `layer2` を生成する整形ジョブ。短い間隔で繰り返し起動し、P0 運用では毎時の小分け実行を前提にする。

- 目的
  - `layer1` の raw データを整形し、`layer2` を生成する

- 入力
  - `articles_raw`
  - `tags_master`
  - `tag_aliases`
  - `tag_keywords`
  - `adjacent_tag_keywords`

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
    - 両 provider が落ちた場合は `manual_pending` に回す
    - `manual_pending` 行は `hold` のまま保持し、手動 import 用 JSON を `artifacts/manual-pending/` へ出力する
  - `summaryInputBasis=full_content` のときだけ `canonicalTagHints` を受け、`tag_aliases` / `tag_keywords` への高信頼寄せに使う
    - ここで扱うのは表記揺れや検索語の canonical 寄せだけとする
  - `title + summary_200` から隣接分野タグを 1〜2 件抽出し、`thumbnail_bg_theme` を決定する
  - タグ候補を抽出する
  - `tags_master` / `tag_aliases` に照合する
    - 一致タグを `articles_enriched_tags` へ保存する
    - 未採用タグを `tag_candidate_pool` へ蓄積する
  - 一致した子 canonical tag は `tag_relations` によって親 canonical tag まで展開してから `articles_enriched_tags` に保存する
  - `paper` は通常の主タグ照合を行い、必要に応じて `source_category` fallback を加える
  - `voice` / `search` / `news` はカテゴリ専用キーとして扱い、主タグへは昇格させない
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
  - `articles_enriched_adjacent_tags`
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
> 親子タグの判断や補完は持たず、L2 で確定済みの tag join をそのまま転写する。

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
  - `commercial_use_policy='prohibited'` を除外する
  - `public_articles.public_refreshed_at` と `articles_enriched.updated_at` を比較し、未反映または再反映待ちだけを pending として扱う
  - 重複群ごとに代表ソースを決める
  - `public_articles` を更新する
  - `public_article_sources` を更新する
  - `public_article_tags` を更新する
  - `public_article_adjacent_tags` を更新する
  - Home random は publish 後の `public_articles.content_score` を使って weighted selection で露出する

### 4.4 `hourly-compute-ranks`

> `public_articles` と `activity_metrics_hourly` から `public_rankings` を更新するランキング計算ジョブ。

- 入力
  - `public_articles`
  - `activity_metrics_hourly`

- 主処理
  - 公開記事を読み込む
  - `hourly / 24h / 7d / 30d` の 4 window を計算する
  - `public_rankings` を upsert する
  - stale ranking を削除する

- 更新先
  - `public_rankings`
  - `job_runs`

### 4.5 `daily-tag-dedup`

> タグ候補と既存タグを照合し、alias / keyword 統合や保留整理を行う日次ジョブ。

- 目的
  - 候補タグを既存タグへ自動統合し、必要な保留だけを残す

- 入力
  - `tag_candidate_pool`
  - `tags_master`
  - `tag_aliases`
  - `tag_keywords`

- 主処理
  - 候補と既存タグを照合する
  - alias / keyword / 保留を判定する
  - 必要なら `tag_aliases` / `tag_keywords` を追加する
  - 候補の `review_status` を更新する
  - ここで追加する `tag_aliases` は canonical tag への表記揺れ正規化用途に限定する
  - `tag_relations` の追加や relation の見直しは別運用とし、このジョブの責務には含めない

### 4.6 `monthly-public-archive`

> 公開面の保持ポリシーを守るため、古い `public_articles` を履歴へ退避する月次ジョブ。

- 目的
  - `public_articles` の公開集合を半年以内に保つ

### 4.7 `priority-queue-worker`

> 定期バッチ待ちにしない即時反映ジョブ。

- 目的
  - 運営操作を定期バッチ待ちにせず反映する

## 5. 実行順序

### 5.1 毎時の基本順

1. `hourly-fetch`
2. `enrich-worker`（毎時運用、直列、小分け）
3. `hourly-publish`
4. `hourly-compute-ranks`

補足:

1. `enrich-worker` は毎時 `hourly-fetch` の後に小分けで直列実行する
2. `hourly-fetch` は `/api/cron/hourly-fetch`
3. `enrich-worker` は `/api/cron/enrich-worker`
4. `hourly-publish` は `/api/cron/hourly-publish`
5. `hourly-compute-ranks` は `/api/cron/hourly-compute-ranks`
6. `hourly-enrich.yml` は毎時 `:05 / :10 / :15 / :20 / :25 / :30 / :35 / :40` の 8 回実行する
7. `hourly-publish.yml` は毎時 `:50` に publish と ranks を直列実行する
8. `daily-tag-dedup.yml` は毎日 `02:30 UTC` に実行する
9. `monthly-public-archive.yml` は毎月 1 日 `03:00 UTC` に実行する

## 6. バックエンド確定断面（2026-04-05）

この時点で backend 側は、次の断面までを現行固定とみなす。

1. 定時ジョブの種類と schedule
2. `fetch -> enrich -> publish -> compute-ranks` の毎時直列運用
3. `daily-tag-dedup` による alias / keyword 自動寄せ
4. 親子タグ relation は L2 で展開し、`hourly-publish` は L2 結果を転写するだけに留める
5. relation 変更時の既存データ反映は、新 batch を増やさず `retag-layer2-layer4` を backfill 手段として使う
6. `paper` の主タグ fallback と `voice/search/news` のカテゴリ専用運用
7. `public_articles.content_score` を使った Home random の weighted selection
8. publish pending を `public_refreshed_at` 基準で見る管理画面定義

未確定として残すもの:

1. `tag_relations` の管理 UI / 運用フロー
2. `priority-queue-worker`
3. `weekly-archive`
4. CLI import 線と通常 enrich の副作用完全統合
