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
3. `fetch_kind`（rss / api / alerts / manual ― 取得方法）
4. `source_category`（llm / agent / voice / policy / safety / search / news ― トピック分類）
5. `source_type`（official / blog / news / video / alerts ― ソース種別。Web カード表示分岐に使う）
6. `content_access_policy`
7. `fetch_interval_minutes`
8. `supports_update_detection`

#### `source_type` の値定義

| 値 | 意味 | 現在の該当ソース |
|---|---|---|
| `official` | 企業・組織の公式技術ブログ | Google AI, Anthropic, OpenAI, Microsoft, AWS, HuggingFace, NVIDIA, Meta |
| `blog` | 個人・コミュニティブログ | （将来追加予定） |
| `news` | ニュースメディア / まとめサイト | AI News Roundup（inactive） |
| `video` | 動画（YouTube 等） | （将来追加予定） |
| `alerts` | Google Alerts（discovery feed） | 全 Google Alerts ソース |

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
3. `source_category` ← migration 024 追加。`source_targets.source_category` を enrich 時にコピー（llm / agent / voice / policy / safety / search / news）
4. `source_type` ← migration 026 追加。`source_targets.source_type` を enrich 時にコピー（official / blog / news / video / alerts）
5. `content_language` ← migration 035 追加。`source_targets.content_language` を enrich 時にコピー（初期値は `ja` / `en`）
6. `normalized_url`
7. `cited_url`
8. `canonical_url`
9. `title`
10. `thumbnail_url`（現状は常に NULL。OGP は `/api/og` エンドポイントで動的生成）
11. `summary_100`
12. `summary_200`
13. `summary_basis`
14. `content_path`
15. `is_provisional`
16. `provisional_reason`
17. `dedupe_status`
18. `dedupe_group_key`
19. `publish_candidate`
20. `publication_basis`
21. `publication_text`
22. `summary_input_basis`
23. `score`（0〜100 整数。コンテンツ品質スコア。ランキング initial value に使う）
24. `score_reason`
25. `ai_processing_state`
26. `source_updated_at`
27. `topic_group_id` ← migration 035 追加。将来の Topic Group 用受け口。初期は `NULL`
28. `processed_at`

#### `source_category` の値定義（このプロジェクト固有）

このプロジェクトの `source_category` は **トピック分類**であり、dim2_memo の display-layout 分類（news/paper/community 等）とは別軸。

| 値 | 対象ソース例 |
|---|---|
| `llm` | Google AI, Anthropic, OpenAI, HuggingFace, NVIDIA, Microsoft, Meta AI |
| `agent` | Google Alerts: AI Agents / Antigravity |
| `voice` | Google Alerts: Voice AI |
| `policy` | Google Alerts: AI Regulation |
| `safety` | Google Alerts: AI Safety |
| `search` | Google Alerts: RAG |
| `news` | 一般 AI ニュース系 |

表示レイアウト（カード型 / リスト型）の分岐は `content_access_policy` + `summary_input_basis` から導出する。

#### 表示分類との関係

Web の表示分類（例: `news / community / paper / overseas / oss`）を扱いたい場合でも、  
`source_category` をその用途へ上書きしてはならない。

理由:

1. `source_category` は topic filter の基盤
2. 表示分類は `source_type`、タグ、ソース固有 metadata を組み合わせた **L4 派生概念**だから

必要なら `public_articles` の API 層または view 層で `display_category` 相当を派生させる。

#### `score` の計算方式

```
base:        content_path=full → 70 / snippet → 45
加算:        matchedTagCount × 8
加算:        summarySource が manual_pending 以外 → +6
減算:        isRelevant=false → -25
上限:        100
```

#### `content_language` の扱い

1. SSOT は `source_targets.content_language`
2. migration 035 で既存ソースを `ja` / `en` に backfill 済み
3. enrich で `articles_enriched.content_language` へコピーする
4. publish で `public_articles.content_language` へコピーする
5. 公開面では言語バッジ表示や件数集計に使うが、現時点で言語フィルタ UI は未実装

### 4.8.1 `topic_groups`

migration 035 で先行追加した将来用テーブル。現時点では Topic Group 本実装前の受け口に留める。

主な列:

1. `topic_group_id`
2. `label`
3. `created_at`

運用方針:

1. `articles_enriched.topic_group_id` / `public_articles.topic_group_id` は初期は `NULL`
2. embedding 生成・類似度判定・グループ化バッチを入れるまでは公開 UI で使わない
3. Topic Group 本実装は pgvector ベースの別フェーズで行う

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

サイトが読む公開記事本体。`hourly-publish` ジョブが `articles_enriched` から転送して upsert する。

主な列（migration 025 / 027 / 031 / 035 追加分を含む）:

1. `enriched_article_id` ← `articles_enriched` への FK
2. `primary_source_target_id`
3. `public_key`（スラッグ等の公開 ID）
4. `canonical_url`
5. `display_title`
6. `display_summary_100`
7. `display_summary_200`
8. `thumbnail_url`（OGP 画像。NULL 許容。シェア時は `/api/og` で動的生成）
9. `visibility_status`（published / hidden / suppressed）
10. `original_published_at`
11. `source_category` ← migration 025 追加。トピック分類（llm / agent 等）
12. `source_type` ← migration 026 追加。ソース種別（official / blog / news / video / alerts）
13. `content_language` ← migration 035 追加。`articles_enriched.content_language` を publish 時にコピー（`ja` / `en`）
14. `summary_input_basis` ← migration 025 追加。Web 表示ラベル分岐に使う
15. `publication_basis` ← migration 025 追加。full_summary / source_snippet
16. `content_score` ← migration 025 追加。`articles_enriched.score` を転写（0〜100）
17. `thumbnail_emoji` ← migration 031 追加。`thumbnail_url` が空の間の暫定カード表示用
18. `critique` ← migration 027 追加。批評テキスト（将来実装。初期は NULL）
19. `topic_group_id` ← migration 035 追加。将来の Topic Group 用受け口。初期は `NULL`
20. `public_refreshed_at`

#### スコアの役割分担

| カラム | 用途 |
|---|---|
| `articles_enriched.score` | コンテンツ品質スコア（0〜100）。enrich 時に計算 |
| `public_articles.content_score` | 同上を Layer 4 に転写。初期ランキング・一覧ソートに使う |
| `public_rankings.score` | アクティビティ込みの最終ランキングスコア（将来実装） |

#### thumbnail の方針

- `thumbnail_url` は内部テンプレートの `/api/thumb` を返す運用へ移行済み
- **表示用**: source_type / source_category / tags を使った内部テンプレート合成
- **シェア用（OGP）**: `/api/og?id=xxx` エンドポイントで動的生成
- 元記事の `<meta og:image>` は必須ではない
- アイコン未整備やテンプレ解決不可の記事では `thumbnail_emoji` をフォールバックに使う

#### L4 API で持つべき補助軸

公開面は少なくとも次の 3 軸を分けて扱う。

1. topic filter: `source_category`
2. source lane: `source_type`
3. trend/entity filter: tags（`public_article_tags`）

この 3 軸を混ぜて 1 個の `category` パラメータへ押し込まない。

#### source_type=paper のタグ方針

`source_type='paper'` の記事は、当面 `paper` タグだけを付ける。

理由:

1. 論文本文は一般語やモデル名の誤ヒットが多い
2. キーワード由来の企業・製品タグがノイズになりやすい
3. まずは「論文であること」だけを安定して表現する方を優先する

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

## 11. 2026-03-19 additions

1. `articles_enriched.summary_embedding`
   - `vector(1536)`
   - generated from `title + summary`
   - used for initial semantic duplicate detection
2. `articles_enriched_sources`
   - keeps `selected / supporting / rejected` source provenance for L2
3. `public_article_sources.source_key / source_display_name / selection_status`
   - keeps L4 source-name snapshots even when source master labels change later

## 12. 2026-03-20 additions

### 12.1 commercial_use_policy（migration 034）

ToS 調査結果を永続化し、商用利用可否をレイヤーをまたいで管理する仕組みを追加。

1. `source_targets.commercial_use_policy`
   - `'permitted' | 'prohibited' | 'unknown'`、DEFAULT `'permitted'`
   - ソース単位の商用利用可否。新規ソース追加時に必ず設定する

2. `observed_article_domains.commercial_use_policy`
   - `'permitted' | 'prohibited' | 'unknown'`、DEFAULT `'unknown'`
   - ドメイン単位の商用利用可否。ToS 調査結果を蓄積する台帳
   - 2026-03-20 初期投入: prohibited 6件（itmedia/techcrunch/nikkei系/qiita）、permitted 6件

3. `articles_enriched.commercial_use_policy`
   - `'permitted' | 'prohibited' | 'unknown'`、DEFAULT `'permitted'`
   - enrich 時に `source_targets` + `observed_article_domains` の最厳値を保存
   - **prohibited でも enrich データは保持する**（非商用利用への流用を残すため）

4. `articles_enriched_history.commercial_use_policy`
   - 上記と同じ型・用途。履歴テーブルへの伝播分

#### フィルタリングポイント

- enrich: 常に実行（フィルタなし）。`commercial_use_policy` を記録するのみ
- publish（`hourly-publish`）: `COALESCE(ae.commercial_use_policy, 'permitted') != 'prohibited'` の記事のみ公開

#### 恒久ルール

- 広告掲載・課金・収益化を行う場合は「商用利用」に該当する（費用回収目的も含む）
- 新規ソース追加・収益化機能追加時は必ず ToS 再確認し `observed_article_domains` を更新する
- 詳細は `docs/guide/PROJECT.md` の「商用利用と ToS の恒久ルール」セクションを参照

### 12.2 `public_articles` の公開件数

- `hourly-publish` の bulk upsert 化（unnest ベース）により L4 に 2371 件が公開済み（2026-03-20）
- `hourly-publish` は 200 件チャンクで処理し、失敗時は 10 件→1 件のフォールバック構成
## 13. 2026-03-21 additions

### 13.1 `public_articles_history`

1. migration 036 で追加された、`public_articles` の公開スナップショット履歴テーブル
2. `public_articles` の主要列をほぼそのまま保持する
3. 主な追加カラム:
   - `public_article_history_id`
   - `archive_reason`
   - `archived_at`
4. migration 036 時点で `content_language` / `topic_group_id` も履歴側へ保持する
5. 初期の archive reason は `age_out`
6. `public_articles` から月次 age-out された行を退避する

### 13.2 monthly public archive

1. 毎月 1 回、`COALESCE(public_articles.original_published_at, public_articles.created_at) < now() - interval '6 months'` の行を archive 対象とする
2. 対象行を `public_articles_history` に INSERT してから `public_articles` から DELETE する
3. `public_article_sources` / `public_article_tags` / `public_rankings` は `public_articles` 削除時の cascade で整理する
4. 目的:
   - 公開集合を半年以内へ保つ
   - `compute-ranks` と公開 query の母集団を自然に減らす
   - 半年超の記事は履歴としてのみ保持する
5. `monthly-public-archive` ジョブは `job_runs` にも記録し、`/admin/jobs` で監査できる
