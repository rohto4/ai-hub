# AI Trend Hub Implementation Hangover

最終更新: 2026-03-15

## 1. このファイルの役割

セッションが切れても、ここから再開できるように現状を短く固定する。
今の主戦場は `Layer1 -> Layer2`。`Layer3 / Layer4` はまだ本格着手していない。

## 2. 現在の基本方針

1. Google Alerts は discovery 用。原則 `feed_only`。
2. 公式 source は `fulltext_allowed` を基本にする。
3. ただし本文取得は source だけでなく domain review も通す。
4. snippet は捨てない。Layer2 で
   - `full_summary`
   - `source_snippet`
   - `hold`
   に分ける。
5. `source_snippet` は「生 snippet を出す」のではなく、「snippet を入力に 100/200 要約したもの」を公開文に使う。
6. web 側は `summary_input_basis` を見て
   - 本文要約
   - snippet 要約
   を表示上で区別できるようにする。

## 3. 現在の重要カラム

### 3.1 source_targets

- `content_access_policy`
  - `feed_only`
  - `fulltext_allowed`
  - `blocked_snippet_only`

### 3.2 observed_article_domains

- `fetch_policy`
  - `needs_review`
  - `fulltext_allowed`
  - `snippet_only`
  - `blocked`

### 3.3 articles_enriched

- `summary_basis`
  - `full_content`
  - `feed_snippet`
  - `blocked_snippet`
  - `fallback_snippet`
- `publication_basis`
  - `hold`
  - `full_summary`
  - `source_snippet`
- `summary_input_basis`
  - `full_content`
  - `source_snippet`
  - `title_only`
- `publication_text`
  - 公開面で使う本文
- `is_provisional`
- `provisional_reason`
- `publish_candidate`

## 4. 現在の source 状態

### 4.1 active source 数

- active source: `17`
- `feed_only`: `9`
- `fulltext_allowed`: `8`

### 4.2 fulltext_allowed source

- `anthropic-news`
- `google-ai-blog`
- `openai-news`
- `microsoft-foundry-blog`
- `aws-machine-learning-blog`
- `huggingface-blog`
- `nvidia-developer-blog`
- `meta-ai-news`

### 4.3 active だが discovery 用の source

- Google Alerts 系 9本

## 5. 現在の Layer2 スナップショット

`npm run db:check-layer12` の最新観測:

- `raw_total = 966`
- `raw_processed = 490`
- `raw_unprocessed = 476`
- `raw_with_error = 253`
- `enriched_total = 490`
- `enriched_ready_total = 459`
- `enriched_provisional_total = 31`

### 5.1 content path

- `full = 317`
- `snippet = 173`

### 5.2 publication basis

- `full_summary = 317`
- `source_snippet = 142`
- `hold = 31`

### 5.3 summary input basis

- `full_content = 317`
- `source_snippet = 168`
- `title_only = 5`

意味:

- 317件は本文を取って要約済み
- 142件は snippet を入力に要約し、公開候補まで進めた
- 31件はまだ保留

## 6. official source の進み具合

- `openai-news ready=91 / unprocessed=187`
- `huggingface-blog ready=91 / unprocessed=186`
- `nvidia-developer-blog ready=90 / unprocessed=10`
- `aws-machine-learning-blog ready=20 / unprocessed=0`
- `microsoft-foundry-blog ready=10 / unprocessed=0`
- `meta-ai-news ready=10 / unprocessed=0`
- `anthropic-news ready=1 / unprocessed=0`
- `google-ai-blog ready=1 / unprocessed=0`

ここでいう `ready` は、現状ほぼ「Layer2 で公開候補に進める状態」の数。

## 7. 最近入れた大きい変更

### 7.1 summary_300 廃止

- 300文字要約は削除済み
- 要約は `100 / 200` のみ
- Gemini 呼び出しは 1記事あたり 3回から 2回へ削減

### 7.2 source-targeted daily enrich

- `daily-enrich` に `sourceKey` 指定を追加
- 公式 source を狙い撃ちで消化可能

API:

```bash
POST /api/cron/daily-enrich?limit=20&sourceKey=openai-news
```

### 7.3 snippet publication path

- Layer2 で `hold / full_summary / source_snippet` を確定
- `source_snippet` は snippet をそのまま出すのではなく、snippet を入力に作った 100/200 要約を `publication_text` に保存
- `summary_input_basis` で web 側が表示ラベルを切り替えられる

## 8. まだ残っている主な課題

1. web 側にまだ公開面がない
2. web 側で `summary_input_basis` を見て
   - 本文要約
   - snippet 要約
   を表示分岐する必要がある
3. official source backlog がまだ大きい
   - OpenAI
   - Hugging Face
   - NVIDIA の残り
4. raw の古い `could not determine data type of parameter $7` 系エラー残骸がまだ残っている
5. dedupe はまだ全件一律寄り
   - 再配信サイト向けの重み付けに整理余地あり
6. tag candidate はまだ運用調整余地あり

## 9. 次にやると自然なタスク

優先順:

1. web 公開面の暫定実装
   - `publish_candidate = true`
   - `publication_text`
   - `publication_basis`
   - `summary_input_basis`
   を使って一覧化
2. `source_snippet` に「配信元スニペットを要約」と表示ラベルを出す
3. official source backlog を source 指定 enrich で継続消化
4. raw error 残骸の再キュー整理
5. dedupe を「再配信サイト寄り」に寄せて再設計

## 10. すぐ使うコマンド

### 状態確認

```bash
npm run type-check
npm run db:check-layer12
npm run db:check-source-policies
npm run db:check-domain-policies -- --needs-review
```

### source / domain 操作

```bash
npm run db:set-source-policy -- <source-key> <policy> --requeue
npm run db:set-domain-policy -- <domain> <policy> <summary-policy>
npm run db:promote-domain-policy -- <domain> <policy> <summary-policy>
```

### raw 再処理

```bash
node scripts/requeue-raw.mjs --source-key openai-news --limit 20
node scripts/requeue-raw.mjs --domain example.com --provisional-only --limit 20
```

### source 指定 enrich

```bash
POST /api/cron/daily-enrich?limit=20&sourceKey=openai-news
POST /api/cron/daily-enrich?limit=20&sourceKey=huggingface-blog
POST /api/cron/daily-enrich?limit=20&sourceKey=nvidia-developer-blog
```

## 11. 参照すべきファイル

優先:

1. `docs/guide/*`
2. `docs/imp/implementation-plan.md`
3. `docs/imp/imp-status.md`
4. `docs/imp/implementation-wait.md`
5. `docs/spec/04-data-model-and-sql.md`
6. `docs/spec/05-ingestion-and-ai-pipeline.md`
7. `docs/spec/11-batch-job-design.md`

実装本体:

1. `src/lib/jobs/daily-enrich.ts`
2. `src/lib/db/enrichment.ts`
3. `src/lib/extractors/content.ts`
4. `scripts/check-layer12.mjs`

## 12. 直近コミット

- `d545ee9` feat: remove summary 300 pipeline
- `d756700` feat: support source-targeted daily enrich
- `34592e3` feat: finalize snippet publication path in layer2
- `84bf669` feat: summarize publishable snippets in layer2

## 13. 2026-03-16 追検証タスク

1. 自動要約の障害系テスト
   - `GEMINI_API_KEY` と `OPENAI_API_KEY` を無効化または外す
   - 小さな `daily-enrich` を実行する
   - `articles_enriched.ai_processing_state=manual_pending` を確認する
   - `publication_basis=hold` を確認する
   - `artifacts/manual-pending/` に JSON が出力されることを確認する
2. manual recovery テスト
   - 出力された manual-pending JSON を 1 本使う
   - reviewed output JSON を作る
   - `scripts/import-ai-enrich-outputs.ts` で import する
   - `ai_processing_state=completed` と summary 更新を確認する
3. batch provider テスト
   - `summaryBatchSize=10` で要約生成を流す
   - Gemini / OpenAI が parse 可能な JSON を安定返却するか確認する
   - `job_runs` / `job_run_items` で latency と failure pattern を見る
4. 毎時 orchestration テスト
   - `hourly-fetch -> daily-enrich` を `hourly-layer12` 経由で直列実行する
   - totals と batch count が整合するか確認する
   - stale な `running` job が残らないことを確認する

## 14. サイクルテスト移行メモ

1. まずジョブを分離して試す
   - `hourly-fetch`
   - `daily-enrich`
   - `hourly-layer12`
2. テスト条件は小さく固定する
   - `sourceKey` を固定
   - `limit` を小さく
   - `summaryBatchSize` を明示
3. 毎回 3 面で確認する
   - DB state
   - `job_runs` / `job_run_items`
   - 生成 artifact
4. 現フェイズの主要回帰リスク
   - requeue 後の重複処理
   - batch provider JSON の parse 崩れ
   - 低品質 fallback の混入
   - `manual_pending` 行が export されないこと
