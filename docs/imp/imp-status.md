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

## 2026-03-15 Bulk Source Acceleration Update

- Switched the execution mode in practice from `slow domain-by-domain review` to `bulk official source seeding + bulk fetch/enrich + post-hoc triage`.
- Added `meta-ai-news` and preseeded `about.fb.com` as an official domain.
- Ran a bulk cycle:
  - `hourly-fetch?limit=10`
  - `daily-enrich?limit=12` x 5
- Bulk fetch result:
  - `processedTargets = 9`
  - `inserted = 103`
  - successful new official source: `meta-ai-news inserted=10`
- Bulk enrich result:
  - processed `60` additional raw rows
  - most rows from official sources resolved to `full_content`
- Current latest observation after the bulk cycle:
  - `source_targets = 17`
  - `fulltext_allowed sources = 8`
  - `raw_total = 966`
  - `enriched_total = 242`
  - `enriched_ready_total = 69`
  - `content_path full = 69`
- Official source adoption now looks like this:
  - `huggingface-blog ready=14 / full=14`
  - `nvidia-developer-blog ready=14 / full=14`
  - `openai-news ready=13 / full=13`
  - `aws-machine-learning-blog ready=13 / full=13`
  - `microsoft-foundry-blog ready=10 / full=10`
  - `meta-ai-news raw=10 / enriched=0` (fetched, not consumed yet)
- Current `needs-fix` sources discovered from the latest hourly fetch:
  - `anthropic-news` -> `Status code 404`
  - `google-ai-blog` -> `Cannot convert object to primitive value`
- Interpretation:
  - bulk official source expansion is now clearly producing publish-ready `full_content`
  - the main path to service start is to keep consuming official-source raw backlog and maintain a separate fix list for the few broken sources

## 2026-03-15 Summary Cost Reduction Update

- Removed `summary_300` from the active runtime/data path.
- `generateEnrichedSummary()` now produces only:
  - `summary100`
  - `summary200`
- This reduces Gemini summary calls per article from `3` to `2`.
- Added migration `018_remove_summary_300.sql` to drop:
  - `articles_enriched.summary_300`
  - `articles_enriched_history.summary_300`
  - `public_articles.display_summary_300`
- Updated current specs so the live requirement is now `100 / 200` only.

## 2026-03-15 Snippet Publication Path Update

- Added Layer2 publication routing with:
  - `hold`
  - `full_summary`
  - `source_snippet`
- Layer2 now stores both `publication_basis` and `publication_text`.
- Layer2 also stores `summary_input_basis` so the web tier can distinguish full-content summaries from snippet-based summaries.
- `feed_snippet` / `blocked_snippet` rows can be finalized at Layer2 when they are:
  - relevant
  - unique
  - long enough
  - not visibly truncated
- Finalized snippet rows are no longer treated as provisional and can become publish candidates.

## 2026-03-15 Summary Provider + Localization Update

- Added summary fallback order in practice and runtime as:
  - `GEMINI_API_KEY`
  - `GEMINI_API_KEY2`
  - `OPENAI_API_KEY`
  - `template`
- Verified `OPENAI_API_KEY` is usable and `gpt-5-mini` returns valid summaries when called with:
  - `reasoning.effort=minimal`
  - sufficient `max_output_tokens`
- Changed the fallback behavior so `template` output is not treated as a publishable summary and rows that fall to `template` are forced to `publication_basis=hold`.
- Ran a Layer2 remediation pass for non-Japanese summaries and cleared the remaining non-Japanese summary rows from `articles_enriched`.

## 2026-03-16 Hugging Face 手動 import 更新

- DB import 前に、手動 AI 出力ファイルの固有名詞・製品名表記を校正した。
  - `Transformers` の大文字表記
  - `Hugging Face` のスペース
  - `AraGen` の表記
- 4 分割の手動 AI 出力を `artifacts/ai-enrich-outputs-official-remaining.json` に結合した。
- 残っていた `huggingface-blog` backlog を `scripts/import-ai-enrich-outputs.ts` で import した。
- import 結果:
  - `processed_count = 186`
  - `success_count = 186`
  - `failed_count = 0`
- import 後の DB 状態:
  - `articles_enriched = 873`
  - `huggingface-blog = 277/277 enriched`
  - `huggingface-blog raw_unprocessed = 0`
- 補足:
  - 手動要約 JSON には `100 / 200` 文字制限超過が多く含まれていた
  - 現行 import 経路では DB 書き込み時に truncate されるため、投入自体は正常終了した

## 2026-03-16 要約 batch + prompt template 更新

- Layer2 要約用の専用 prompt template ファイルを追加した:
  - `src/lib/ai/prompts/enrich-batch-ja.ts`
- 要約経路を `1記事 / 1項目ごとの呼び出し` から `10記事単位の batch 呼び出し` へ変更した。
- `src/lib/ai/enrich.ts` の現在仕様:
  - batch ごとに固定の日本語 prompt template を組み立てる
  - `summary100Ja` と `summary200Ja` を 1 回の応答で要求する
  - 構造化 JSON を parse する
  - provider 順は `Gemini(primary) -> Gemini(secondary) -> OpenAI`
- `daily-enrich` は `summaryBatchSize` を受け取り、DB upsert 前に batch 要約する。
- `hourly-layer12` と cron route も `summaryBatchSize` を渡せるようにした。
- 確認:
  - `npm run type-check`

## 2026-03-16 Manual Pending fallback 更新

- Layer2 enrich の最終 fallback を `template` から `manual_pending` へ切り替えた。
- migration `023_add_ai_processing_state.sql` を追加した。
  - `articles_enriched.ai_processing_state`
  - `articles_enriched_history.ai_processing_state`
- `ai_processing_state` の現在値:
  - `completed`
  - `manual_pending`
- Gemini と OpenAI が両方失敗した batch では:
  - deterministic な Layer2 項目は DB に保存する
  - `publication_basis` は `hold` に固定する
  - 行は `ai_processing_state=manual_pending` にする
  - 一時的な placeholder summary を DB 充足用に入れる
  - 手動 import 互換の JSON を `artifacts/manual-pending/` に出力する
- `scripts/import-ai-enrich-outputs.ts` は manual import 完了時に `ai_processing_state=completed` を書き戻す。
- 確認:
  - `npm run type-check`
  - `npm run db:migrate`
- `articles_enriched.title` も Claude ベースの運用で日本語化済みとし、enriched 側の英語 title は今後は品質不良として扱う。

## 2026-03-16 現在の統合スナップショット

- 現在の解釈:
  - initial official-source backlog rescue は完了
  - Layer2 蓄積は `873` 件を基盤に回る状態
  - 自動要約経路は `10` 件 batch + 固定 prompt template に移行済み
  - Gemini / OpenAI が両方失敗した場合は deterministic な Layer2 を保存したうえで `manual_pending` へ回す
- 現在の DB 状態:
  - `articles_enriched = 873`
  - `ai_processing_state=completed = 873`
  - `ai_processing_state=manual_pending = 0`
- 現在フェイズ:
  - 実装追加よりも、ジョブ経路の cycle test と hardening が主課題

## 2026-03-15 Primary Key Naming + Stable Text ID Update

- Renamed generic primary key columns away from bare `id` so table-local and joined SQL can use unambiguous names such as:
  - `raw_article_id`
  - `enriched_article_id`
  - `job_run_id`
  - `source_target_id`
  - `tag_id`
- Added stable readable text IDs alongside numeric keys for operator use:
  - `articles_raw.raw_id`
  - `articles_enriched.enriched_id`
  - `job_runs.job_id`
  - `job_run_items.job_item_id`
- Current ID strategy is:
  - numeric table-specific primary key columns remain the relational key
  - readable text IDs are available for inspection, exports, and future API exposure

## 2026-03-15 Latest Snapshot Refresh

- Latest Layer2 snapshot:
  - `raw_total = 966`
  - `raw_processed = 490`
  - `raw_unprocessed = 476`
  - `enriched_total = 490`
  - `enriched_ready_total = 459`
  - `enriched_provisional_total = 31`
- Publication routing snapshot:
  - `full_summary = 317`
  - `source_snippet = 142`
  - `hold = 31`
- Summary input basis snapshot:
  - `full_content = 317`
  - `source_snippet = 168`
  - `title_only = 5`
- Current operational interpretation:
  - full-content publication flow is working
  - snippet-summary publication flow is now also working inside Layer2
  - the next natural task is the web-side publishing view that distinguishes full summaries from snippet-based summaries

## 2026-03-15 Summary Provider Fallback Update

- `generateEnrichedSummary()` now tries providers in this order:
  - `Gemini`
  - `OpenAI gpt-5-mini`
  - `template fallback`
- Reason:
  - current Gemini failures are `429` with `spending cap` wording
  - moving to a lower Gemini model is unlikely to help because it is the same Gemini billing/quota path
- New env knobs:
  - `OPENAI_API_KEY`
  - `OPENAI_SUMMARY_MODEL` (default: `gpt-5-mini`)

## 2026-03-15 OpenAI Fallback Verification Update

- Confirmed `OPENAI_API_KEY` is loaded from local env and `gpt-5-mini` is accepted by the API.
- Initial verification showed the current OpenAI call shape was not sufficient:
  - `responses.create()` returned `status=incomplete`
  - `incomplete_details.reason = max_output_tokens`
  - `output_text = ""`
- Fixed `src/lib/ai/enrich.ts` so OpenAI fallback now uses:
  - `reasoning.effort = minimal`
  - larger `max_output_tokens`
  - explicit empty-output detection
- Re-verified after the patch:
  - direct `responses.create()` with `gpt-5-mini` returned `output_text = "OK"`
  - `generateEnrichedSummary()` returned actual Japanese summaries with `summarySource = openai`
  - confirmed both paths:
    - Gemini present but failing with `429 spending cap` -> OpenAI fallback succeeds
    - Gemini disabled -> OpenAI primary succeeds
- Tightened Layer2 publication routing:
  - when `summarySource = template`, `publication_basis` is forced to `hold`
  - template-generated fallback text is no longer used as publishable summary text
- Validation executed:
  - `npm run type-check`
  - `npm run db:check-layer12`

## 2026-03-15 Primary Key Naming Cleanup

- Added migration `021_rename_primary_key_columns.sql`.
- Renamed generic primary key columns from `id` to table-specific names across the current schema.
- Examples:
  - `articles_raw.id -> raw_article_id`
  - `articles_enriched.id -> enriched_article_id`
  - `source_targets.id -> source_target_id`
  - `job_runs.id -> job_run_id`
  - `tags_master.id -> tag_id`
- Updated current runtime SQL and ops scripts to follow the renamed columns while keeping app-level object shapes stable where practical.
- Verified after migration:
  - `npm run db:migrate`
  - `npm run type-check`
  - `npm run db:check-layer12`
  - `npm run db:check-source-policies`
  - `npm run db:check-domain-policies -- --needs-review`

## 2026-03-15 Stable Text ID Addition

- Added migration `022_add_stable_text_ids.sql`.
- Introduced readable generated text IDs without removing existing primary keys.
- Current added columns:
  - `articles_raw.raw_id`
  - `articles_raw_history.raw_history_id`
  - `articles_enriched.enriched_id`
  - `articles_enriched_history.enriched_history_id`
  - `job_runs.job_id`
  - `job_run_items.job_item_id`
- Format examples:
  - `raw-00000001`
  - `enriched-00000001`
  - `job-00000001`
- Existing data was preserved; values are generated from the current numeric primary keys.
- Validation executed:
  - `npm run db:migrate`
  - `npm run type-check`

## 2026-03-15 Provider Tier + Title Localization Ops Update

- `generateEnrichedSummary()` の provider 順を実コードベースで次に統一した:
  - `GEMINI_API_KEY`
  - `GEMINI_API_KEY2`
  - `OPENAI_API_KEY`
  - `template fallback`
- `summarySource` は `gemini / gemini2 / openai / template` を返す。
- OpenAI 呼び出しは `reasoning.effort=minimal` と `max_output_tokens=320` を固定し、空応答は失敗として次の fallback に回す。
- `daily-enrich` 側では `summarySource=template` のとき `publication_basis=hold` を優先し、snippet publish 条件より強く抑止する形に整理した。
- 運用補助として `npm run db:translate-raw-titles -- <batch>` を追加し、`articles_raw.title` の日本語化をバッチ単位で進められるようにした。
- 既存の Layer2/公開文 remediation は引き続き:
  - `scripts/translate-layer2-english-summaries.mjs`
  - `scripts/update-enriched-titles.mjs`
  - `scripts/update-enriched-titles-from-file.mjs`
  を使う前提。

## 2026-03-15 Raw Title Rollback Direction

- `articles_raw.title` の日本語化運用は誤りだったものとして扱う方針に切り替えた。
- 今後の日本語化対象は `articles_enriched.title` / `summary_100` / `summary_200` / `publication_text` に限定する。
- `articles_raw.title` は source から取った生タイトルを保持する ingestion 用フィールドとみなし、公開品質 remediation の対象から外す。
- 既存の未処理 backlog を今後の enrich 対象から外すため、`npm run db:skip-raw-backlog -- --through-raw-id <raw_article_id>` を追加した。
- このコマンドは該当 raw を削除せず `is_processed=true` と `last_error=skip理由` に更新して、サービス開始後の新規蓄積を優先できるようにする。

## 2026-03-15 Official Source Raw Title Rescue

- 方針を `google-alerts 系は backlog 切り離し`, `official source backlog は可能な限り救済` に整理した。
- `scripts/repair-raw-titles-from-url.mjs` と `npm run db:repair-raw-titles-from-url` を追加した。
- この repair は `fulltext_allowed` source の未処理 raw に限定し、記事 URL から:
  - `og:title`
  - `twitter:title`
  - `h1`
  - `<title>`
  を順に見て `articles_raw.title` を原題へ戻す。
- 実行結果:
  - `openai-news`: `187/187` 件 repair 成功
  - `nvidia-developer-blog`: `10/10` 件 repair 成功
  - `huggingface-blog`: `97/186` 件 repair 成功
- `huggingface-blog` の残りは title 抽出ロジック不足ではなく、取得元の `429` rate limit による未回収。
- repair 後、official source backlog に残っていた古い SQL 失敗 (`could not determine data type of parameter $7`) は stale と判断して `253` 件分クリアした。
- 現在の official source backlog 状態:
  - `openai-news unprocessed=187 / latin-title=187 / with-error=0`
  - `huggingface-blog unprocessed=186 / latin-title=98 / with-error=0`
  - `nvidia-developer-blog unprocessed=10 / latin-title=10 / with-error=0`
- 次の実運用は:
  - `official source` backlog を enrich で消化
  - `google-alerts` backlog は必要なら skip
  - 以後の raw title は source 原題のまま保持

## 2026-03-15 OpenAI-Only Enrich Continuation + AI Input Export

- 中断前の実行結果を確認し、`openai-news` と `nvidia-developer-blog` は backlog をすべて消化済みに到達した。
- 現在の official source 状態:
  - `openai-news = 278/278 enriched`
  - `nvidia-developer-blog = 100/100 enriched`
  - `huggingface-blog = 91/277 enriched`
- 全体 snapshot:
  - `articles_enriched = 687`
  - `enriched_ready_total = 645`
  - `enriched_provisional_total = 37`
- Gemini は `GEMINI_API_KEY` / `GEMINI_API_KEY2` ともに `429 spending cap` で実運用不能のため、追加 enrich は実質 `OpenAI fallback` で進んでいる。
- 処理速度と従量課金を考慮し、残 official backlog は「AI が必要な入力だけファイルへ export -> 手作業 CLI 要約 -> 後で import/register」の方式へ切り替える判断にした。
- `scripts/export-ai-enrich-inputs.ts` と `npm run db:export-ai-enrich-inputs` を追加した。
- `scripts/import-ai-enrich-outputs.ts` と `npm run db:import-ai-enrich-outputs` を追加した。
- 現在の export 済みファイル:
  - `artifacts/ai-enrich-inputs-official-remaining.json`
- 現在の output template:
  - `artifacts/ai-enrich-output-template-official-remaining.json`
- export 対象は現在 `huggingface-blog` の未処理 `186` 件。
- export ファイルには、後段で AI 以外を再計算しなくて済むように次を含める:
  - `title`
  - `content`
  - `summaryInputBasis`
  - `summaryInputText`
  - `summaryBasis`
  - `provisionalBase`
  - `dedupeStatus`
  - `dedupeGroupKey`
  - `matchedTagIds`
  - `candidateTags`
  - `publicationBasisIfSummaryExists`
- export 内訳:
  - `contentPath full = 100`
  - `contentPath snippet = 86`
  - `summaryInputBasis full_content = 100`
  - `summaryInputBasis title_only = 86`
- この方式は実現可能。ただし最終登録は生 SQL 生成より、既存の `upsertEnrichedArticle` / `markRawProcessed` を呼ぶ import スクリプトに寄せた方が安全。
