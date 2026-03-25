# データモデル要約

最終更新: 2026-03-25

このファイルは `docs/spec/04-data-model-and-sql.md` の初回読込向け要約版。  
詳細なスキーマ、列定義、履歴追加分は元ファイルを参照する。

## 1. 役割

- 初回読込時に、DB の全体構造と実装上の禁止事項だけを短く把握するための要約
- 列追加や migration 実装、SQL 詳細確認が必要なときだけ `04-data-model-and-sql.md` 本文へ進む

## 2. 基本原則

1. データ取得から公開までを `layer1` から `layer4` に分ける
2. 公開面は `layer4` だけを読む
3. `layer3` は手動承認層ではなく運用データ層
4. 確定重複と類似重複は分けて扱う
5. 主キー列に汎用名 `id` は使わない

## 3. レイヤー構成

### L1

- `articles_raw`
- `articles_raw_history`

役割:

- 取得した生記事を保持する

### L2

- `articles_enriched`
- `articles_enriched_history`
- `articles_enriched_tags`
- `articles_enriched_sources`

役割:

- 要約、整形、タグ付け、重複判定の中間層

### L3

- `activity_logs`
- `activity_metrics_hourly`
- `admin_operation_logs`
- `priority_processing_queue`
- `job_runs`
- `job_run_items`

役割:

- 行動ログ、運用ログ、ジョブ監視

### L4

- `public_articles`
- `public_article_tags`
- `public_article_sources`
- `public_rankings`

役割:

- 公開サイトが直接読む安定層

### History

- `articles_raw_history`
- `articles_enriched_history`
- `public_articles_history`

役割:

- アーカイブと履歴保持

### Tag

- `tags_master`
- `tag_keywords`
- `tag_aliases`
- `tag_candidate_pool`

役割:

- タグ運用全般

## 4. 実装で特に重要な列

### `source_targets`

- `source_key`
- `source_category`
- `source_type`
- `content_access_policy`
- `content_language`
- `commercial_use_policy`
- `is_active`

意味:

- source の SSOT

### `articles_enriched`

- `source_category`
- `source_type`
- `content_language`
- `thumbnail_url`
- `summary_100`
- `summary_200`
- `publish_candidate`
- `publication_basis`
- `summary_input_basis`
- `score`
- `commercial_use_policy`
- `topic_group_id`

意味:

- enrich 済みの中間記事本体

### `public_articles`

- `public_key`
- `display_title`
- `display_summary_100`
- `display_summary_200`
- `thumbnail_url`
- `thumbnail_emoji`
- `visibility_status`
- `source_category`
- `source_type`
- `content_language`
- `content_score`
- `critique`
- `topic_group_id`

意味:

- 公開面の主テーブル

## 5. 現在の固定方針

### 5.1 公開面の3軸

1. topic filter: `source_category`
2. source lane: `source_type`
3. trend/entity filter: tags

この 3 軸を 1 つの `category` パラメータに押し込まない。

### 5.2 `content_language`

1. SSOT は `source_targets.content_language`
2. enrich で `articles_enriched.content_language` にコピー
3. publish で `public_articles.content_language` にコピー
4. 公開面では JP/EN 表示や集計に使う

### 5.3 `thumbnail_url`

1. 外部記事画像ではなく内部テンプレート `/api/thumb` を使う
2. 解決できない場合は `thumbnail_emoji` fallback
3. 元記事の `og:image` は前提にしない

### 5.4 `commercial_use_policy`

1. `source_targets` と `observed_article_domains` を元に判定する
2. enrich は止めず記録する
3. publish 時に `prohibited` を除外する

### 5.5 Topic Group

1. `topic_group_id` と `topic_groups` テーブルは受け口だけある
2. 値は基本 `NULL`
3. 本実装は pgvector ベースの後続フェーズ

## 6. 重要な運用ルール

1. 公開面は `layer2` を直接読まない
2. `source_type='paper'` は当面 `paper` タグだけ付与する
3. `public_articles` は半年以内の公開集合
4. ただし `arxiv-ai` だけは 2 か月保持上限とし、それ以外は半年超で `public_articles_history` に退避する
5. `public_article_tags` / `public_article_sources` / `public_rankings` は age-out 時に cascade delete
6. `enrich-worker` の前処理では `arxiv-ai` の 5 か月超 raw を skip して Gemini API の無駄打ちを防ぐ

## 7. 変更時の注意

1. 破壊的変更は Human-in-the-Loop 対象
2. DB 詳細変更前には `docs/spec/04-data-model-and-sql.md` 本文を必ず確認する
3. 新しい恒久仕様を入れるときは summary と本文の両方を更新する
