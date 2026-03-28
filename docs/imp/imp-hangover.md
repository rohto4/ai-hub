# AI Trend Hub Implementation Hangover

最終更新: 2026-03-28

## 1. このファイルの役割

セッション再開時に最初に読む短い handoff。古い handoff はここに残し続けず、最新要約だけを維持する。

## 2. 現在のブランチ状態

- ブランチ: `dev-default`
- `main` への merge はユーザーが手動実施
- `main` は本番影響ブランチとして扱う
- コミット済み: `5ac0db1 feat: add adjacent tag retag workflow`

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
- 隣接分野タグの `ai-retag` 用に `artifacts/ai-retag-all/` を生成済み
- `ai-retag` は全 12 part 中 `part-001` / `part-002` のみ出力済みで、`part-003` 以降が未処理
- enrich の同一 AI バッチ応答で `canonicalTagHints` を受け、`full_content` 記事では高信頼な alias / keyword 寄せを `tag_aliases` / `tag_keywords` へ自動反映する実装を追加済み
- `daily-tag-dedup` も `alias` / `keyword` を分けて反映する実装へ更新済み
- `enrichment-raw.ts` の interval SQL を Neon 互換に修正済み
- live run（`job_run_id=716` / `717` / `718`）では `summaryBatchSize=20`, `maxSummaryBatches=1`, 20件 full_content 処理を確認済み
- Gemini は両キーとも spending cap 429 のままだが、OpenAI fallback には `max_output_tokens` 超過時の再分割（20→10→5）を追加済み
- job_run_id=719 では `summaryBatchSize=20`, `maxSummaryBatches=1`, `manualPendingCount=0` を確認済み
- job_run_id=719 の 20 件では 12 件に主タグが付き、合計 16 主タグ、`tag_candidate_pool` は合計 45 候補増えた
- ただし `canonicalAliasCount` / `canonicalKeywordCount` は 0 のままで、`tag_aliases` / `tag_keywords` の本文ベース自動寄せはまだ発火していない
- prompt の矛盾を解消して `matchedTagKeys` 上限を 5 件へ広げた結果、job_run_id=720 では `canonicalKeywordCount=8` が出た
- ただし job_run_id=720 の 20 件では主タグ付きは 4 件のみで、コホート差を踏まえた無タグ記事分析が次に必要
- ユーザー仮説として、`arxiv-ai` / `paper` は基礎研究寄りが多く、記事系では除外した一般研究語（`rag`, `slm` など）を `paper` 専用タグ群として持つ案が有力

### 3.3 今回セッションで固定した判断

- 1周目ではカテゴリ設計を先に固定しない
- 全てを属性として見て、主タグ / 隣接分野タグ / 新規立項タグ候補を再構築する
- 2周目着手前にカテゴリ / 主タグ / 隣接タグの境界を確定する
- 主タグの完全除外リスト:
  - `llm`
  - `generative-ai`
  - `rag`
  - `agent`
  - `huggingface`
  - `hugging face`
  - `paper`
  - `policy`
  - `safety`
- カテゴリからも不要:
  - `llm`
  - `agent`
  - `voice`
- 当面のカテゴリ候補:
  - `paper`
  - `official`
  - `news`
  - `search-rag`
  - `oss`
  - `enterprise-ai`
- 今回用 artifact は既存の `artifact/` / `artifacts/` 直下に増やさず、`af-20260326/` 系の専用ディレクトリへ切る

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

## 7. 次セッションの first action

1. `af-20260326/` 系の今回専用 artifact ディレクトリ構成を作る
2. 1周目用の入力 / 出力仕様を `title + summary100 + summary200` 前提へ揃える
3. 主タグの完全除外リストを retag / prompt / 集計へ反映する
4. 50〜200件チャンクで 1周目を回し、新規立項タグ候補を集計する
5. ユーザー提示用の新規立項タグ候補一覧を作る
6. live run で `job_runs` / `job_run_items` / `articles_enriched_tags` / `tag_candidate_pool` / `tag_aliases` / `tag_keywords` の増分を確認する
7. job_run_id=719/720 の無タグ記事を分類し、タグマスタ被覆不足か prompt 判断不足かを切り分ける
8. `paper` 専用タグ群の初期候補を作り、`source_type='paper'` 限定 allowlist の試験導入を検討する

## 8. Gemini 再開用プロンプト

```
このリポジトリでは隣接分野タグ + 背景テーマの全件 retag を進めています。
作業対象は `artifacts/ai-retag-all/` です。

前提:
- `manifest.json` では全 12 part
- `outputs/ai-retag-outputs-part-001.json` と `part-002.json` は生成済み
- 今回は `part-003` 以降を順番に埋める
- 既存の output は上書きしない

まず確認するファイル:
1. `artifacts/ai-retag-all/manifest.json`
2. `artifacts/ai-retag-all/prompts/prompt-master.md`
3. `artifacts/ai-retag-all/prompts/primary-tag-master.json`
4. `artifacts/ai-retag-all/prompts/adjacent-tag-master.json`

実行方針:
- `package.json` の `db:run-ai-retag-gemini` を使う
- `part-003` から再開し、可能なところまで連続実行する
- 1 part 完了ごとに output 件数と `enrichedArticleId` 欠落/重複がないか確認する
- 全 part 完走後に `npm run db:summarize-ai-retag-outputs` を実行する
- その後 `npm run db:generate-ai-retag-sql` を実行して SQL を生成する

終了時に必ず報告すること:
- 完了した part 番号
- 未完の part
- summarize / sql generation の成否
- 異常があれば具体的な part と原因
```

## 9. 直近の未コミット差分メモ

- `docs/memo/memo.txt`
- `tmp/adjacent-keyword-counts.ts`
- `tmp/adjacent-keyword-expanded-counts.ts`

注意:

- `tmp/` 配下は今回コミット対象外の作業メモ
- `docs/memo/memo.txt` は今回の retag 実装コミットには含めていない

## 10. 次セッション開始時の推奨順

1. このファイル
2. `docs/imp/implementation-wait.md`
3. `docs/imp/implementation-plan.md`
4. `docs/imp/data-flow.md`
5. `agents-task-status.md`
