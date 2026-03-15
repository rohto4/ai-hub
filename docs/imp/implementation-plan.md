# AI Trend Hub 実装計画

最終更新: 2026-03-15

## 1. 目的

当面の主目的は `Layer1 -> Layer2` を運用可能な品質まで引き上げること。  
特に次を優先する。

1. 公式 source を増やして `full_content` 母集団を広げる
2. 毎時 `fetch -> enrich` を止まらず回せる状態を保つ
3. 採用できない source / domain を後段で一覧化できるようにする

`Layer3 / Layer4` はまだ保留。

## 2. 現在地

### 2.1 実装済みの基盤

1. `hourly-fetch`
2. `daily-enrich`
3. `hourly-layer12` orchestration
4. GitHub Actions による毎時実行入口
5. `articles_enriched.is_provisional`
6. `articles_enriched.provisional_reason`
7. `articles_enriched.summary_basis`
8. `source_targets.content_access_policy`
9. `observed_article_domains.fetch_policy`
10. `db:check-layer12`
11. `db:check-source-policies`
12. `db:check-domain-policies`
13. `db:promote-domain-policy`
14. `Gemini(primary) -> Gemini(secondary) -> OpenAI gpt-5-mini -> template` の要約フォールバック
15. 主キー列の generic `id` 廃止とテーブル固有名への統一
16. `raw_id` / `enriched_id` / `job_id` など可読な安定文字列 ID の追加

### 2.2 現在の主要方針

1. Google Alerts は discovery 用で `feed_only`
2. 公式 source は `fulltext_allowed`
3. 一般ニュース媒体は bulk 投入後に `snippet_only / blocked / 要修正` として仕分ける
4. `summary_basis` と `provisional_reason` は必ず残す
5. `feed_only` source でも review 済み official domain は本文取得に進めてよい
6. `articles_enriched` の `title` / `summary_100` / `summary_200` / `publication_text` は日本語を前提とし、英語残しは許容しない
7. `articles_raw.title` は取得元の生タイトルとして扱い、日本語化や要約タイトルへの置換は運用対象にしない

### 2.3 直近の観測

1. `source_targets = 17`
2. `fulltext_allowed sources = 8`
3. `raw_total = 966`
4. `raw_processed = 687`
5. `raw_unprocessed = 279`
6. `enriched_total = 687`
7. `enriched_ready_total = 645`
8. `enriched_provisional_total = 37`
9. `openai-news` は `278/278` enrich 完了
10. `nvidia-developer-blog` は `100/100` enrich 完了
11. `huggingface-blog` は `91/277` まで enrich 完了、残り `186`
12. 残 official backlog `186` 件は AI 入力ファイルへ export 済み
13. export ファイル内訳は `full_content=100 / title_only=86`
14. `GEMINI_API_KEY` に加えて `GEMINI_API_KEY2` も要約 fallback に利用可能
15. `OPENAI_API_KEY` は有効で、`gpt-5-mini` 応答自体は取得できる
16. `gpt-5-mini` は `reasoning.effort=minimal` と十分な `max_output_tokens` がないと空応答化し得る
17. template fallback は公開要約には使わず `hold` に寄せる方針へ修正済み
18. DB 主キー列は `id` ではなく `raw_article_id` / `enriched_article_id` / `job_run_id` などへ統一済み

## 3. 現在の実行モード

### 3.1 方針転換

ここからは「1件ずつ丁寧に review」より「公式 source を一括投入して bulk fetch / bulk enrich を回す」を優先する。

review は投入前の前提条件ではなく、投入後の例外仕分けとして扱う。

### 3.2 実行レーン

1. レーンA: 一括投入
   - 公式 RSS / Atom / API source をまとめて seed
   - official domain を先回り allowlist 登録
   - `hourly-fetch` を大きめに回す
   - `daily-enrich` を batch で連続消化する
2. レーンB: 後段仕分け
   - 採用成功 source
   - `snippet_only` 維持 source
   - `blocked` source
   - 要修正 source
   を一覧化する

### 3.3 今の優先成果物

1. 採用できる source を増やすこと
2. 採用できない source を一覧で出すこと
3. サービス開始フェーズへ移るための source 母集団を作ること
4. official source backlog は raw title を URL から原題復旧して救済し、Google Alerts backlog は切り離して新規蓄積を優先すること
5. AI 要約が重い区間は input/output ファイル往復でオフライン処理できるようにすること

## 4. 直近タスク

### A. Bulk Source Expansion

1. 公式 source の追加
2. official domain preseed
3. source seed の安定化
4. bulk fetch
5. bulk enrich

### B. Bulk Triage

1. `db:check-layer12` で full / provisional を確認
2. `job_runs` で失敗 source を確認
3. `db:check-domain-policies` で高頻度 domain を確認
4. `snippet_only / blocked / 要修正` 一覧を作る
5. summary provider が `template` に落ちた行は publish させない
6. `articles_enriched.title` に英語残しがないことを確認し、日本語化漏れを都度解消する

### C. Tag Hygiene

1. `full_content` 増加後の candidate ノイズ確認
2. prune
3. promote

## 5. 当面の投入対象

### 5.1 既存 official source

1. `anthropic-news`
2. `google-ai-blog`
3. `openai-news`
4. `microsoft-foundry-blog`
5. `aws-machine-learning-blog`
6. `huggingface-blog`
7. `nvidia-developer-blog`

### 5.2 次の追加候補

1. Meta AI News
2. Cohere official blog
3. Mistral official news
4. xAI official news

ただし、次候補は feed 実在確認後に入れる。

## 6. 今回の運用原則

1. Google Alerts を広く `fulltext_allowed` に戻さない
2. 一般ニュース媒体の個別 review 完了を bulk 投入の前提にしない
3. `summary_basis` / `provisional_reason` を消さない
4. official source と official domain は先回りで seed する
5. 例外は後段で一覧化して判断する

## 7. 実行コマンド

### 7.1 確認

```bash
npm run type-check
npm run db:check-layer12
npm run db:check-source-policies
npm run db:check-domain-policies -- --needs-review
```

### 7.2 seed / sync

```bash
npm run db:seed
npm run db:sync-observed-domains
```

### 7.3 policy 操作

```bash
npm run db:set-source-policy -- <source-key> <policy> --requeue
npm run db:set-domain-policy -- <domain> <policy> <summary-policy>
npm run db:promote-domain-policy -- <domain> <policy> <summary-policy>
```

### 7.4 補助

```bash
npm run db:check-snippet-domains
npm run db:repair-stale-job-runs
npm run db:repair-raw-titles-from-url -- --source-key <source-key> --limit <n>
npm run db:export-ai-enrich-inputs
npm run db:promote-tag-candidates
npm run db:skip-raw-backlog -- --through-raw-id <raw_article_id>
```

## 8. 次に読むファイル

1. `docs/guide` 配下
2. `docs/imp/imp-hangover.md`
3. `docs/imp/imp-status.md`
4. `docs/imp/implementation-wait.md`
5. `docs/spec/05-ingestion-and-ai-pipeline.md`
6. `docs/spec/11-batch-job-design.md`

## 9. Post-Launch Maintenance Kit

これは後期タスクとして扱う。現在の実装フェイズの blocker にはしない。

1. サイト公開フローが安定してから作る
2. 内容には以下を含める
   - operator runbook
   - incident / failure triage checklist
   - inspection 用 SQL 集
   - requeue / repair / backfill command catalog
   - source review / domain review template
   - publish verification checklist

## 10. 2026-03-16 現在の到達点

1. 初期 official backlog の消化は完了した。
   - `openai-news`
   - `nvidia-developer-blog`
   - `huggingface-blog`
2. 手動 AI フローは end-to-end で成立確認済み。
   - enrich input を JSON export
   - 手動 CLI で title / summary を生成
   - 出力 JSON の固有名詞を校正
   - 出力を結合
   - `scripts/import-ai-enrich-outputs.ts` で import
3. 現在の確認済み状態:
   - `articles_enriched = 873`
   - `huggingface-blog = 277/277 enriched`
   - `huggingface-blog raw_unprocessed = 0`
4. 直近の主眼:
   - `873` 件を前提にサービス開始準備へ寄せる
   - 日次蓄積を manual AI fallback 前提でも回せるようにする

## 11. 2026-03-16 要約安定化方針

1. 自動要約経路は次の 2 点で安定化を進める。
   - `10` 件単位の batch 要約
   - Gemini / OpenAI 共通の固定 prompt template
2. 毎時運用経路でも同じ batch 要約を使い、別系統の prompt にはしない。
3. 実装反映済み:
   - `daily-enrich` は `summaryBatchSize` に対応
   - `hourly-layer12` は `summaryBatchSize` に対応
   - prompt template は `src/lib/ai/prompts/enrich-batch-ja.ts`
4. 次の運用確認:
   - batch size `10` で Gemini / OpenAI が parse 可能な JSON を安定返却するか
   - `job_runs` 上で latency / token usage / failure rate を観測する

## 12. 2026-03-16 Manual Pending 方針

1. Gemini と OpenAI が両方失敗した場合、Layer2 は template summary を公開用には使わない。
2. その場合のシステム動作:
   - deterministic な Layer2 項目は DB に保存する
   - 記事は `hold` のまま保持する
   - 行は `ai_processing_state=manual_pending` にする
   - 手動 import 互換の JSON を `artifacts/manual-pending/` に出力する
3. 手動復旧フロー:
   - 出力ファイルを人手 / CLI 要約に渡す
   - `scripts/import-ai-enrich-outputs.ts` で reviewed output を import する
   - 行を `ai_processing_state=completed` へ戻す

## 13. 2026-03-16 サイクルテスト移行

1. フェイズは `bulk implementation / backlog rescue` から `cycle test / hardening` へ移る。
2. テスト順は次を基本とする。
   - `hourly-fetch`
   - `daily-enrich`
   - `hourly-layer12`
3. 各サイクルテストは、小さく固定した条件から始める。
   - 明示的な `sourceKey`
   - 小さい `limit`
   - 明示的な `summaryBatchSize=10`
4. 毎回の確認面は次の 3 つをセットにする。
   - DB state (`articles_raw`, `articles_enriched`)
   - `job_runs` / `job_run_items`
   - 生成 artifact（必要時は `artifacts/manual-pending/`）
5. 価値の高い確認項目:
   - 正常系: official source fetch -> enrich -> `hold / full_summary / source_snippet` ルーティング
   - provider 系: Gemini / OpenAI batch JSON の安定性
   - 障害系: 両 provider 失敗 -> `manual_pending` export
   - 復旧系: manual output import -> `ai_processing_state=completed`
