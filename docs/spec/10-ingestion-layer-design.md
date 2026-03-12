# 取得レイヤー設計（Layer 1 / Layer 2）

最終更新: 2026-03-12

## 1. 目的

この文書は、AI Trend Hub の取得系設計を `layer1` と `layer2` に絞って固定するためのものです。  
表示や運用の改善は後続で進める前提とし、まずは「取得できる」「整形できる」「公開候補を安定生成できる」状態を作ることを目的にします。

## 2. レイヤー定義

1. `layer1`
   - 取得した生データを保持する層
   - テーブルは `articles_raw`
   - URL 重複を許容する
2. `layer2`
   - 要約、タグ照合、確定重複判定まで済んだ層
   - テーブルは `articles_enriched`
   - 公開候補の元データになる
3. `layer3`
   - ウェブ稼働で自動蓄積される運用データ層
   - 人手承認層ではない
4. `layer4`
   - サイト表示専用の公開層

## 3. 重要な合意事項

1. 今最優先で実装するのは `layer1` と `layer2`
2. サイトは最終的に `layer4` だけを見る
3. `layer3` は行動ログ、運営ログ、優先処理などの自動運用データを持つ
4. タグマスタ追加のみ、人の判断が入る可能性を残す
5. 類似重複は後段に回し、まずは確定重複だけ処理する

## 4. Layer1: `articles_raw`

### 4.1 責務

1. 取得直後の原本保管
2. 更新検知の材料保管
3. 整形対象のキュー保管
4. 1 か月後のアーカイブ元

### 4.2 基本方針

1. URL 重複を許容する
2. 本文全文は保持しない
3. `source_target_id + normalized_url` と `source_updated_at` / `snippet_hash` を使って更新を判定する

### 4.3 保持項目

1. 取得元識別
   - `source_target_id`
   - `source_item_id`
2. URL 群
   - `source_url`
   - `cited_url`
   - `normalized_url`
3. コンテンツ概要
   - `title`
   - `snippet`
   - `snippet_hash`
4. ソースメタ
   - `source_published_at`
   - `source_updated_at`
   - `source_author`
   - `source_meta`
5. 制御列
   - `is_processed`
   - `has_source_update`
   - `process_after`
   - `last_error`

## 5. Layer2: `articles_enriched`

### 5.1 責務

1. AI 要約結果の保存
2. タグ標準化結果の保存
3. 確定重複判定の保存
4. 公開候補元データの保持
5. 更新時の版管理

### 5.2 保持項目

1. raw 参照
   - `raw_article_id`
   - `source_target_id`
2. URL / タイトル
   - `normalized_url`
   - `cited_url`
   - `canonical_url`
   - `title`
3. 表示素材
   - `thumbnail_url`
   - `summary_100`
   - `summary_200`
   - `summary_300`
4. 判定列
   - `content_path`
   - `dedupe_status`
   - `dedupe_group_key`
   - `publish_candidate`
   - `score`
   - `score_reason`
5. 制御列
   - `source_updated_at`
   - `processed_at`

### 5.3 付随テーブル

1. `articles_enriched_history`
2. `articles_enriched_tags`
3. `tags_master`
4. `tag_aliases`
5. `tag_candidate_pool`

## 6. 更新検知

### 6.1 判定条件

1. `source_target_id` が同一
2. `normalized_url` が同一
3. かつ `source_updated_at` が新しい、または `snippet_hash` が変化した

### 6.2 更新時の挙動

1. 新しい raw を追加する
2. 再整形対象にする
3. 旧 enriched は `articles_enriched_history` に残す
4. `layer4` 反映は次の毎時 publish で行う

## 7. 重複の扱い

### 7.1 確定重複

1. `normalized_url` 一致
2. 同一引用元一致

この判定は `layer1 -> layer2` で行う。

### 7.2 類似重複

1. AI や pgvector を使った類似判定は後段
2. `layer2` では `similar_candidate` として保持可能
3. 自動削除は行わない

## 8. タグライフサイクル

### 8.1 整形時

1. AI がタグ候補を出す
2. `tags_master` / `tag_aliases` に照合する
3. 一致したタグだけ `articles_enriched_tags` に保存する
4. 一致しない候補は `tag_candidate_pool` に蓄積する

### 8.2 日次昇格

1. `seen_count` が一定以上の候補を抽出する
2. Google Trends と照合する
3. 一致した候補を `tags_master` に追加する
4. 必要なら `tag_aliases` も追加する
5. 次の毎時バッチで再タグ付け対象に入れる

### 8.3 手動レビュー

1. タグマスタ追加だけは、必要なら手動確認可能にする
2. それ以外の流れは自動前提で設計する

## 9. バッチ責務

### 9.1 Hourly fetch

1. 外部取得
2. URL 正規化
3. `articles_raw` へ投入

### 9.2 Daily enrich

1. 未処理 raw 回収
2. `full` / `snippet` 判定
3. 要約生成
4. タグ照合
5. 確定重複判定
6. `articles_enriched` 保存

### 9.3 Hourly publish

1. `articles_enriched` から公開候補抽出
2. `source_priority_rules` で代表ソース選定
3. `public_articles` 系更新
4. `public_rankings` 更新

### 9.4 Weekly archive

1. `articles_raw` の 1 か月超を `articles_raw_history` へ移す

## 10. 失敗時ポリシー

1. 記事単位で失敗をスキップする
2. 以降の処理全体を落とさない
3. `last_error` や queue の `last_error` に記録する

## 11. 後続で決めること

1. タグ候補昇格の件数閾値
2. Google Trends 一致判定ルール
3. 類似重複の AI / pgvector 方針
4. `public_rankings` の計算式
