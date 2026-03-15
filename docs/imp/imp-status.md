# AI Trend Hub 実装ステータス

最終更新: 2026-03-15

## 進捗サマリ

1. `layer1 -> layer4` のデータ設計を文書化した
2. Neon 向け migration を新設計へ刷新した
3. `docs/spec` を取得・整形・公開反映の流れに合わせて更新した
4. `docs/mock3` を追加し、公開データ中心の閲覧モックを作成した
5. `docs/imp` を、再開時にそのまま進めやすい形へ整理した
6. Neon 上で `layer1 / layer2` 用 migration を適用し、seed で `source_targets=9`, `source_priority_rules=18`, `tags_master=8` を投入できる状態にした
7. `hourly-fetch` を実装し、Google Alerts 系取得元から `articles_raw=162` まで投入確認した
8. `daily-enrich` を実装し、`articles_enriched=53`, `articles_enriched_tags=55`, `tag_candidate_pool=388` まで生成確認した
9. `scripts/check-layer12.mjs` を追加し、Layer1 / Layer2 の件数・エラー・候補タグをまとめて確認できるようにした
10. RSS 取得時の HTML 除去を追加し、候補タグ生成を title 中心に絞ってノイズ削減を始めた
11. `daily-enrich` は `limit` 指定で小分け実行可能にした
12. `job_runs` / `job_run_items` の監視テーブルと記録ロジックを追加し、長時間ジョブの可視化基盤を入れた
13. enrich 前の title / snippet 正規化を追加し、媒体名サフィックスや HTML エンティティ混入を減らした
14. 候補タグの stopword / generic phrase 除外を強化した

## いま残っている主要タスク

1. Neon 上で migration 適用確認
2. `daily-enrich` の処理時間短縮
3. `tag_candidate_pool` のノイズ削減
4. `content_path=full` の抽出率改善
5. `job_runs` migration 適用と監視結果の実データ確認
6. 旧 raw を再処理して title 正規化と候補タグ改善の効果確認
7. hourly publish 実装
8. 日次タグ昇格バッチ実装
9. 週次アーカイブ実装
10. `public_articles` 系を読む本実装 API 接続

## 再開時の推奨確認順

1. `docs/imp/implementation-wait.md`
2. `docs/memo/20260312-data-design.md`
3. `docs/spec/04-data-model-and-sql.md`
4. `docs/spec/05-ingestion-and-ai-pipeline.md`
5. `docs/spec/10-ingestion-layer-design.md`
6. `migrations/001_extensions.sql` から `migrations/009_rls.sql`
7. `docs/mock3/`

## 今回の一連のタスクで使った入力トークン量と出力トークン量

この実行環境では、ターン単位の正確な入力トークン量・出力トークン量は取得できません。  
そのため、数値は未記録です。

## 追加メモ

1. `layer3` は手動承認層ではなく、自動運用データ層として固定
2. タグマスタ追加だけ、人手確認の余地を残す
3. サイトは `layer4` だけを参照する前提で進める
4. 現時点の Layer2 観測値では `content_path` が `snippet: 51 / full: 2` に偏っている
5. 現時点の Layer2 観測値では `dedupe_status` は全件 `unique`
6. `tag_candidate_pool` は候補ノイズが多く、媒体名・一般語の除外を継続改善対象にする
7. `daily-enrich` は `limit` 指定で小分け実行できるようにした
8. `scripts/check-layer12.mjs` はジョブ監視結果も出す前提で拡張中
9. 既存 raw に対しても enrich 時に title / snippet 正規化が効くようにした
## 2026-03-14 Layer1/Layer2 Update

- Tightened `source target relevance` so Google Alerts matches are now `title-first`, with `snippet` treated as auxiliary evidence.
- Added source-specific context rules for `google-alerts-antigravity` to reject obvious drone noise such as `DJI`, `Avata`, and `drone`.
- Suppressed candidate tags for more generic nouns and phrases including `search`, `risks`, `governance`, `pentagon`, `health risks`, `vector search`, and `antigravity pro`.
- Expanded article extraction with extra article selectors and `application/ld+json` parsing to improve `content_path=full`.
- Added `scripts/prune-tag-candidates.mjs` and `npm run db:prune-tag-candidates` to clean previously accumulated noisy candidates from `tag_candidate_pool`.
- Reduced candidate mining to unigram/bigram only and currently disabled candidate extraction for non-Latin headlines to avoid long noisy phrase accumulation.
- Added enrich diagnostics to `job_run_items` and `db:check-layer12` so extraction stage and average extracted/snippet lengths can be inspected per run.
- Switched article fetch headers to a browser-like profile and made diagnostics read the latest completed `daily-enrich` run instead of a still-running one.
- Split snippet fallback diagnostics into `fetch_error` and `extracted_below_threshold` so the failure stage can be identified from `db:check-layer12`.
- Found the current root cause for low `content_path=full`: Google Alerts feed links were being stored as `google.com/url` redirects instead of destination article URLs. Added unwrap logic in the RSS collector and a repair script for existing rows.
- After repairing Google Alerts URLs and re-enriching a sample batch, `content_path=full` improved from `2` to `8`, and the latest completed batch showed `extracted: 6 / fetch_error: 2`.
- `db:check-layer12` now prints the latest failed extraction items so fetch-blocked domains can be identified directly from the terminal.
- Confirmed `time.com` can be fetched and parsed with the current approach; added `#article-body`, browser-like `Referer`, and retry logic to reduce transient fetch misses. `cdt.org` is currently blocked by Cloudflare and should be treated as a snippet-only domain unless a stronger fetch path is introduced.
- Added explicit snippet-only domain handling for `cdt.org` so known Cloudflare-blocked pages stop appearing as generic fetch failures.
- Candidate tag accumulation is now limited to `content_path=full` articles to stop snippet-based noise from dominating `tag_candidate_pool`.
- Expanded dedupe beyond URL equality: normalized headline signatures are now used to mark near-duplicate items as `similar_candidate` when titles converge on the same topic.
- Current improvement focus remains:
  - reducing false-positive Google Alerts matches before Layer3/Layer4 work,
  - increasing `content_path=full`,
  - keeping `job_runs` and `db:check-layer12` as the quality loop.
- Updated `docs/imp/implementation-plan.md` so the current phase, full task list, and task-by-task execution approach are readable in Japanese from the top of the file.
- Rewrote `docs/memo/20260312_dataflow.md` to match the current `hourly-fetch -> enrich -> Layer2 provisional accumulation` understanding.
- Updated `docs/spec/11-batch-job-design.md` to reflect GitHub Actions scheduling, serial `fetch -> enrich`, and snippet-based provisional accumulation.

## 2026-03-15 Hourly Layer2 Ops Update

- Added migrations `011_layer2_provisional_and_ops.sql` and `012_backfill_layer2_provisional.sql` to introduce `articles_enriched.is_provisional` / `provisional_reason` and backfill existing snippet rows.
- `publish_candidate` is now forced to `false` for provisional snippet-based Layer2 rows so provisional accumulation and publish readiness are no longer conflated.
- Added `src/lib/jobs/hourly-layer12.ts` and `/api/cron/hourly-layer12` to orchestrate `hourly-fetch -> daily-enrich` serially with configurable enrich batch splitting.
- Added GitHub Actions workflow `.github/workflows/hourly-layer12.yml` using `APP_URL` and `CRON_SECRET`.
- Added ops scripts:
  - `npm run db:requeue-raw -- 160` style raw requeue
  - `npm run db:check-snippet-domains`
  - `npm run db:promote-tag-candidates`
- Expanded `db:check-layer12` to show provisional totals, provisional reasons, snippet domain distribution, and conservative tag threshold tracking (`seen_count >= 8`).
- Verified `npm run type-check`, `npm run db:migrate`, `npm run db:check-layer12`, `npm run db:check-snippet-domains`, and a local `/api/cron/hourly-layer12?fetchLimit=1&enrichBatchSize=1&maxEnrichBatches=1` execution after requeueing raw `#160`.
- Local orchestration test results:
  - `daily-enrich` reprocessed raw `#160` as `snippet + provisional + domain_snippet_only`
  - latest `db:check-layer12` now shows `enriched_ready_total=10`, `enriched_provisional_total=152`
  - `hourly-fetch` on `ai-news-roundup` returned `Status code 404`; source registration / source repair candidate for tomorrow

## 2026-03-15 Layer2 Quality Push

- Added `db:set-source-state` and disabled `ai-news-roundup` because it was still pointing at the placeholder URL `https://example.com/ai-news`; active sources are now `11`.
- Extended `db:requeue-raw` so provisional rows can be requeued by domain, not only by raw id / source key.
- Requeued provisional articles for `theverge.com`, `wired.com`, `9to5google.com`, `androidcentral.com`, `bloomberg.com`, `cnbc.com`, `engadget.com`, `fortune.com`, `theguardian.com`, and `techcrunch.com`.
- After re-enrichment, `content_path=full` improved from `10` to `30`, while provisional rows dropped from `152` to `132`.
- `bloomberg.com` moved from generic snippet-only to explicit `fetch_error`, which is better than silent fallback because it separates extractor gaps from hard fetch failures.
- Added `db:repair-stale-job-runs` and repaired stale `daily-enrich` runs so `job_runs` monitoring no longer shows old phantom `running` entries.
- Tightened tag-candidate suppression for currently noisy terms such as `player`, `bills`, `china`, `buffet`, `lobster`, and related bigrams; then pruned existing noisy rows from `tag_candidate_pool`.
- Latest `db:check-layer12` observation:
  - `raw_processed=162 / raw_unprocessed=0`
  - `enriched_ready_total=30`
  - `enriched_provisional_total=132`
  - `candidate_pool_total=972`

## 2026-03-15 Blocked Domain + Tag Ops Push

- Added `axios.com`, `bloomberg.com`, and `youtube.com` to known `domain_snippet_only` handling, then re-enriched those rows so they no longer show as mixed snippet/fetch failures.
- Latest `db:check-snippet-domains` now shows:
  - `youtube.com domain_snippet_only = 3`
  - `axios.com domain_snippet_only = 3`
  - `bloomberg.com domain_snippet_only = 2`
  - `cdt.org domain_snippet_only = 1`
- Promoted `nvidia` from `tag_candidate_pool` to `tags_master`, then re-enriched two NVIDIA articles. `tags_master.nvidia.article_count = 2`.
- Current latest observation:
  - `source_targets=11`
  - `content_path full = 30`
  - `provisional_reason=domain_snippet_only` rows = `9`
  - `dedupe_status similar_candidate = 2`
  - `enriched_tags_total = 208`

## 2026-03-15 Source Policy Enforcement

- Added `source_targets.content_access_policy` with `feed_only / fulltext_allowed / blocked_snippet_only`.
- Backfilled current source policies to:
  - `feed_only = 9` active Google Alerts sources
  - `fulltext_allowed = 2` active official sources (`anthropic-news`, `google-ai-blog`)
- Changed enrich so `feed_only` sources do not fetch article HTML at all; they are evaluated from feed title/snippet only.
- Added `feed_only_policy` as a distinct Layer2 `provisional_reason` so policy-driven snippet accumulation is separated from extractor weakness (`extracted_below_threshold`) and transport failure (`fetch_error`).
- Requeued and re-enriched all active Google Alerts raw rows (`159` rows) so Layer2 state is consistent with the stricter policy.
- Result after policy enforcement:
  - `raw_processed=162 / raw_unprocessed=0`
  - `enriched_ready_total=2`
  - `enriched_provisional_total=160`
  - `content_path full = 2 / snippet = 160`
- This is an intentional regression in `full` count, not a bug: the previous `full=30` state relied on destination-page fetching for sources that are now treated as `feed_only`.
- Added ops scripts `db:check-source-policies` and `db:set-source-policy` so source-by-source promotion to `fulltext_allowed` can be done explicitly and requeue can be coupled to the policy change.
- Added `articles_enriched.summary_basis` so Layer2 can distinguish summaries built from `full_content`, `feed_snippet`, `blocked_snippet`, or `fallback_snippet`.
- Added `observed_article_domains` plus `db:sync-observed-domains`, `db:check-domain-policies`, and `db:set-domain-policy` so fetched destination domains can be reviewed and flagged in DB one-by-one.
- Changed enrich to consult `observed_article_domains.fetch_policy` before article fetch. `needs_review` domains now stop at snippet accumulation with `provisional_reason=domain_needs_review` until they are explicitly approved.
- Expanded `db:check-domain-policies` to show `provisional / ready / source_keys`, and added `db:promote-domain-policy` to combine `domain policy update + provisional raw requeue` in one step.

## 2026-03-15 Domain Review Throughput Update

- Reviewed the current high-volume `needs_review` queue and confirmed it is very skewed:
  - `needs_review = 130 domains / 148 articles`
  - but only `12 domains / 30 articles` had `observed_article_count >= 2`
- Added automatic domain-policy promotion for official source traffic:
  - when a `fulltext_allowed` source observes its own official domain, `observed_article_domains` now auto-promotes that domain to `fulltext_allowed / summarize_full`
  - current covered official domains include `anthropic.com`, `blog.google`, and `research.google`
- Adjusted enrich so `feed_only` sources still skip HTML fetch by default, but a reviewed `domain=fulltext_allowed` is allowed to break out of feed-only fallback and fetch full content.
- Reviewed and classified the top repeated non-official publisher domains as `snippet_only`:
  - `theverge.com`, `cnbc.com`, `theguardian.com`, `wired.com`, `techbuzz.ai`, `engadget.com`, `fortune.com`, `finance.yahoo.com`, `androidcentral.com`, `theregister.com`, `9to5google.com`, `pymnts.com`
- Promoted reviewed official / organization domains from Google Alerts to `fulltext_allowed` and re-enriched them:
  - `safe.ai`
  - `databricks.com`
  - `blogs.cisco.com`
- After re-enrichment:
  - `enriched_ready_total` improved from `2` to `5`
  - `content_path full` improved from `2` to `5`
  - `needs_review_domains` dropped from `130` to `115`
  - `needs_review_articles` dropped from `148` to `115`

## 2026-03-15 Official Source Preseed Update

- Confirmed feed endpoints for additional official sources and seeded them into `source_targets` as `fulltext_allowed`:
  - `openai-news`
  - `microsoft-foundry-blog`
  - `aws-machine-learning-blog`
  - `huggingface-blog`
  - `nvidia-developer-blog`
- Seeded matching official domains into `observed_article_domains` with `fulltext_allowed / summarize_full`:
  - `openai.com`
  - `devblogs.microsoft.com`
  - `aws.amazon.com`
  - `huggingface.co`
  - `developer.nvidia.com`
- Fixed `scripts/seed.mjs` so `source_priority_rules` uses the effective post-upsert source IDs instead of assuming the original seed IDs.
- Triggered fetch for the new official sources and confirmed raw ingestion:
  - `openai-news raw=278`
  - `huggingface-blog raw=277`
  - `nvidia-developer-blog raw=100`
  - `aws-machine-learning-blog raw=20`
  - `microsoft-foundry-blog raw=10`
- Ran a sample enrich batch afterwards; current partial outcome:
  - `source_targets = 16`
  - `fulltext_allowed sources = 7`
  - `enriched_ready_total = 19`
  - `content_path full = 19`
- Also fixed `observed_article_domains` upsert typing so new official-source fetches no longer fail on nullable policy parameters.
