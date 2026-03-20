# AI Trend Hub 実装ステータス

最終更新: 2026-03-20（content_language 先行導入と日本語ソース追加前提の実行順を追記）

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
15. `hourly-publish` の bulk upsert 化を完了し、`public_articles` published = `2371` まで公開済み
16. migration 033（pgvector + `articles_enriched_sources` + `public_article_sources` 拡張）を適用した
17. migration 034（`commercial_use_policy`）を適用し、ToS 調査済みドメインを初期投入した
18. `/api/home` を `{ random, latest, unique, lanes, stats, activity }` 形式へ更新した
19. Home / digest / saved / liked / `/api/articles/[id]` を追加し、ArticleCard の 200 字モーダルと共有 UI を更新した
20. Neon 向け `pg_dump` バックアップ基盤を追加した
21. GitHub Actions に日次 DB バックアップ workflow を追加した（artifact 保持 7 日）

## 2026-03-20 バックアップ運用追加

1. Neon 公式 docs に従い、`DATABASE_URL_UNPOOLED` を使う `pg_dump` ベースのバックアップ運用へ寄せた
2. `scripts/backup-neon-all.mjs` を追加し、非 template DB を列挙して全 DB を dump できるようにした
3. `.github/workflows/daily-db-backup.yml` を追加し、毎日 18:15 UTC に backup を実行する
4. GitHub Actions artifact は `retention-days: 7` とし、1 週間で自動削除する
5. 初回手動バックアップを `backups/manual-2026-03-20/` に取得済み
6. `artifacts/` はバックアップ成功後に削除対象とする

## 2026-03-20 時点の次着手

次は `Phase 3` の管理画面基盤ではなく、**`content_language` の先行導入**から着手する。

理由:

1. 日本語ソース 14 件追加の直前依存だから
2. JP/EN 混在後の表示制御を先に揃える必要があるから
3. 既存 L4 2371 件は backfill で整合を取れ、手戻りが小さいから

## 次タスクの分解（20 個）

### A. `content_language` 導入

1. migration 035 で `source_targets` / `articles_enriched` / `public_articles` に `content_language` を追加する
2. backfill SQL または専用スクリプトを用意し、既存 L2 / L4 を一括更新できる状態にする
3. `source_targets.content_language` を SSOT として既存ソースを `ja / en` に分類する
4. enrich で `source_targets -> articles_enriched` の言語伝搬を実装する
5. publish で `articles_enriched -> public_articles` の言語伝搬を実装する
6. 公開 API / 型定義 / 取得 query に `content_language` を通す
7. `ArticleCard` に `JP / EN` バッジを追加する
8. backfill 後の件数検証を行い、例外ソースがあれば `imp-hangover.md` へ残す

### B. 日本語ソース追加

9. `imp-hangover.md 13.4` の日本語ソース候補 14 件を seed に追加する
10. 各ソースの `commercial_use_policy` / `content_language` / `is_active` 初期値を確認する
11. feed 妥当性、URL 正規化、重複混入リスクを確認する
12. 日本語ソース追加後の fetch / enrich / publish を通す
13. Home / category / tags / detail で混在表示を確認する

### C. 公開面調整

14. 言語軸の将来フィルタ要否を整理し、未実装なら docs に明記する
15. search / ranking / digest への `content_language` 受け口を揃える
16. Home の見せ方や lane 件数の必要調整を行う

### D. 管理画面 Phase 3

17. 管理画面基盤（`ADMIN_PATH_PREFIX` + `ADMIN_SECRET`）を実装する
18. `priority_processing_queue` の `hide_article` 最小実装を入れる
19. タグレビュー UI と `source_targets.is_active` ON/OFF を追加する

### E. ランキング調整

20. `activity_logs.action_type` 正式化、`compute-ranks` 再実行、結果監査を行う

## いま残っている主要タスク

現フェイズ: **言語軸導入 → 日本語ソース追加 → Phase 3 管理機能**

1. `content_language` の migration 035 / backfill / L2-L4 伝搬
2. 日本語ソース 14 件の seed 追加
3. `ArticleCard` の `JP / EN` バッジ表示
4. 管理画面基盤（`ADMIN_PATH_PREFIX` + `ADMIN_SECRET`）
5. `priority_processing_queue` 最小実装（`hide_article` のみ）
6. タグレビュー UI
7. `source_targets.is_active` ON/OFF スイッチ
8. `activity_logs.action_type` 正式化
9. `compute-ranks` 係数調整と再実行
10. 日本語ソース投入後の分布監査と検索・ランキング影響確認

## 再開時の推奨確認順

1. `docs/imp/imp-hangover.md`（現状スナップショット・次タスク）
2. `docs/imp/implementation-wait.md`（判断待ち論点）
3. `docs/imp/implementation-plan.md`（現フェイズ方針）
4. `docs/spec/11-batch-job-design.md`（ジョブ仕様）
5. `docs/spec/05-ingestion-and-ai-pipeline.md`（全体フロー）

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

## 2026-03-16 サイクルテスト + manual recovery 更新

- 2026-03-16 05:18 JST から小さい固定条件でジョブ経路を再検証した。
- 実行内容:
  - `hourly-fetch limit=1`
  - `daily-enrich limit=2 sourceKey=google-alerts-ai-agents-coding-agents summaryBatchSize=10`
  - provider 全停止の `daily-enrich limit=1`
  - `manual_pending` 1 件 import
  - `hourly-layer12 fetchLimit=1 enrichBatchSize=1 maxEnrichBatches=1 summaryBatchSize=10`
- 観測結果:
  - `hourly-fetch limit=1` は今回も `anthropic-news` で `Status code 404`
  - 通常 `daily-enrich` 2 件は Gemini primary=`403 leaked key`, Gemini secondary=`429 spending cap` の後に OpenAI fallback で処理成功
  - provider 全停止の `daily-enrich` 1 件は `manualPendingCount=1`、artifact=`artifacts/manual-pending/ai-enrich-inputs-manual-pending-google-alerts-ai-agents-coding-agents-job-77-2026-03-15T20-18-58-091Z.json`
  - reviewed output import 1 件が成功し、`raw_article_id=880` は `ai_processing_state=completed` に戻った
  - `hourly-layer12` の totals は `attempted=1 / processed=1 / failed=0 / manualPending=0 / completedBatches=1`
- この検証中に `scripts/import-ai-enrich-outputs.ts` の実バグを発見して修正した。
  - 現象: export 側 input JSON の `rawArticleId` が文字列化されると、output JSON 側の数値 `rawArticleId` と突合できず `Missing output items` で import 失敗する
  - 対応: input/output 両方の `rawArticleId` を正の整数へ正規化してから突合・upsert するように変更
- 最新スナップショット (`npm run db:check-layer12` at 2026-03-16 05:22 JST):
  - `raw_total = 966`
  - `raw_processed = 877`
  - `raw_unprocessed = 89`
  - `enriched_total = 877`
  - `enriched_ready_total = 750`
  - `enriched_provisional_total = 127`
  - `publication_basis full_summary = 608 / source_snippet = 142 / hold = 127`
  - `summary_input_basis full_content = 608 / source_snippet = 172 / title_only = 97`

## 2026-03-17 ソース fetch 実行・URL修正・状況確定

- `source-targets.ts` の `listDueSourceTargets()` に `'api'` を追加（fetch_kind='api' が除外されていたバグ修正）
- `hourly-fetch` を実行し新規ソースから **1,858件** を articles_raw に投入
- URL 修正:
  - `simonwillison-blog`: `rss/` → `atom/everything/` に修正（30件取得成功）
  - `paperswithcode`: API→RSS 切り替えもXML不正エラー → `is_active=false`
  - `huggingface-papers`: 公式 RSS なし → `is_active=false`
  - `mistral-ai-news`: RSS 非提供 → `is_active=false`
  - `ledge-ai`: feed URL 不明 → `is_active=false`
- `scripts/run-hourly-fetch.ts` を新規作成（CLI 直接実行用）
- 現在のアクティブソース構成（Google Alerts 除く）:
  - official: 11（1,902件 raw）
  - blog: 9（172件 raw）
  - paper: 1 arXiv のみ（437件 raw）
  - news: 2（17件 raw）
- 未解決ソース: `anthropic-news`（404継続）、`google-ai-blog`（parse error継続）
- 次のステップ: 新規 raw 記事の enrich → hourly-publish で Layer 4 更新

## 2026-03-17 hourly-publish 実装・Layer 4 転送完了

- `src/lib/jobs/hourly-publish.ts` を新規実装
  - articles_enriched WHERE publish_candidate=true AND dedupe_status='unique' を取得
  - nanoid(11) で YouTube 風 public_key を生成（既存行は再利用）
  - public_articles / public_article_sources / public_article_tags に UPSERT
  - publish_candidate=false になった記事を visibility_status='hidden' に更新
  - job_runs / job_run_items に記録
- `src/app/api/cron/hourly-publish/route.ts` を新規作成
- `.github/workflows/hourly-publish.yml` を新規作成（毎時 :35 実行）
- `scripts/run-hourly-publish.ts` を新規作成（CLI 直接実行用）
- `package.json` に `db:run-hourly-publish` スクリプト追加
- 動作確認結果（2回実行）:
  - processed=745 / success=745 / failed=0 / tagsUpdated=1638 / hidden=0
- 現在の Layer 4 状態:
  - `public_articles` published=745件
  - official/llm: 最多（タグ付き 600件）
  - alerts 系: llm/agent/search/safety/policy/voice 計 145件
- 確認済み: `npm run type-check` エラーなし

## 2026-03-17 新規ソース追加・カスタムコレクター実装

- 新規コレクター実装:
  - `src/lib/collectors/paperswithcode.ts` — Papers with Code API（JSON）
  - `src/lib/collectors/hackernews.ts` — Hacker News API（keyword filter）+ DB から tag_keywords を動的ロード
  - `src/lib/collectors/api.ts` — fetchKind='api' の dispatcher（sourceKey パターンで振り分け）
  - `src/lib/collectors/index.ts` に `api: apiCollector` を登録
- `scripts/seed.mjs` に 20 ソースを追加（合計 37 ソース）:
  - **paper**: huggingface-papers, arxiv-ai（arXiv RSS）, paperswithcode
  - **blog**: zenn-ai, reddit-machinelearning, reddit-localllama, devto-ai, hackernews-ai, simonwillison-blog, the-gradient, last-week-in-ai, towards-data-science
  - **news**: venturebeat-ai, mit-technology-review-ai, ledge-ai
  - **official**: bair-blog, langchain-blog, mistral-ai-news, deepmind-research-blog
- officialDomains に 8 ドメインを追加（arxiv.org, simonwillison.net, thegradient.pub, bair.berkeley.edu, blog.langchain.com, mistral.ai, deepmind.google, paperswithcode.com）
- DB 状態（source_targets / is_active=true）:
  - official: 12（fulltext_allowed）
  - alerts: 9（feed_only）
  - blog: 9（fulltext 2 / feed_only 7）
  - paper: 3（fulltext_allowed 3）
  - news: 3（feed_only）
- 確認済み: `npm run type-check` エラーなし、`db:seed` 正常完了

## 2026-03-16 daily-enrich タグマッチ改修・L2 バックフィル

- `daily-enrich` のタグマッチング戦略を変更した:
  - 旧: 準備フェーズで `matchTags()`（tag_key/alias）を使い full content に照合
  - 新: 準備フェーズは `candidateTags` 抽出のみ。バッチフェーズで AI summary 生成後に `matchTagsFromKeywords()` を使い **title + summary_200（〜250字）** に照合
  - 効果: 高速化（full content vs 250字）＋ Tier 2 タグ（claude, chatgpt 等）の自動付与
- `src/lib/db/tags.ts` に `listCollectionTagKeywords()` 追加
- `src/lib/tags/match.ts` に `TagKeywordReference` 型と `matchTagsFromKeywords()` 追加
- `src/lib/jobs/daily-enrich.ts` を改修（summary 生成後にキーワードマッチ、source_category を Tier 1 タグとして自動付与）
- `scripts/backfill-article-tags.mjs` を新規作成
  - 既存 L2 記事（publish_candidate=true）に tag_keywords ベースのタグを一括付与
  - AI 再呼び出し不要（キーワードマッチのみ）
  - `tags_master.article_count` も更新
- `package.json` に `db:backfill-article-tags` スクリプト追加
- 確認済み: `npm run type-check` エラーなし

## 2026-03-16 tag_keywords・generative-ai タグ・source_type paper 追加

- migration 029: source_type CHECK 制約に `paper` を追加（source_targets / articles_enriched / public_articles）
- migration 030: `tag_keywords` テーブルを新規作成
  - タグマスタと収集フィルタ・Web 検索を繋ぐ統合キーワードマスタ
  - `use_for_collection`: HN 等の収集フィルタに使うか
  - `use_for_search`: Web 検索サジェストに使うか
  - 1 キーワードが複数タグに重複登録可能
- `tags_master` に `generative-ai`（Generative AI）タグを追加
- `scripts/seed-keywords.mjs` を新規作成し、142 件のキーワードを投入
  - llm(38), coding-ai(17), generative-ai(17), rag(12), agent(12), safety(10), voice-ai(10), policy(9), nvidia(9), google-ai(8)
- `package.json` に `db:seed-keywords` スクリプトを追加
- `tag_aliases`（表記ゆれ正規化）と `tag_keywords`（検索・収集語）は別テーブルとして明確に分離
- HN コレクター実装時は `tag_keywords WHERE use_for_collection=true` からキーワードを動的ロードする

## 2026-03-16 source_type・critique・mock3 テーブル整理

- mock3 暫定実装テーブルを DB から確認・整理した。
- 発見:
  - `articles` / `feeds` / `topic_groups` / `rank_scores` / `source_items` は mock3 残骸（fake データのみ）
  - `action_logs`（パーティション付き）は実クリックデータ 16 件あり → 継続使用
  - `articles.source_type`（official/blog/news）と `critique`（批評）が現行 Layer 2 に不足していた
- 実施した変更:
  - migration 026: `source_targets` / `articles_enriched` / `articles_enriched_history` / `public_articles` に `source_type` 追加・バックフィル
  - migration 027: `articles_enriched` / `articles_enriched_history` / `public_articles` に `critique` を拡張カラムとして追加（全 NULL、将来 full_content 記事に付与予定）
  - migration 028: mock3 テーブル（articles/feeds/topic_groups/rank_scores/source_items）を DROP
  - `src/lib/db/enrichment.ts`: `RawArticleForEnrichment` / `UpsertEnrichedInput` に `sourceType` 追加、SELECT / INSERT / UPDATE に反映
  - `src/lib/jobs/daily-enrich.ts`: `sourceType` を upsert 呼び出しに追加
  - `scripts/import-ai-enrich-outputs.ts`: `sourceType` optional 対応（`?? 'news'` フォールバック）
  - `scripts/seed.mjs`: 全 source に `sourceType` 追加、INSERT SQL に `source_type` 列追加
  - `docs/spec/04-data-model-and-sql.md`: `source_targets` / `articles_enriched` / `public_articles` のカラムリスト更新
- DB の現在状態（migration 028 適用後のテーブル一覧）:
  - articles_raw / articles_enriched / articles_enriched_history / articles_enriched_tags
  - public_articles / public_article_sources / public_article_tags / public_rankings
  - source_targets / source_priority_rules / observed_article_domains
  - tags_master / tag_aliases / tag_candidate_pool
  - job_runs / job_run_items / migration_history
  - activity_logs（パーティション）/ activity_metrics_hourly / admin_operation_logs
  - priority_processing_queue / push_subscriptions / digest_logs
- 確認済み: `npm run type-check` エラーなし

## 2026-03-16 Layer 4 設計・dim2_memo 差分解消

- `docs/dim2_memo/` 配下（Layer 3/4 の別セッション設計）と現行 spec を照合し、差分を解消した。
- 主な発見:
  - `source_category` はトピック分類（llm/agent/voice/policy/safety/search）であり dim2_memo の display-layout 分類とは別軸
  - `articles_enriched.score` は 0〜100 整数として既に実装済み（dim2_memo 想定の 0.0〜1.0 とスケール違い）
  - `thumbnail_url` は DB 列は存在するが常に NULL（OGP は `/api/og` 動的生成で対応）
  - `source_meta` は RSS 基本情報のみ（star 数・著者・likes は未実装ソースの話）
- 実施した変更:
  - migration 024: `articles_enriched` + `articles_enriched_history` に `source_category` 追加 + バックフィル
  - migration 025: `public_articles` に `source_category` / `summary_input_basis` / `publication_basis` / `content_score` を追加
  - `src/lib/db/enrichment.ts`: `UpsertEnrichedInput` に `sourceCategory` 追加、INSERT/UPDATE に反映
  - `src/lib/jobs/daily-enrich.ts`: `upsertEnrichedArticle()` 呼び出しに `sourceCategory` 追加、`ManualPendingExportItem` 型を更新
  - `scripts/import-ai-enrich-outputs.ts`: `sourceCategory` optional 対応（既存 JSON との後方互換を保持）
  - `docs/spec/04-data-model-and-sql.md`: `articles_enriched` / `public_articles` のカラムリストと設計方針を更新
  - `docs/imp/implementation-plan.md`: Section 9 に Layer 4 設計方針を追記
- 確認が必要:
  - `npm run type-check`
  - `npm run db:migrate`（migration 024/025 を適用）
  - `npm run db:check-layer12`（source_category が enriched に入っているか確認）
- 次: `hourly-publish` 実装（`articles_enriched` → `public_articles` upsert スクリプト）

## 2026-03-16 履歴スクラブ更新

- `git filter-repo` を使って履歴中の `.env.example` 機密値をスクラブした。
- 除去対象:
  - 旧 `GEMINI_API_KEY`
  - Neon の pooled / unpooled 接続文字列
  - 上記に含まれていた DB password
- rewrite 後は `git log -S "<旧Geminiキー>" --all` と `git log -S "<旧DB password>" --all` が空になることを確認した。
- `git filter-repo` 実行により `origin` remote は一度外れたため、同じ GitHub URL を再登録済み。
- 次の実運用手順:
  - `git push --force-with-lease origin main`
  - 旧履歴を参照している clone / CI cache があれば取り直す

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

## 2026-03-17 L3/L4 公開面切替・source 再開テスト

- L3/L4 の公開経路を実コードに反映した。
  - `src/app/api/home/route.ts` を追加し、Home 初期表示を `public_articles` / `public_rankings` / `activity_metrics_hourly` から返すようにした
  - `src/app/api/trends/route.ts` と `src/app/api/search/route.ts` を `public_articles` ベースへ切り替えた
  - `src/app/page.tsx` のモック記事前提を外し、`/api/home` を使う実データ読込へ変更した
  - `src/components/sidebar/RightSidebar.tsx` の「リアルタイム活動」を `activity_metrics_hourly` の実数表示に差し替えた
- L3 記録を有効化した。
  - `src/app/api/actions/route.ts` は `activity_logs` へ記録しつつ、`activity_metrics_hourly` を hour bucket で upsert 更新するようにした
  - 暫定マッピング:
    - `view -> impression_count`
    - `expand_200 / topic_group_open / digest_click -> open_count`
    - `article_open -> source_open_count`
    - `share_* -> share_count`
    - `save -> save_count`
- L4 ランキング系を `public_rankings` ベースに実装した。
  - `src/lib/ranking/compute.ts` を `content_score + activity` と時間減衰の式へ差し替えた
  - `src/app/api/cron/compute-ranks/route.ts` は `activity_metrics_hourly` と `public_articles` から `public_rankings` を再計算する
  - `src/app/api/cron/send-digest/route.ts` は `public_rankings` / `public_articles` を読むようにした
- source 単位の再開テスト用に CLI を拡張した。
  - `src/lib/db/source-targets.ts` / `src/lib/jobs/hourly-fetch.ts` / `scripts/run-hourly-fetch.ts` に `sourceKey` 指定を追加
  - `scripts/run-daily-enrich.ts` と `npm run db:run-daily-enrich` を追加した
- Gemini 429 対策を強化した。
  - 要約は既存どおり batch 前提（最大 10 件）
  - `src/lib/ai/enrich.ts` に `GEMINI_SUMMARY_MODEL` 環境変数対応を追加
  - `ENRICH_SUMMARY_BATCH_PAUSE_MS` で batch 間 pause を入れられるようにした
  - 同一 process 内で Gemini が `429 / spending cap` を返した場合、その run 中は同 provider を再度叩かない簡易サーキットブレーカを追加した
- 実行確認:
  - `npm run type-check` OK
  - `npx tsx scripts/run-hourly-fetch.ts --source-key arxiv-ai --limit 1`
    - `inserted=0 / skipped=437`
  - `npx tsx scripts/run-hourly-fetch.ts --source-key hackernews-ai --limit 1`
    - `inserted=4 / skipped=4`
  - `npx tsx scripts/run-daily-enrich.ts --source-key hackernews-ai --limit 4 --summary-batch-size 4`
    - `processed=4 / failed=0 / manualPending=0`
    - 4 件とも `snippet + feed_only_policy`
    - Gemini primary / secondary は `429 spending cap`、OpenAI fallback で完走
- 現状の解釈:
  - 新規 source の targeted fetch / enrich 再開は可能
  - L3/L4 の公開面は `public_articles` 系へ揃い、旧 `articles` / `rank_scores` 依存は今回の主要経路から外れた
  - なお `priority_processing_queue` の完全運用と `activity_logs.action_type` の正式一覧は未確定のため `implementation-wait.md` に残す

## 2026-03-17 Gemini 100件試験 + backlog 1882件 manual export

- Gemini の有料 key / Tier1 前提で、`daily-enrich` に call 数上限を持たせる方向へ寄せた。
  - `src/lib/jobs/daily-enrich.ts` に `maxSummaryBatches` を追加
  - `src/app/api/cron/daily-enrich/route.ts` と `scripts/run-daily-enrich.ts` から指定可能にした
- Gemini 稼働確認として、`10 batch x 10件 = 100件` を先行実施した。
  - 実行:
    - `ENRICH_SUMMARY_BATCH_PAUSE_MS=1500`
    - `npx tsx scripts/run-daily-enrich.ts --limit 100 --summary-batch-size 10 --max-summary-batches 10`
  - 結果:
    - `processed=100 / failed=0 / manualPending=0`
    - この run では Gemini `429` は再現しなかった
    - 最新診断は `feed_only_policy=96`, `extracted=3`, `extracted_below_threshold=1`
- backlog は `raw_unprocessed=1882` まで減少した。
  - `raw_total=2863`
  - `raw_processed=981`
  - `enriched_total=981`
  - `enriched_ready_total=759`
  - `enriched_provisional_total=222`
- 残り 1882 件は、手動投入前提の `artifacts` export へ切り替えた。
  - 既存 `scripts/export-ai-enrich-inputs.ts` は full content 解決まで行うため 1882 件一括では重すぎた
  - 手動 backlog 用に `--export-mode seed_only` を追加し、snippet/title ベースの要約タネだけを高速 export できるようにした
  - 実行:
    - `npx tsx scripts/export-ai-enrich-inputs.ts --limit 1882 --policy all --export-mode seed_only --output artifacts/ai-enrich-inputs-backlog-1882.json`
    - `npx tsx scripts/import-ai-enrich-outputs.ts --input artifacts/ai-enrich-inputs-backlog-1882.json --write-template-only --template-output artifacts/ai-enrich-output-template-backlog-1882.json`
  - 生成物:
    - `artifacts/ai-enrich-inputs-backlog-1882.json`
    - `artifacts/ai-enrich-output-template-backlog-1882.json`
    - 分割版:
      - `artifacts/ai-enrich-inputs-backlog-1882-part1.json` 〜 `part8.json`
      - `artifacts/ai-enrich-output-template-backlog-1882-part1.json` 〜 `part8.json`
- 現時点の運用判断:
  - Gemini は `100件 / 10 call` 程度なら再試験可能
  - backlog 全件は Gemini に直接流さず、manual artifact flow を使う
- manual output import 後に `hourly-publish` を回せば L4 側へ反映できる

## 2026-03-18 backlog 1882件 import・title補正・L2/L4分類再同期

- `artifacts` は Git 管理対象から外した。
  - `.gitignore` に `artifacts/` を追加
  - `git rm --cached -r -- artifacts` 実施
- backlog `1882` 件を Neon に登録済み。
  - `articles_enriched = 1882/1882`
  - `ai_processing_state='completed' = 1882/1882`
  - `articles_raw.is_processed=true = 1882/1882`
- backlog import 用に importer を軽量化した。
  - `src/lib/db/enrichment.ts`
    - `refreshTagArticleCounts()` を export
    - `upsertEnrichedArticle(..., { refreshTagCounts: false })` に対応
  - `scripts/import-ai-enrich-outputs.ts`
    - `loadEnvConfig(process.cwd())` を追加
    - tag count を各記事ごとではなく最後に 1 回だけ更新
    - `--skip-existing` オプション追加
- backlog 分の title 日本語化漏れを確認し、`13` 件を補正した。
  - `docs/imp/sql/2026-03-18-l2-l4-data-realign.sql` に補正 SQL を保存
  - backlog `1882` 件に限ると title 漏れは `0`
  - ただし `articles_enriched` 全体では旧データ由来の非日本語 title が `211` 件残る
- `source_targets` を正として `articles_enriched.source_type` を再同期した。
  - 修正件数: `1866`
  - 修正後の不一致件数: `0`
- 2026-03-18 時点の L2 分布:
  - `official = 1902`
  - `paper = 437`
  - `alerts = 328`
  - `blog = 176`
  - `news = 18`
- 現行 Web 設計とのズレを確認した。
  - `src/app/page.tsx` / `RightSidebar.tsx` は `source_type` と `source_category` を混在利用
  - `paper / news / alerts` がカテゴリ UI から落ちている
  - `dim2_memo` の 5 分類は DB 既存カラムではなく表示分類の参考草案として扱うべきと整理
- `hourly-publish` を再実行して L4 反映を進めたが、現行実装は遅く長時間化したため停止した。
  - `job_run_id=93` を `failed` で明示終了
  - 停止前に `public_articles` published は `745 -> 911` へ増加
  - `official = 736`, `alerts = 145`, `blog = 30`
- `implementation-plan.md` を「実装履歴メモ」から「L2 -> L4 要件定義を兼ねた前向きな計画」へ更新した。
- `implementation-wait.md` に次を追加した。
  - Home のトップレベル分類方針
  - `paper / news / alerts` の公開優先度
  - 残 `211` 件の title 補正タイミング
  - `hourly-publish` 高速化方式

## 2026-03-18 非日本語 title 全件補正・抜き取り品質監査

- `articles_enriched.title` の非日本語行 `211` 件を OpenAI API で一括翻訳し、Neon へ反映した。
  - 出力保存先: `artifacts/title-translations-non-ja-20260318.json`
  - `public_articles.display_title` も同時同期
  - 最終結果:
    - `articles_enriched` 非日本語 title = `0`
    - `public_articles` 非日本語 title = `0`
- 公開候補の `articles_enriched` からランダム `10` 件を抜き取り監査した。
  - 良好:
    - official の full_content 系記事は概ね掲載可能
    - title / source_type / publication_basis / canonical_url は大きな破綻なし
  - 問題あり:
    - `summary_100` / `summary_200` / `publication_text` の途中切れ
    - `source_snippet` 記事で title と summary の内容ずれ
    - `paper` 記事で tag が本文内容と噛み合わない例
    - 一部 summary が本文要約ではなく metadata 紹介に寄る
- 補助確認:
  - `summary_100` 長さ `100+` = `398`
  - `summary_200` 長さ `200+` = `1016`
  - `publication_basis='source_snippet'` = `294`
  - `summary_input_basis='source_snippet'` = `415`
- 結論:
  - title の日本語化は完了
  - ただし **L2 データ品質はまだ「Web 全面公開で安全」とは言えない**
  - 次段は `hourly-publish` 高速化と並行して、summary 整形・snippet 品質 gate・タグ精度改善が必要

## 2026-03-18 snippet 整合強化・paper タグ制限・絵文字サムネイル

- `source_snippet` / `title_only` 向け要約 prompt を強化した。
  - `src/lib/ai/prompts/enrich-batch-ja.ts`
  - `summaryInputBasis` を prompt に渡し、snippet 由来の要約では入力にない会社名・数値・出来事を補わないよう制約追加
- `daily-enrich` に snippet 整合チェックを追加した。
  - `src/lib/jobs/daily-enrich.ts`
  - `summary_input_basis='source_snippet'` のとき、入力 title/snippet の ASCII シグナル語が summary に全く現れない行は `publication_basis='hold'` へ寄せる
- 論文ソースのタグ方針を変更した。
  - migration `032_add_paper_tag.sql` で `paper` タグを追加
  - `scripts/seed-keywords.mjs` に `paper` タグを追加
  - `daily-enrich` / `backfill-article-tags.mjs` は `source_type='paper'` のとき `paper` タグだけを付与するよう変更
  - 既存 DB も backfill し、`source_type='paper'` の `437` 件は現在すべて `paper` タグのみ
- 暫定サムネイル絵文字を追加した。
  - migration `031_add_thumbnail_emoji_to_public_articles.sql`
  - `src/lib/publish/thumbnail-emoji.ts` を追加
  - `hourly-publish` は `thumbnail_url` が空でも `thumbnail_emoji` を L4 転送時に付与
  - `ArticleCard` は画像が無い場合に絵文字を表示
  - 既存 `public_articles 911` 件にも backfill 済み
- 確認済み:
  - `npm run type-check` OK
  - `public_articles.thumbnail_emoji` 分布:
    - `🧠=691`
    - `🤖=186`
    - `🛡️=12`
    - `🎙️=6`
    - `🔬=6`

## 2026-03-18 L4 公開ページ群と mock4 反映

- 公開ページ群を追加した。
  - `src/app/ranking/page.tsx`
  - `src/app/search/page.tsx`
  - `src/app/articles/[publicKey]/page.tsx`
  - `src/app/category/[slug]/page.tsx`
  - `src/app/tags/page.tsx`
  - `src/app/tags/[tagKey]/page.tsx`
  - `src/app/about/page.tsx`
  - `src/app/feed/page.tsx`
  - `src/app/feed/route.ts`
- 公開ページはすべて Layer4 だけを読む形に揃えた。
  - detail は `public_articles + public_article_tags + public_article_sources`
  - ranking / search / category / tags は `public-feed.ts` 経由
- Home を L2/L4 設計に寄せて更新した。
  - 右サイドバーを `source_type` ベースの lane UI へ変更
  - `paper / alerts / news` を Home 導線へ追加
  - topic chips と source lane を分離
  - カードは `thumbnail_emoji` 前提に統一
- `mock4` を追加した。
  - `l3-l4-screen-flow.md` の Home / Ranking / Search / Detail / Category / Tag / About / Feed / PWA / Share / Topic Group を一通り確認可能
  - live API が使えるときは `/api/home` / `/api/search` を読む
  - DB 未接続時は fixture に自動フォールバックする
- `public-feed.ts` を拡張した。
  - tag 一覧 / tag 詳細 / detail / feed 用 query を追加
  - 一覧系 query から `public_key` を返し、公開 URL を `/articles/:public_key` に寄せた
- 確認済み:
  - `npm run type-check` OK
