# 収集・要約・公開パイプライン仕様（v4）

最終更新: 2026-04-02

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
3. `content_access_policy` を source 単位で持つ
4. 取得間隔は source 単位で持つ
5. 更新検知可否も source 単位で持つ
6. `articles_raw.title` は source 生データ保持用であり、日本語化や公開向けタイトル整形の対象にしない
7. `fulltext_allowed` source に限り、raw title 汚染が起きた場合は URL 再取得で原題復旧してから enrich へ戻してよい
8. AI 要約 provider が使えない場合は、`summaryInputText` をファイルへ export し、外部 CLI / 手作業で summary を生成してから後段登録してよい

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

要件:

1. 何が起きたかが分かる
2. なぜ重要かが分かる
3. 誰に関係するかが分かる

## 6. タグ付与

### 6.1 整形時

1. AI がタグ候補を出す
2. `tags_master` と `tag_aliases` に照合する
3. `matchedTagKeys` は既存主タグとして `articles_enriched_tags` に保存する
4. `properNounTags` のうち未採用候補は `tag_candidate_pool` に蓄積する
5. `summaryInputBasis=full_content` のときだけ `canonicalTagHints` を使って `tag_aliases` / `tag_keywords` へ高信頼寄せを行う
6. `title + summary_200` から隣接分野タグを抽出し、`articles_enriched_adjacent_tags` と `thumbnail_bg_theme` を更新する

### 6.2 日次統合

1. `daily-tag-dedup` が `tag_candidate_pool` と既存タグを照合する
2. AI とルールベースで alias / keyword / 保留を判定する
3. 必要に応じて `tag_aliases` / `tag_keywords` を更新する
4. 昇格済みタグや統合結果は retag / publish で反映する

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

### 9.2 毎時: 整形

1. `articles_raw` から未処理データを取る
2. まず `source_targets.content_access_policy` を判定する
3. 次に `observed_article_domains.fetch_policy` を判定する
4. `feed_only` source は本文 fetch せず title/snippet だけで継続する
5. `fulltext_allowed` source でも `domain=fulltext_allowed` 以外は本文 fetch しない
6. `full` / `snippet` を判定する
7. `summary_basis` を `full_content / feed_snippet / blocked_snippet / fallback_snippet` で付ける
8. `publication_basis` を `hold / full_summary / source_snippet` で付ける
9. `publication_text` に公開面で使う本文を保存する
10. `summary_input_basis` に「本文要約 / snippet要約 / title fallback」の別を保存する
   - `feed_only` source は `provisional_reason=feed_only_policy`
   - 未判定 domain は `provisional_reason=domain_needs_review`
11. 要約 100 / 200 を生成する
   - provider 順は `Gemini(primary) -> Gemini(secondary) -> OpenAI gpt-5-mini`
   - 両 provider が失敗した行は `manual_pending` に回す
   - `manual_pending` 行は `hold` のまま DB に保持し、手動 import 用 JSON を `artifacts/manual-pending/` へ出力する
12. AI は `properNounTags` と `matchedTagKeys` を返す
13. `summaryInputBasis=full_content` のときだけ `canonicalTagHints` を返し、既存タグへの alias / keyword 寄せに使う
14. `title + summary_200` から隣接分野タグを抽出し、`thumbnail_bg_theme` を決定する
15. タグ候補抽出とタグ照合を行う
16. 確定重複判定を行う
17. `articles_enriched`、`articles_enriched_tags`、`articles_enriched_adjacent_tags` に保存する
18. `source_snippet` 行は snippet を要約した結果を公開面に使う
19. `hold` 行だけ `publish_candidate=false` にする
20. `tag_candidate_pool` を更新する
21. `articles_raw.is_processed = true` を更新する

### 9.3 毎時: 公開反映

1. `articles_enriched` から公開候補を抽出する
2. `source_priority_rules` で代表ソースを決める
3. `commercial_use_policy='prohibited'` は publish 対象外にする
4. `public_articles` / `public_article_sources` / `public_article_tags` / `public_article_adjacent_tags` を更新する
5. `public_articles` には `content_language`、`thumbnail_bg_theme`、`thumbnail_emoji` も転写する
6. publish 後段で `hourly-compute-ranks` が `public_rankings` を更新する
7. `priority_processing_queue` は将来拡張用で、現時点では必須経路に入れない

### 9.4 日次: タグ候補統合

1. `daily-tag-dedup` が `tag_candidate_pool` と既存タグを照合する
2. AI とルールベースで alias / keyword / 保留を判定する
3. 必要に応じて `tag_aliases` / `tag_keywords` を更新する
4. 昇格済みタグや統合結果は次回の retag / publish で反映する

### 9.5 月次: 公開アーカイブ

1. `public_articles` の半年超データを `public_articles_history` へ移す
2. `public_article_tags` / `public_article_sources` / `public_rankings` は cascade で整理する
3. `arxiv-ai` は例外として L4 で 2 か月保持上限にする

## 10. 失敗時ハンドリング

1. 抽出失敗:
   - `snippet` ベースで継続する
2. AI 失敗:
   - provider fallback と batch 分割を試し、それでも失敗したものは `manual_pending` に回す
3. 永続化失敗:
   - `last_error` に記録し、他記事は継続する
4. 公開反映失敗:
   - 対象記事だけスキップし、全体更新は続行する
