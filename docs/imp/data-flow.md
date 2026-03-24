# AI Trend Hub Data Flow

最終更新: 2026-03-25

## 1. 目的

cron、L1/L2/L4、ランキング、月次アーカイブ、タグ管理のデータフローを文字情報で整理する。Mermaid 図は `docs/imp/flowchart.md` に分離した。

## 2. レイヤー

1. L1: `articles_raw`
2. L2: `articles_enriched`, `articles_enriched_tags`, `articles_enriched_sources`
3. L3: `activity_logs`, `activity_metrics_hourly`, `admin_operation_logs`, `job_runs`
4. L4: `public_articles`, `public_article_tags`, `public_article_sources`, `public_rankings`
5. History: `articles_raw_history`, `articles_enriched_history`, `public_articles_history`
6. Tag: `tags_master`, `tag_keywords`, `tag_aliases`, `tag_candidate_pool`

## 3. 稼働中ジョブ

- `hourly-fetch` 毎時 `:00`
- `hourly-enrich` 毎時 `:05 / :10 / :15 / :20 / :25 / :30 / :35 / :40`
- `hourly-publish` 毎時 `:50`
- `compute-ranks` は `hourly-publish` 後続
- `daily-tag-dedup` 毎日 `02:30 UTC`
- `daily-db-backup` 毎日 `18:15 UTC`
- `monthly-public-archive` 月次

## 4. enrich worker の要点

1. `daily-enrich` route を worker として使う
2. 1 回 20 件、`summaryBatchSize = 20`、`maxSummaryBatches = 1`
3. claim は `FOR UPDATE SKIP LOCKED`
4. 予約ロックは `process_after = now() + 30 minutes`
5. AI 出力は `titleJa`, `summary100Ja`, `summary200Ja`, `properNounTags`
6. `arxiv-ai` は例外として、5 か月超 raw を claim 前に処理対象から外す

## 5. publish / ranking の要点

1. `hourly-publish` は L2 の publish candidate を `public_articles` へ upsert
2. `public_article_tags` と `public_article_sources` を同期
3. `compute-ranks` は `public_articles` を 1 回読み込み、4 window を並列計算して upsert

## 6. 月次アーカイブ

1. `public_articles` は半年以内の公開集合
2. 半年超は `public_articles_history` へ退避
3. `public_article_tags` / `public_article_sources` / `public_rankings` は cascade delete
4. ただし `arxiv-ai` は例外として、L4 で 2 か月保持上限にする

## 7. タグ管理フロー

1. enrich 時に `properNounTags` を `tag_candidate_pool` へ蓄積
2. `daily-tag-dedup` が候補と既存タグを照合し、自動統合または保留に分ける
3. `/admin/tags` で未マッチ候補をレビューする
4. 昇格時は `tags_master` / `tag_keywords` / L2 / L4 へ反映する

## 8. 監視ポイント

1. `/admin/jobs`
2. GitHub Actions run
3. `articles_raw.process_after`, `is_processed`, `last_error`
4. `public_articles`, `public_articles_history`, `public_rankings`

## 9. 関連図

- cron / job フロー: `docs/imp/flowchart.md`
