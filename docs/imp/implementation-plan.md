# AI Trend Hub 実装計画

最終更新: 2026-04-02

## 1. 現在のフェーズ

主要機能の実装フェーズはほぼ完了。現在は、タグ再構築 1 周目の結果を踏まえて公開面導線を整え、運用を安定化するフェーズとする。

実装済み:
- Layer 1 → Layer 2 → Layer 4 パイプライン
- `content_language`
- 日本語ソース 14 件
- `thumbnail_url`
- admin Phase 3
- `daily-tag-dedup`
- OGP / sitemap / robots
- `monthly-public-archive`
- 隣接分野タグ基盤と `thumbnail_bg_theme`
- L2/L4 タグ洗い替えスクリプト
- 定時 batch schedule 復旧

## 2. いま優先すること

1. 主タグ・新規立項タグ・カテゴリ・周辺分野タグの役割分担を公開面へ落とし込む
2. カテゴリを公開面サイドバー導線として実装する
3. 周辺分野タグを当面通常タグと同様にクリック可能な導線として実装する
4. 実装した Web を見ながらカテゴリ配置とタグ導線を評価する
5. タグ参照 SQL を使って、新規立項タグ候補の次ラウンド判断を進める
6. enrich 本線と CLI import 線の副作用差を減らす

## 3. 現在の固定方針

### 3.1 公開面の軸

1. topic filter: `source_category`
2. source lane: `source_type`
3. trend/entity filter: tags

### 3.2 収集・保持

- `alphaXiv` は source にしない
- `arXiv` を収集 source とし、公開時だけ `alphaXiv` に置換する
- `arxiv-ai` は 5 か月超 raw を enrich 対象外とし、L4 は 2 か月保持上限とする
- ToS / 商用利用可否は `commercial_use_policy` で管理する

### 3.3 サムネイル

- `thumbnail_url` は内部テンプレート方式
- `thumbnail_bg_theme` は隣接分野タグから決定する
- icon 未整備時は `thumbnail_emoji` をフォールバックに使う

### 3.4 タグ再構築 1 周目

- 1 周目は最終カテゴリ確定ではなく、属性としての全件再構築と新規立項タグ候補抽出を目的にする
- 主タグは最大 5 件、平均 4 件超を目標にする
- 隣接分野タグは公開導線用として数百件規模の付与を目指す
- 2 周目着手前にカテゴリ / 主タグ / 周辺分野タグの境界を確定する

主タグの完全除外:
- `llm`
- `generative-ai`
- `rag`
- `agent`
- `huggingface`
- `hugging face`
- `paper`
- `policy`
- `safety`

カテゴリからも不要:
- `llm`
- `agent`
- `voice`

観察中のカテゴリ候補:
- `paper`
- `official`
- `news`
- `search-rag`
- `oss`
- `enterprise-ai`

### 3.5 導線の当面の扱い

- 主タグ: trend / entity の主導線
- 新規立項タグ候補: 公開導線ではなく運用判断用
- カテゴリ: 公開面サイドバーの大枠導線
- 周辺分野タグ: 当面は通常タグと同じクリック導線
- `paper` 専用タグマスタは後続タスクとして保留

### 3.6 enrich / batch 運用

- `hourly-enrich` は毎時 `:05 / :10 / :15 / :20 / :25 / :30 / :35 / :40`
- `enrich-worker` の基本設定は `limit=20`, `summaryBatchSize=20`, `maxSummaryBatches=1`
- `hourly-publish` は毎時 `:50`
- `monthly-public-archive` は毎月 1 日 `03:00 UTC`
- 詳細仕様は `docs/imp/batch-reforme-spec.md`、運用手順は `docs/imp/batch-ops.md` を参照する

## 4. 次の改善候補

1. `import-ai-enrich-outputs.ts` を通常 enrich と同じ副作用へ揃える
2. `hourly-fetch` の source 単位 backoff 制御を導入する
3. `cron-health-check` の要否を判断する
4. `weekly-archive` の要否を判断する

## 5. 後回しでよいもの

1. Topic Group
2. `critique` UI
3. `ADMIN_PATH_PREFIX` 動的化
4. `push_subscriptions.genres` rename
5. tag alias 管理 UI
6. `paper` 専用タグマスタと切替ロジック
7. 周辺分野タグの視覚マッピングページ
8. タグ関連テーブルの再編
9. パーソナライズ設定 UI

## 6. 非対象

- DB スキーマの破壊的変更
- 新規依存追加
- `scripts/backup-neon-all.mjs`
- `vercel.json`
- GitHub Actions の大きな運用方針変更
