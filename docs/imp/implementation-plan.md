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

### 2.2 現在の主要方針

1. Google Alerts は discovery 用で `feed_only`
2. 公式 source は `fulltext_allowed`
3. 一般ニュース媒体は bulk 投入後に `snippet_only / blocked / 要修正` として仕分ける
4. `summary_basis` と `provisional_reason` は必ず残す
5. `feed_only` source でも review 済み official domain は本文取得に進めてよい

### 2.3 直近の観測

1. `source_targets = 16`
2. `fulltext_allowed sources = 7`
3. `raw_total = 863`
4. `raw_unprocessed = 681`
5. `enriched_total = 182`
6. `enriched_ready_total = 19`
7. `content_path full = 19`

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
npm run db:promote-tag-candidates
```

## 8. 次に読むファイル

1. `docs/guide` 配下
2. `docs/imp/imp-hangover.md`
3. `docs/imp/imp-status.md`
4. `docs/imp/implementation-wait.md`
5. `docs/spec/05-ingestion-and-ai-pipeline.md`
6. `docs/spec/11-batch-job-design.md`

## 9. Post-Launch Maintenance Kit

This is intentionally a late-phase task. Do not prioritize it while the specification is still moving.

1. Create the maintenance kit only after the current implementation is broadly complete and the web publishing flow is stable.
2. The kit should include:
   - operator runbook
   - incident and failure triage checklist
   - standard SQL snippets for inspection
   - requeue / repair / backfill command catalog
   - source review / domain review templates
   - publish verification checklist
3. This is a hardening task for after the current implementation phase, not a current blocking deliverable.
