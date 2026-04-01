# データモデル設計（Neon/PostgreSQL v4）

最終更新: 2026-04-02

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

数値主キーとは別に、主要な運用テーブルには文字列 ID を持たせる。

対象:
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
   - `articles_enriched_sources`
   - `articles_enriched_tags`
   - `articles_enriched_adjacent_tags`
   - `tags_master`
   - `tag_keywords`
   - `tag_aliases`
   - `tag_candidate_pool`
   - `adjacent_tags_master`
   - `adjacent_tag_keywords`
   - `topic_groups`
3. `layer3`
   - `activity_logs`
   - `activity_metrics_hourly`
   - `admin_operation_logs`
   - `priority_processing_queue`
   - `job_runs`
   - `job_run_items`
4. `layer4`
   - `public_articles`
   - `public_article_sources`
   - `public_article_tags`
   - `public_article_adjacent_tags`
   - `public_rankings`
   - `public_articles_history`

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
3. `fetch_kind`（rss / api / alerts / manual）
4. `source_category`（llm / agent / voice / policy / safety / search / news）
5. `source_type`（official / blog / news / video / alerts）
6. `content_access_policy`
7. `content_language`
8. `commercial_use_policy`
9. `fetch_interval_minutes`
10. `supports_update_detection`

#### `source_type` の値定義

| 値 | 意味 | 現在の該当ソース |
|---|---|---|
| `official` | 企業・組織の公式技術ブログ | Google AI, Anthropic, OpenAI, Microsoft, AWS, HuggingFace, NVIDIA, Meta |
| `blog` | 個人・コミュニティブログ | 将来追加予定 |
| `news` | ニュースメディア / まとめサイト | AI News Roundup（inactive） |
| `video` | 動画（YouTube 等） | 将来追加予定 |
| `alerts` | Google Alerts（discovery feed） | Google Alerts 系 |

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
4. `commercial_use_policy`
5. `observed_article_count`
6. `latest_article_url`
7. `first_seen_at`
8. `last_seen_at`
9. `notes`

### 4.4 `articles_raw_history`

`articles_raw` と同等カラムに `archived_at` を加える。

### 4.5 `tags_master`

主な列:

1. `tag_key`
2. `display_name`
3. `trend_keyword`
4. `is_active`
5. `article_count`
6. `last_seen_at`

### 4.6 `tag_keywords`

既存タグへ寄せる keyword を保持する。

### 4.7 `tag_aliases`

同義語や表記揺れを `tags_master` に束ねる。

### 4.8 `tag_candidate_pool`

主な列:

1. `candidate_key`
2. `display_name`
3. `seen_count`
4. `review_status`
5. `manual_review_required`
6. `latest_trends_score`
7. `promoted_tag_id`

### 4.9 `articles_enriched`

主な列:

1. `raw_article_id`
2. `source_target_id`
3. `source_category`
4. `source_type`
5. `content_language`
6. `commercial_use_policy`
7. `normalized_url`
8. `cited_url`
9. `canonical_url`
10. `title`
11. `thumbnail_url`
12. `thumbnail_bg_theme`
13. `summary_100`
14. `summary_200`
15. `summary_basis`
16. `summary_embedding`
17. `content_path`
18. `is_provisional`
19. `provisional_reason`
20. `dedupe_status`
21. `dedupe_group_key`
22. `publish_candidate`
23. `publication_basis`
24. `publication_text`
25. `summary_input_basis`
26. `score`
27. `score_reason`
28. `ai_processing_state`
29. `source_updated_at`
30. `topic_group_id`
31. `processed_at`

#### `source_category` の値定義

このプロジェクトの `source_category` はトピック分類であり、表示分類とは別軸。

| 値 | 対象ソース例 |
|---|---|
| `llm` | Google AI, Anthropic, OpenAI, HuggingFace, NVIDIA, Microsoft, Meta AI |
| `agent` | Google Alerts: AI Agents / Antigravity |
| `voice` | Google Alerts: Voice AI |
| `policy` | Google Alerts: AI Regulation |
| `safety` | Google Alerts: AI Safety |
| `search` | Google Alerts: RAG |
| `news` | 一般 AI ニュース系 |

表示分類は `source_type`、タグ、ソース固有 metadata を組み合わせた L4 派生概念として扱う。

#### `score` の計算方式

```text
base:        content_path=full → 70 / snippet → 45
加算:        matchedTagCount × 8
加算:        summarySource が manual_pending 以外 → +6
減算:        isRelevant=false → -25
上限:        100
```

#### `content_language` の扱い

1. SSOT は `source_targets.content_language`
2. enrich で `articles_enriched.content_language` にコピーする
3. publish で `public_articles.content_language` にコピーする
4. 公開面では言語バッジ表示や件数集計に使う

#### `commercial_use_policy` の扱い

1. `source_targets` と `observed_article_domains` の最厳値を `articles_enriched` に保存する
2. `prohibited` でも enrich データは保持する
3. publish では `prohibited` を公開しない

### 4.10 `topic_groups`

将来の Topic Group 実装用の受け口。

主な列:

1. `topic_group_id`
2. `label`
3. `created_at`

運用方針:

1. `articles_enriched.topic_group_id` / `public_articles.topic_group_id` は当面 `NULL`
2. embedding 生成・類似度判定・グループ化 batch が揃うまで公開 UI では使わない

### 4.11 `articles_enriched_history`

`articles_enriched` 更新時の旧版保管。`commercial_use_policy` も含めて保持する。

### 4.12 `articles_enriched_sources`

L2 の source provenance を保持する。`selected / supporting / rejected` を記録する。

### 4.13 `articles_enriched_tags`

1. `enriched_article_id`
2. `tag_id`
3. `tag_source`
4. `is_primary`

### 4.14 `articles_enriched_adjacent_tags`

1. `enriched_article_id`
2. `adjacent_tag_id`
3. `sort_order`

### 4.15 `adjacent_tags_master`

1. `tag_key`
2. `display_name`
3. `theme_key`
4. `priority`
5. `is_active`
6. `article_count`

### 4.16 `adjacent_tag_keywords`

1. `adjacent_tag_id`
2. `keyword`
3. `is_case_sensitive`

### 4.17 `activity_logs`

ウェブサイトの行動明細。

### 4.18 `activity_metrics_hourly`

毎時ランキング計算の集計ソース。

### 4.19 `admin_operation_logs`

運営操作の監査ログ。

### 4.20 `priority_processing_queue`

優先処理用の内部キュー。即時運営操作の拡張用途に予約する。

### 4.21 `public_articles`

サイトが読む公開記事本体。`hourly-publish` が `articles_enriched` から転送して upsert する。

主な列:

1. `enriched_article_id`
2. `primary_source_target_id`
3. `public_key`
4. `canonical_url`
5. `display_title`
6. `display_summary_100`
7. `display_summary_200`
8. `thumbnail_url`
9. `visibility_status`
10. `original_published_at`
11. `source_category`
12. `source_type`
13. `content_language`
14. `summary_input_basis`
15. `publication_basis`
16. `content_score`
17. `thumbnail_emoji`
18. `thumbnail_bg_theme`
19. `critique`
20. `topic_group_id`
21. `public_refreshed_at`

#### スコアの役割分担

| カラム | 用途 |
|---|---|
| `articles_enriched.score` | コンテンツ品質スコア |
| `public_articles.content_score` | L4 に転写した一覧・初期ランキング用スコア |
| `public_rankings.score` | アクティビティ込みの最終ランキングスコア |

#### thumbnail の方針

- `thumbnail_url` は内部テンプレートの `/api/thumb` を返す
- `thumbnail_bg_theme` は隣接分野タグから決定する
- 表示用は `source_type` / `source_category` / tags と背景テーマを使った内部テンプレート合成
- シェア用は `/api/og` で動的生成する
- アイコン未整備やテンプレ解決不可の記事では `thumbnail_emoji` をフォールバックに使う

#### L4 API で持つべき補助軸

1. topic filter: `source_category`
2. source lane: `source_type`
3. trend/entity filter: tags

この 3 軸を 1 つの `category` パラメータへ混ぜない。

#### `source_type=paper` のタグ方針

当面は `paper` タグだけを付ける。

理由:

1. 論文本文は一般語やモデル名の誤ヒットが多い
2. キーワード由来の企業・製品タグがノイズになりやすい
3. まずは「論文であること」を安定して表現する方を優先する

### 4.22 `public_article_sources`

公開記事と関連ソースの紐付け。`source_key` / `source_display_name` / `selection_status` の snapshot も保持する。

### 4.23 `public_article_tags`

公開記事と表示タグの紐付け。

### 4.24 `public_article_adjacent_tags`

公開記事と隣接分野タグの紐付け。

### 4.25 `public_rankings`

各時間窓の公開順位。

### 4.26 `public_articles_history`

`public_articles` の公開スナップショット履歴。

主な追加列:

1. `public_article_history_id`
2. `archive_reason`
3. `archived_at`

保持方針:

1. `public_articles` の主要列をほぼそのまま保持する
2. `content_language` / `topic_group_id` も保持する
3. 初期の `archive_reason` は `age_out`

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
10. `articles_enriched_adjacent_tags(enriched_article_id, sort_order)`
11. `public_article_adjacent_tags(public_article_id, sort_order)`

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
4. `public_articles`
   - 半年以内の公開集合を維持し、月次で `public_articles_history` に退避する
5. `arxiv-ai`
   - L4 では 2 か月保持上限の例外運用とする
6. `activity_logs`
   - 長期保持可
7. `digest_logs`
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
5. `commercial_use_policy='prohibited'` は publish 対象外とする
