# AI Trend Hub Data Flow

最終更新: 2026-04-02

## 1. 目的

cron、L1/L2/L4、ランキング、月次アーカイブ、タグ管理のデータフローを簡潔に整理する。Mermaid 図は `docs/imp/flowchart.md` を参照する。

## 2. レイヤー

1. L1: `articles_raw`
2. L2: `articles_enriched`, `articles_enriched_tags`, `articles_enriched_adjacent_tags`, `articles_enriched_sources`
3. L3: `activity_logs`, `activity_metrics_hourly`, `admin_operation_logs`, `job_runs`
4. L4: `public_articles`, `public_article_tags`, `public_article_adjacent_tags`, `public_article_sources`, `public_rankings`
5. History: `articles_raw_history`, `articles_enriched_history`, `public_articles_history`
6. Tag: `tags_master`, `tag_keywords`, `tag_aliases`, `tag_candidate_pool`, `adjacent_tags_master`, `adjacent_tag_keywords`

## 3. 稼働中ジョブ

- `hourly-fetch` 毎時 `:00`
- `hourly-enrich` 毎時 `:05 / :10 / :15 / :20 / :25 / :30 / :35 / :40`
- `hourly-publish` 毎時 `:50`
- `hourly-compute-ranks` は `hourly-publish` 後続
- `daily-tag-dedup` 毎日 `02:30 UTC`
- `daily-db-backup` 毎日 `18:15 UTC`
- `monthly-public-archive` 毎月 1 日 `03:00 UTC`

## 4. enrich worker の要点

1. `/api/cron/enrich-worker` route を worker として使う
2. 1 回 20 件、`summaryBatchSize=20`, `maxSummaryBatches=1`
3. claim は `FOR UPDATE SKIP LOCKED`
4. 予約ロックは `process_after = now() + 30 minutes`
5. AI 出力は `titleJa`, `summary100Ja`, `summary200Ja`, `properNounTags`
6. `arxiv-ai` は 5 か月超 raw を claim 前に除外する
7. `title + summary_200` から隣接分野タグを抽出し、`thumbnail_bg_theme` を決定する

## 5. publish / ranking

1. `hourly-publish` は L2 の publish candidate を `public_articles` へ upsert する
2. `public_article_tags` / `public_article_adjacent_tags` / `public_article_sources` を同期する
3. `hourly-compute-ranks` は `public_articles` を読み、複数 window を計算して upsert する

## 6. 月次アーカイブ

1. `public_articles` は半年以内の公開集合とする
2. 半年超は `public_articles_history` へ退避する
3. `public_article_tags` / `public_article_sources` / `public_rankings` は cascade delete で整理する
4. `arxiv-ai` だけは L4 で 2 か月保持上限とする

## 7. タグ管理フロー

1. enrich 時に `properNounTags` を `tag_candidate_pool` へ蓄積する
2. `daily-tag-dedup` が候補と既存タグを照合する
3. `/admin/tags` で未マッチ候補をレビューする
4. 昇格時は `tags_master` / `tag_keywords` / L2 / L4 へ反映する

## 8. 監視ポイント

1. `/admin/jobs`
2. GitHub Actions run
3. `articles_raw.process_after`, `is_processed`, `last_error`
4. `public_articles`, `public_articles_history`, `public_rankings`
