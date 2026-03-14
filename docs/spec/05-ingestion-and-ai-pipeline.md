# 収集・要約・公開パイプライン仕様（v4）

最終更新: 2026-03-12

## 1. フロー全体

1. 外部ソース取得
2. URL 正規化
3. `layer1` 保存
4. 本文抽出
5. AI 要約生成
6. タグ候補抽出とタグ照合
7. 確定重複判定
8. `layer2` 保存
9. `layer3` / `layer4` 反映

## 2. 収集元戦略

初期導入:

1. Google Alerts RSS
2. 公式技術ブログ RSS
3. AI ニュース系 RSS
4. 公開 API で取得できるソース

運用ルール:

1. 取得元は `source_targets` に定義する
2. `fetch_kind` は `rss` / `api` / `alerts` / `manual` で管理する
3. 取得間隔は source 単位で持つ
4. 更新検知可否も source 単位で持つ

## 3. URL 正規化

1. `utm_*`, `fbclid`, `gclid` を除去する
2. 末尾 `/` を統一する
3. `https` を優先する
4. 短縮 URL は可能なら最終到達先へ展開する

## 4. `layer1 -> layer2` の重複判定

### 4.1 確定重複

次を確定重複として扱う。

1. `normalized_url` 一致
2. 同一引用元一致

この段階では削除せず、`dedupe_status` に保存する。

### 4.2 類似重複

1. 類似文章の AI 判定は後段で使う
2. `layer2` では `similar_candidate` として保持してよい
3. 公開時に代表ソース選定の補助に使う

## 5. 要約生成

保存対象:

1. `summary_100`
2. `summary_200`
3. `summary_300`

要件:

1. 何が起きたかが分かる
2. なぜ重要かが分かる
3. 誰に関係するかが分かる

## 6. タグ付与

### 6.1 整形時

1. AI がタグ候補を出す
2. `tags_master` と `tag_aliases` に照合する
3. 一致したものだけを標準タグとして付ける
4. 一致しなかったものは `tag_candidate_pool` に蓄積する

### 6.2 日次昇格

1. `tag_candidate_pool` の件数を集計する
2. P0 は高閾値（`seen_count >= 8` 目安）を超えた候補だけ Google Trends と照合する
3. Trends と一致した候補は `tags_master` に追加する
4. 追加済みタグを持つ既存記事は、次の毎時バッチで再タグ付けする

### 6.3 手動レビュー

1. 基本は自動運用で進める
2. ただしタグマスタ追加だけは、必要なら人のレビューを挟めるようにする

## 7. 更新検知

更新とみなす条件:

1. `source_target_id` が同じ
2. `normalized_url` が同じ
3. かつ `source_updated_at` が新しい、または `snippet_hash` が変わった

更新時の扱い:

1. raw は新規レコードとして追加する
2. `has_source_update = true` を立てる
3. 整形時に再要約対象へ入れる

## 8. コスト最適化

1. 同一 `source_target_id + normalized_url + snippet_hash` では結果再利用を優先する
2. 更新検知がないものは再要約しない
3. 失敗リトライは指数バックオフで行う
4. 記事単位の失敗はスキップし、全体ジョブは落とさない

## 9. バッチ責務

詳細なジョブ分割、入力、更新先、実装順は `11-batch-job-design.md` を正とする。

### 9.1 毎時: 取得

1. `source_targets` を参照する
2. 外部取得を並列実行する
3. URL 正規化を行う
4. `articles_raw` に投入する

### 9.2 日次: 整形

1. `articles_raw` から未処理データを取る
2. `full` / `snippet` を判定する
3. `snippet` 行には `is_provisional=true` と `provisional_reason` を付ける
4. 要約 100 / 200 / 300 を生成する
5. タグ候補抽出とタグ照合を行う
6. 確定重複判定を行う
7. `articles_enriched` と `articles_enriched_tags` に保存する
8. provisional 行は `publish_candidate=false` にする
9. `tag_candidate_pool` を更新する
10. `articles_raw.is_processed = true` を更新する

### 9.3 毎時: 公開反映

1. `articles_enriched` から公開候補を抽出する
2. `source_priority_rules` で代表ソースを決める
3. `public_articles` / `public_article_sources` / `public_article_tags` を更新する
4. `activity_metrics_hourly` を使って `public_rankings` を更新する
5. `priority_processing_queue` があれば先に反映する

### 9.4 日次: タグ候補集計

1. 一定件数超の候補を抽出する
2. Google Trends と照合する
3. 一致候補を `tags_master` に昇格させる
4. 次回毎時バッチで再タグ付け対象に入れる

### 9.5 週次: アーカイブ

1. `articles_raw` の 1 か月超データを `articles_raw_history` へ移す
2. 古い補助データを整理する

## 10. 失敗時ハンドリング

1. 抽出失敗:
   - `snippet` ベースで継続する
2. AI 失敗:
   - 記事単位で再試行し、上限超過後はスキップする
3. 永続化失敗:
   - `last_error` に記録し、他記事は継続する
4. 公開反映失敗:
   - 対象記事だけスキップし、全体更新は続行する
