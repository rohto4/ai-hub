# AI Trend Hub 実装計画

最終更新: 2026-03-26

## 1. 現在のフェーズ

主要機能の実装フェーズはほぼ完了。残りは運用調整と後続機能。

### 実装済み

- Layer 1 → 2 → 4 パイプライン
- `content_language`
- 日本語ソース 14 件
- `thumbnail_url`
- admin Phase 3
- `daily-tag-dedup`
- OGP / sitemap / robots
- `monthly-public-archive`
- 隣接分野タグ基盤（schema / enrich / publish / UI 反映）
- `thumbnail_bg_theme` 伝搬（L2→L4）
- L2/L4 タグ洗い替えスクリプト（`db:retag-layer2-layer4`）

### 未完了

1. `hourly-compute-ranks` 係数調整
2. Topic Group 本実装
3. 必要なら言語フィルタ UI
4. 必要なら tag alias 管理 UI
5. 隣接分野タグの運用監査（6.7）

## 2. いま優先すること

1. `arxiv-ai` backlog の現状確認
2. `job_run_id=563` の fetch 停滞有無確認
3. enrich 実行可否の判断材料整理
4. `hourly-compute-ranks` 係数調整に入る前の運用データ蓄積確認
5. migration 038 のDB適用と全件 retag 実行

## 3. 現在の固定方針

### 3.1 公開面の軸

1. topic filter: `source_category`
2. source lane: `source_type`
3. trend/entity filter: tags

### 3.2 サムネイル

- `thumbnail_url` は内部テンプレート方式
- icon が弱い/未登録なら `thumbnail_emoji` fallback
- 後からの見た目変更は `db:backfill-thumbnail-urls` で再同期する

### 3.3 収集方針

- `alphaXiv` は source にしない
- `arXiv` 収集、公開時だけ `alphaXiv` へ置換
- ToS / 商用利用可否は `commercial_use_policy` で管理

### 3.4 `arxiv-ai` の例外運用

- `arxiv-ai` は件数が大きいため通常 source と同じ保持ルールにしない
- 5 か月超の raw は enrich claim 前に処理対象から外し、Gemini API の無駄打ちを防ぐ
- L4 (`public_articles`) では `arxiv-ai` だけ 2 か月を保持上限とする
- 半年保持の一般ルールは他 source に適用し、`arxiv-ai` は公開面だけ例外扱いにする

### 3.5 定時 enrich の基本設定

- `hourly-enrich` は毎時 `:05 / :10 / :15 / :20 / :25 / :30 / :35 / :40` の 8 回実行にする
- 各回の `enrich-worker` は `limit=20`, `summaryBatchSize=20`, `maxSummaryBatches=1` を基本設定とする
- `hourly-publish` は引き続き毎時 `:50` に実行する

## 4. 後回しでよいもの

1. Topic Group
2. `critique` UI
3. `ADMIN_PATH_PREFIX` 動的化
4. `push_subscriptions.genres` rename
5. tag alias 管理 UI

## 5. 非対象

- DB スキーマの破壊的変更
- 新規依存追加
- `scripts/backup-neon-all.mjs`
- `vercel.json`
- GitHub Actions 変更

## 6. 隣接分野タグ + 背景テーマ（新規）

### 6.1 仕様設計（区分追加）
- 実装済み。既存 AI タグ系とは分離し、`adjacent_tags_master` 系テーブルで管理する
- 付与上限は `1〜2` 件（`matchAdjacentTagsFromKeywords(..., 2)`）
- 公開面での主用途は `thumbnail_bg_theme` とする

### 6.2 マスタ追加（隣接分野タグ）
- 実装済み（migration 038）
- `adjacent_tags_master` / `adjacent_tag_keywords` を追加
- 初期タグ（infra/security/robotics/media/finance/healthcare/education/legal/gaming/hardware）を投入

### 6.3 付与ロジック追加（title + summary_200）
- 実装済み
- `title + summary_200` を入力にルールベース判定
- 保存先: `articles_enriched_adjacent_tags`（L2）

### 6.4 背景テーマ出力
- 実装済み
- L2: `articles_enriched.thumbnail_bg_theme`
- L4: `public_articles.thumbnail_bg_theme`
- 判定不可時は既存テーマへ fallback

### 6.5 合成ロジック（emoji + background）
- 実装済み
- `thumbnail_url` 生成時は `thumbnail_bg_theme` を優先利用
- `thumbnail_url` 未設定時は `ArticleThumbnail` が `thumbnail_bg_theme` ベース背景で emoji を描画

### 6.6 スコア・公開優先度連携
- 実装済み（現時点）
- 隣接分野タグは加点に使わず、表示文脈・背景テーマにのみ利用
- 既存のタグ不足ノイズ減点ロジックは維持

### 6.7 検証・運用
- 実装準備済み（未実行）
- `scripts/retag-layer2-layer4.ts` で全件洗い替え可能
- 監査プロンプトを `artifacts/gemini-tag-rebuild/` に追加
