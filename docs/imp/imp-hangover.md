# AI Trend Hub Implementation Hangover

最終更新: 2026-03-26

## 1. このファイルの役割

セッション再開時に最初に読む短い handoff。古い handoff はここに残し続けず、最新要約だけを維持する。

## 2. 現在のブランチ状態

- ブランチ: `dev-default`
- `main` への merge はユーザーが手動実施
- `main` は本番影響ブランチとして扱う

## 3. いま重要な状況

### 3.1 実装済み

- `content_language`
- 日本語ソース 14 件
- `thumbnail_url` 内部テンプレート運用
- admin Phase 3
- `daily-tag-dedup`
- OGP / sitemap / robots
- `hourly-compute-ranks` 最適化
- `public_article_sources` バグ修正
- 隣接分野タグ基盤（migration 038 / enrich / publish / UI反映）
- `thumbnail_bg_theme` カラム伝搬
- L2/L4 全件 retag スクリプト（`db:retag-layer2-layer4`）

### 3.2 いま確認すべきこと

- `alphaXiv` は source にしない
- `arXiv` を source として使い、表示リンクだけ `alphaXiv` に置換する
- `arxiv-ai` backlog が大きい
- `arxiv-ai` は L4 を 2 か月保持上限にする実装を追加済み
- `enrich-worker` は実効 `summaryBatchSize=20`, route `maxDuration=600`
- GitHub Actions scheduled は一時停止済みで、`workflow_dispatch` のみ
- 直近は Gemini CLI で backlog 1500 件を手動処理する前提
- `artifact/gemini-cli-enrich-backlog-1500/` に 1500 件分の input / prompt / manifest を生成済み
- `part-001` 初回結果は概ね妥当だが、文字数超過が多く prompt 再調整が必要
- prompt は `prompt-part001.md` を主に使い、`tag-master.json` を参照する運用へ寄せた

## 4. `arxiv-ai` handoff

- `alphaxiv-ai` は停止済み
- `arxiv-ai` は再有効化済み
- 直近確認時点で `articles_raw total=1870`, `unprocessed=1840`
- `source_published_at < now() - 5 months` は 0 件、`public_articles` の 2 か月超も 0 件
- 過去 5 か月超 raw は skip 処理で先に処理対象外へ寄せる実装を追加済み
- 公開面では `arxiv-ai` だけ L4 を 2 か月保持にする archive 条件を追加済み
- 監視と再判断条件は `implementation-wait.md` 1.7 に固定済み
- 次セッションでは、表示側での `arxiv-ai` 露出制御の要否を判断するため backlog と露出量を継続観測する

## 5. Gemini CLI backlog handoff

- 生成器: `scripts/prepare-gemini-cli-enrich-artifacts.ts`
- 実行コマンド: `npm run db:prepare-gemini-cli-enrich`
- 生成済みディレクトリ: `artifact/gemini-cli-enrich-backlog-1500/`
- 構成:
  - `inputs/` Gemini に読ませる材料 JSON
  - `prompts/` 手動実行用 prompt
  - `manifest.json` chunk 対応表
- `prompts/prompt-part001.md` に以下を統合済み:
  - title と summary の役割分担
  - 100/200 文字超過時の自己修正
  - `matchedTagKeys` 最大 5 / `proposedTags` 最大 2
  - 既存 tag master 優先ルール
- `prompts/tag-master.json` を生成済み（最新 tag master の `tagKey` / `displayName` / alias）
- `part-001` 初回出力確認結果:
  - 内容方向は概ね妥当
  - ただし文字数超過が多かったため、prompt を強化済み
- 未完:
  - 強化後 prompt で `part-001` を再実行して再確認
  - `part-002` 以降も同じ prompt 仕様へ揃える
  - import 側を `matchedTagKeys` / `proposedTags` 形式へ合わせるか判断

## 6. 今は触らないもの

- `docs/spec/04-data-model-and-sql.md` の破壊的変更
- 新規依存追加
- `scripts/backup-neon-all.mjs`
- `vercel.json`
- GitHub Actions の変更
- 件数確認なしの enrich 系ジョブ実行
- `arxiv-ai` の 5 か月超除外実装前の enrich 実行

## 8. 次セッションの first action

1. migration 038 を適用できる環境か確認する
2. `npm run db:retag-layer2-layer4 -- --dry-run` で出力確認
3. 問題なければ `npm run db:retag-layer2-layer4` を実行し、L2/L4 整合を監査する

## 7. 直近の未コミット差分メモ

- `src/lib/db/public-shared.ts`
- `src/lib/db/public-listings.ts`
- `src/lib/db/public-rankings.ts`
- `src/lib/db/public-search.ts`
- `src/lib/db/observed-domains.ts`
- `src/lib/db/enrichment-raw.ts`
- `src/lib/db/enrichment-types.ts`
- `src/lib/db/enrichment.ts`
- `src/lib/enrich/enrich-worker-shared.ts`
- `src/lib/jobs/enrich-worker.ts`
- `src/lib/collectors/api.ts`
- `src/lib/source-retention.ts`
- `src/lib/jobs/monthly-public-archive.ts`
- `scripts/run-monthly-public-archive.ts`
- `scripts/seed.mjs`

注意:

- untracked の `.agents/skills/security-review/SKILL.md` は今回の作業対象外

## 8. 次セッション開始時の推奨順

1. このファイル
2. `docs/imp/implementation-wait.md`
3. `docs/imp/implementation-plan.md`
4. `docs/imp/data-flow.md`
5. `agents-task-status.md`
