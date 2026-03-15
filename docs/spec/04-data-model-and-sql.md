# データモデル設計（Neon/PostgreSQL v4）

最終更新: 2026-03-15

## 1. 設計原則

1. データ取得から公開までを `layer1` から `layer4` に分ける
2. `layer1` と `layer2` を先に独立実装する
3. `layer3` は手動承認層ではなく、運用データ層として扱う
4. サイトは `layer4` だけを読む
5. 確定重複と類似重複を分けて扱う
6. 主キー列に汎用名 `id` は使わず、テーブル固有名へ統一する

## 1.1 主キー列命名

1. `source_targets.source_target_id`
2. `source_priority_rules.source_priority_rule_id`
3. `articles_raw.raw_article_id`
4. `articles_raw_history.raw_article_history_id`
5. `tags_master.tag_id`
6. `tag_aliases.tag_alias_id`
7. `tag_candidate_pool.tag_candidate_id`
8. `articles_enriched.enriched_article_id`
9. `articles_enriched_history.enriched_article_history_id`
10. `public_articles.public_article_id`
11. `public_article_sources.public_article_source_id`
12. `activity_logs.activity_log_id`
13. `admin_operation_logs.admin_operation_log_id`
14. `priority_processing_queue.priority_processing_queue_id`
15. `push_subscriptions.push_subscription_id`
16. `digest_logs.digest_log_id`
17. `job_runs.job_run_id`
18. `job_run_items.job_run_item_id`

## 1.2 安定文字列 ID

1. 数値主キーの可読性を補うため、主要な運用テーブルには文字列 ID を追加する
2. 文字列 ID は主キーとは別列で保持し、既存データを消さず後付けできる形にする
3. 現在の導入対象:
   - `articles_raw.raw_id`
   - `articles_raw_history.raw_history_id`
   - `articles_enriched.enriched_id`
   - `articles_enriched_history.enriched_history_id`
   - `job_runs.job_id`
   - `job_run_items.job_item_id`

## 2. レイヤーと主テーブル

1. `layer1`
   - `articles_raw`
   - `articles_raw_history`
2. `layer2`
   - `articles_enriched`
   - `articles_enriched_history`
   - `articles_enriched_tags`
   - `tags_master`
   - `tag_aliases`
   - `tag_candidate_pool`
3. `layer3`
   - `activity_logs`
   - `activity_metrics_hourly`
   - `admin_operation_logs`
   - `priority_processing_queue`
4. `layer4`
   - `public_articles`
   - `public_article_sources`
   - `public_article_tags`
   - `public_rankings`

## 3. 補助テーブル

1. `source_targets`
2. `observed_article_domains`
3. `source_priority_rules`
4. `push_subscriptions`
5. `digest_logs`

## 4. 主テーブル概要

### 4.1 `source_targets`

主な列:

1. `source_key`
2. `display_name`
3. `fetch_kind`
4. `source_category`
5. `content_access_policy`
6. `fetch_interval_minutes`
7. `supports_update_detection`

### 4.2 `articles_raw`

主な列:

1. `source_target_id`
2. `source_item_id`
3. `source_url`
4. `cited_url`
5. `normalized_url`
6. `title`
7. `snippet`
8. `snippet_hash`
9. `source_published_at`
10. `source_updated_at`
11. `source_meta`
12. `is_processed`
13. `has_source_update`
14. `process_after`
15. `last_error`

### 4.3 `observed_article_domains`

主な列:

1. `domain`
2. `fetch_policy`
3. `summary_policy`
4. `observed_article_count`
5. `latest_article_url`
6. `first_seen_at`
7. `last_seen_at`
8. `notes`

### 4.4 `articles_raw_history`

1. `articles_raw` と同等カラムを持ち、`archived_at` を追加する

### 4.5 `tags_master`

主な列:

1. `tag_key`
2. `display_name`
3. `trend_keyword`
4. `is_active`
5. `article_count`
6. `last_seen_at`

### 4.6 `tag_aliases`

1. 同義語や表記揺れを `tags_master` に束ねる

### 4.7 `tag_candidate_pool`

主な列:

1. `candidate_key`
2. `display_name`
3. `seen_count`
4. `review_status`
5. `manual_review_required`
6. `latest_trends_score`
7. `promoted_tag_id`

### 4.8 `articles_enriched`

主な列:

1. `raw_article_id`
2. `source_target_id`
3. `normalized_url`
4. `cited_url`
5. `canonical_url`
6. `title`
7. `thumbnail_url`
8. `summary_100`
9. `summary_200`
10. `summary_basis`
11. `content_path`
12. `is_provisional`
13. `provisional_reason`
14. `dedupe_status`
15. `dedupe_group_key`
16. `publish_candidate`
17. `publication_basis`
18. `publication_text`
19. `summary_input_basis`
20. `score`
21. `score_reason`
22. `source_updated_at`
23. `processed_at`

### 4.9 `articles_enriched_history`

1. `articles_enriched` 更新時の旧版保管

### 4.10 `articles_enriched_tags`

1. `enriched_article_id`
2. `tag_id`
3. `tag_source`
4. `is_primary`

### 4.11 `activity_logs`

1. ウェブサイトの行動明細

### 4.12 `activity_metrics_hourly`

1. 毎時ランキング計算の集計ソース

### 4.13 `admin_operation_logs`

1. 運営操作の監査ログ

### 4.14 `priority_processing_queue`

1. 即時運営操作の反映

### 4.15 `public_articles`

1. サイトが読む公開記事本体

### 4.16 `public_article_sources`

1. 公開記事と関連ソースの紐付け

### 4.17 `public_article_tags`

1. 公開記事と表示タグの紐付け

### 4.18 `public_rankings`

1. 各時間窓の公開順位

## 5. 確定重複と類似重複

### 5.1 確定重複

1. `normalized_url` 一致
2. 同一引用元一致

### 5.2 類似重複

1. 類似要約や類似本文の AI 判定は後段で使う
2. `layer2` では `similar_candidate` として保持するに留める
3. 自動削除しない

## 6. インデックス方針

1. `articles_raw(is_processed, process_after, created_at desc)`
2. `articles_raw(source_target_id, normalized_url, fetch_run_at desc)`
3. `tag_candidate_pool(review_status, seen_count desc, last_seen_at desc)`
4. `articles_enriched(publish_candidate, processed_at desc)`
5. `articles_enriched(dedupe_status, dedupe_group_key)`
6. `articles_enriched(is_provisional, provisional_reason, processed_at desc)`
7. `activity_logs(public_article_id, occurred_at desc)`
8. `priority_processing_queue(status, priority asc, available_at asc)`
9. `public_rankings(ranking_window, rank_position, score desc)`

## 7. RLS 方針

1. 公開読取:
   - `public_articles`
   - `public_article_sources`
   - `public_article_tags`
   - `public_rankings`
2. セッション単位読書き:
   - `push_subscriptions`
3. それ以外:
   - 内部処理専用

## 8. 保持ポリシー

1. `articles_raw`
   - 1 か月保持後 `articles_raw_history` へ移動
2. `articles_enriched`
   - 1 年保持を初期方針とする
3. `articles_enriched_history`
   - 版追跡のため保持
4. `activity_logs`
   - 長期保持可
5. `digest_logs`
   - 再送制御と監査のため保持

## 9. layer3 / layer4 に受け渡す最低項目

1. `display_title`
2. `display_summary_100`
3. `display_summary_200`
4. `thumbnail_url`
5. `primary_source_target_id`
6. `public_refreshed_at`

## 10. 実装時の注意

1. `layer3` は人手承認前提で作らない
2. タグ追加だけ、必要なら人手レビューを挟めるようにする
3. `layer4` はサイト表示専用の安定層として扱う
4. 公開面は `layer2` を直接参照しない
