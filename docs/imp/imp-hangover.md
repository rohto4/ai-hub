# AI Trend Hub Implementation Hangover

最終更新: 2026-03-25

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

### 3.2 いま確認すべきこと

- `alphaXiv` は source にしない
- `arXiv` を source として使い、表示リンクだけ `alphaXiv` に置換する
- `arxiv-ai` backlog が大きい
- `arxiv-ai` は 5 か月超 raw を enrich 対象外にする実装を追加済み
- `arxiv-ai` は L4 を 2 か月保持上限にする実装を追加済み
- 定時 enrich は `20件 x 8回/時` に拡張済み
- `enrich` はまだ回していない
- Gemini API 負荷が大きいため、件数・時間帯・実行幅の見積もりを先に出す

## 4. `arxiv-ai` handoff

- `alphaxiv-ai` は停止済み
- `arxiv-ai` は再有効化済み
- 直近確認時点で `articles_raw total=1870`, `unprocessed=1840`
- `source_published_at < now() - 5 months` は 0 件、`public_articles` の 2 か月超も 0 件
- 過去 5 か月超 raw は skip 処理で先に処理対象外へ寄せる実装を追加済み
- 公開面では `arxiv-ai` だけ L4 を 2 か月保持にする archive 条件を追加済み
- `npx tsx scripts/run-hourly-fetch.ts --source-key arxiv-ai --limit 1` はローカル待機が timeout
- DB 上では `job_run_id=563` の `hourly-fetch` が進行していた形跡あり
- 次セッションではまず `job_run_id=563` の完了/停滞確認と、既存 backlog に対して何件 skip / archive 対象になるかを確認する

## 5. 今は触らないもの

- `docs/spec/04-data-model-and-sql.md` の破壊的変更
- 新規依存追加
- `scripts/backup-neon-all.mjs`
- `vercel.json`
- GitHub Actions の変更
- 件数確認なしの enrich 系ジョブ実行
- `arxiv-ai` の 5 か月超除外実装前の enrich 実行

## 6. 直近の未コミット差分メモ

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

## 7. 次セッション開始時の推奨順

1. このファイル
2. `docs/imp/implementation-wait.md`
3. `docs/imp/implementation-plan.md`
4. `docs/imp/data-flow.md`
5. `agents-task-status.md`
