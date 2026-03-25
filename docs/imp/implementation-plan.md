# AI Trend Hub 実装計画

最終更新: 2026-03-25

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

### 未完了

1. `hourly-compute-ranks` 係数調整
2. Topic Group 本実装
3. 必要なら言語フィルタ UI
4. 必要なら tag alias 管理 UI

## 2. いま優先すること

1. `arxiv-ai` backlog の現状確認
2. `job_run_id=563` の fetch 停滞有無確認
3. enrich 実行可否の判断材料整理
4. `hourly-compute-ranks` 係数調整に入る前の運用データ蓄積確認

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
- 既存 AI タグ系とは分離して、`隣接分野タグ` 区分を追加する
- 付与上限は `1〜2` 件を基本とし、AI 本体タグ `3〜5` 件と役割分担する
- 公開面での利用先を `thumbnail 背景テーマ` と `回遊補助` に限定する

### 6.2 マスタ追加（隣接分野タグ）
- 隣接分野用のタグマスタ（名称・key・alias・優先度）を新設する
- 既存 `tags_master` と混線しない命名規約を定義する
- seed / migration / admin 参照経路を追加する

### 6.3 付与ロジック追加（title + summary_200）
- 入力は `title + summary_200` を基本とする
- まずルールベース（keyword + alias）で 1〜2 件を決定する
- 既存 AI タグ付与とは別経路で保存できるようにする

### 6.4 背景テーマ出力
- 隣接分野タグから `thumbnail_bg_theme` を決定する関数を追加する
- 未判定時は既存 fallback を使う
- `hourly-publish` で `public_articles` へ背景テーマを反映する

### 6.5 合成ロジック（emoji + background）
- `thumbnail_emoji` と `thumbnail_bg_theme` の合成規則を定義する
- source_type / source_category / 隣接分野タグの優先順位を明文化する
- UI 側で theme 適用（背景色・グラデーション）を実装する

### 6.6 スコア・公開優先度連携
- 隣接分野タグは「加点目的」ではなく「文脈解像度」信号として扱う
- タグ不足ノイズ減点ロジックとは独立に評価する
- 必要なら `hourly-publish` 側で軽微な優先度調整を追加する

### 6.7 検証・運用
- サンプル監査（30〜50件）で tag 妥当性と背景テーマ整合を確認する
- ノイズ記事（tag 0/1・汎用タグのみ）で公開順位が下がることを確認する
- imp 系ドキュメントへ運用ルールと見直し条件を追記する
