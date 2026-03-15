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
4. 命名形式:
   - `raw-00000001`
   - `enriched-00000001`
   - `job-00000001`

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
   - 取得元定義
2. `observed_article_domains`
   - 観測済みドメイン一覧とドメイン単位の取得方針
3. `source_priority_rules`
   - 同一引用元の代表ソース優先度
4. `push_subscriptions`
   - Push 購読
5. `digest_logs`
   - Digest 配信履歴

## 4. 主テーブル概要

### 4.1 `source_targets`

用途:

1. 毎時取得対象の定義
2. 取得方式、更新検知可否、取得間隔の保持

主な列:

1. `source_key`
2. `display_name`
3. `fetch_kind`
4. `source_category`
5. `content_access_policy`
6. `fetch_interval_minutes`
7. `supports_update_detection`

### 4.2 `articles_raw`

用途:

1. 生データ保管
2. 更新検知材料保管
3. 未処理 raw のキュー

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

用途:

1. 取得済み記事の行き先ドメイン一覧を持つ
2. ドメイン単位で本文取得可否をレビューする
3. 将来の `domain -> fetch/summarize template` 運用の起点にする

主なカラム:

1. `domain`
2. `fetch_policy`
   - `needs_review / fulltext_allowed / snippet_only / blocked`
3. `summary_policy`
   - `domain_default / summarize_full / summarize_snippet`
4. `observed_article_count`
5. `latest_article_url`
6. `first_seen_at`
7. `last_seen_at`
8. `notes`

### 4.4 `articles_raw_history`

用途:

1. 1 か月超の raw アーカイブ

補足:

1. `articles_raw` と同等カラムを持ち、`archived_at` を追加する

### 4.5 `tags_master`

用途:

1. 許可タグの標準マスタ

主な列:

1. `tag_key`
2. `display_name`
3. `trend_keyword`
4. `is_active`
5. `article_count`
6. `last_seen_at`

### 4.6 `tag_aliases`

用途:

1. 同義語や表記揺れを `tags_master` に束ねる

### 4.7 `tag_candidate_pool`

用途:

1. マスタ未登録タグ候補の蓄積
2. 日次の Google Trends 照合対象管理
3. 手動確認が必要な候補の保管

主な列:

1. `candidate_key`
2. `display_name`
3. `seen_count`
4. `review_status`
5. `manual_review_required`
6. `latest_trends_score`
7. `promoted_tag_id`

### 4.8 `articles_enriched`

用途:

1. AI 要約と確定重複判定済みデータの保持
2. 公開反映の元データ

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
   - `full_content / feed_snippet / blocked_snippet / fallback_snippet`
12. `content_path`
13. `is_provisional`
14. `provisional_reason`
   - `snippet_only / domain_snippet_only / fetch_error / extracted_below_threshold / feed_only_policy`
15. `dedupe_status`
16. `dedupe_group_key`
17. `publish_candidate`
18. `publication_basis`
   - `hold / full_summary / source_snippet`
19. `publication_text`
20. `summary_input_basis`
   - `full_content / source_snippet / title_only`
21. `score`
22. `score_reason`
23. `source_updated_at`
24. `processed_at`

### 4.9 `articles_enriched_history`

用途:

1. `articles_enriched` 更新時の旧版保管

### 4.10 `articles_enriched_tags`

用途:

1. 整形済記事と標準タグの紐付け

主な列:

1. `enriched_article_id`
2. `tag_id`
3. `tag_source`
4. `is_primary`

### 4.11 `activity_logs`

用途:

1. ウェブサイトの行動明細

### 4.12 `activity_metrics_hourly`

用途:

1. 毎時ランキング計算の集計ソース

### 4.13 `admin_operation_logs`

用途:

1. 運営操作の監査ログ

### 4.14 `priority_processing_queue`

用途:

1. 即時運営操作の反映
2. 再タグ付け、再公開、非表示化、順位再計算の優先処理

### 4.15 `public_articles`

用途:

1. サイトが読む公開記事本体

### 4.16 `public_article_sources`

用途:

1. 公開記事と関連ソースの紐付け

### 4.17 `public_article_tags`

用途:

1. 公開記事と表示タグの紐付け

### 4.18 `public_rankings`

用途:

1. 各時間窓の公開順位

## 5. 確定重複と類似重複

### 5.1 確定重複

1. `normalized_url` 一致
2. 同一引用元一致

この判定は `layer1 -> layer2` で行い、`dedupe_status` に保存する。

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
6. `activity_logs(public_article_id, occurred_at desc)`
7. `priority_processing_queue(status, priority asc, available_at asc)`
8. `public_rankings(ranking_window, rank_position, score desc)`

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
5. `thumbnail_url`
6. `primary_source_target_id`
7. `public_refreshed_at`

## 10. 実装時の注意

1. `layer3` は人手承認前提で作らない
2. タグ追加だけ、必要なら人手レビューを挟めるようにする
3. `layer4` はサイト表示専用の安定層として扱う
4. 公開面は `layer2` を直接参照しない
