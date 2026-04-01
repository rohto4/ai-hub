# 2026-04-02 Batch Reform Spec

最終更新: 2026-04-02

## 0. 目的

- 各定時バッチについて、「どこが弱いか」「何を追加したいか」「どう実装するとよいか」を仕様レベルまで具体化する。
- 実装タスク化の前段として使うため、コード変更案・入力・出力・監視観点まで含める。
- ここでは schedule 復旧後に残る改善論点を整理し、必要なものを `docs/imp/` へ分配する。

## 1. 共通でまず直したい前提

### 1.1 起動経路の一本化

- GitHub Actions schedule は復旧済みで、現状の起動経路はこれを正とする。
- 今後の論点は「schedule を足すか」ではなく、「route / workflow / docs の命名と責務をどこまで揃えるか」へ移る。
- 外部 scheduler へ切り替える判断が出るまでは、`docs/spec/11-batch-job-design.md` と `docs/imp/*.md` も GitHub Actions 基準で維持する。

### 1.2 ジョブ監視の粒度統一

- `job_runs` はあるが、段階別 failure が粗く、再実行判断に必要な情報が不足している。
- 各ジョブで `metadata` に「抽出件数 / 成功件数 / fallback件数 / skip理由 / 後処理件数」を統一して残す。
- 追加で `job_run_items` を source / article / batch chunk 単位に揃えると、障害切り分けがかなり速くなる。

### 1.3 定時本線と追いつき線の副作用差をなくす

- `enrich-worker` 本線と `prepare-gemini-cli-enrich-artifacts.ts -> import-ai-enrich-outputs.ts` 追いつき線で、タグ候補や adjacent theme 反映がずれている。
- 今後は「同じ article が通ったら、どの入口でも同じ L2/L4 になる」を原則にする。
- 実装としては `persistEnrichedResult()` のような共通保存関数へ副作用を寄せ、CLI import もそこを通す。

## 2. 定時バッチ別の改善仕様

### 2.1 `hourly-fetch`

現状の弱い点:
- `hourly-layer12.yml` という名前の workflow が、実際には `/api/cron/hourly-fetch` しか叩いていない。
- source ごとの `Promise.allSettled` はあるが、失敗原因別の backoff がなく、3連続失敗で inactive は荒い。
- `limit=20` は source 数に対する上限であり、source ごとの fetch budget ではない。

追加したい処理:
- source 単位の backoff 制御。
- 失敗理由の分類 (`timeout` / `429` / `feed_parse` / `persistent_404`)。
- source ごとの fetch budget と urgent source 優先枠。

実装イメージ:
- `source_targets` に `failure_backoff_until`, `last_failure_kind`, `fetch_budget_per_run`, `priority_weight` を追加する。
- `listDueSourceTargets()` は `next_fetch_at <= now()` だけでなく、`failure_backoff_until IS NULL OR <= now()` を条件にする。
- `setSourceTargetActive(false)` は即無効化ではなく、`persistent_404` のような恒久障害だけに限定し、それ以外は backoff 延長で止める。
- `job_run_items.detail` に `collected`, `inserted`, `updated`, `skipped`, `failed`, `failureKind` を残す。

追加したいフォローバッチ:
- `source-reactivate`。inactive source を手動復旧し、エラーカウンタを初期化する。
- `fetch-backfill-by-source`。単一 source を複数回連続実行して backlog を吸う。

### 2.2 `hourly-enrich` / `enrich-worker`

現状の弱い点:
- 定時本線と CLI import 線で `tag_candidate_pool`, `articles_enriched_adjacent_tags`, `thumbnail_bg_theme` の副作用が一致しない。
- `manual_pending` は export されるが、再投入から後処理までの一本化手順がない。
- 実行単位は 20 件だが、provider 切替や fallback 発生率をジョブ単位で追いにくい。

追加したい処理:
- import 線でも `properNounTags` と adjacent/theme を同じ保存ロジックで反映する。
- `manual_pending` 再投入の標準フロー追加。
- provider 別利用状況、batch fallback 回数、本文取得成功率の監視追加。

実装イメージ:
- `src/lib/enrich/persist-enriched.ts` に「AI 出力を DB へ反映する純粋な共通関数」を切り出し、route と CLI import の両方から使う。
- `scripts/import-ai-enrich-outputs.ts` では `adjacentTagIds: []` 固定をやめ、`title + summary_200` から `matchAdjacentTagsFromKeywords()` を再実行する。
- 同時に `properNounTags` を `tag_candidate_pool` へ upsert する。
- `job_runs.metadata` に `providerPrimarySuccess`, `providerFallbackSuccess`, `manualPendingCount`, `fullContentRate`, `adjacentAssignedRate` を残す。

追加したいフォローバッチ:
- `run-manual-pending-recovery.ts`。manual pending import と retag をまとめる。
- `re-enrich-by-source-key`。source 単位で L1→L2 を再整形する。

### 2.3 `hourly-publish`

現状の弱い点:
- publish 自体は chunk fallback があるが、`public_article_sources` / `public_article_tags` / `public_article_adjacent_tags` のどこが失敗したか見えにくい。
- `hideUnpublishedPublicArticles()` は最後に一括で走るため、publish 本体失敗時との相関が追いにくい。
- rank refresh と workflow 上で直列結合されているため、publish 成功 / rank 失敗の運用切り分けが弱い。

追加したい処理:
- publish を段階別メトリクスで記録する。
- source / tag / adjacent tag の再同期だけを回せる補修線を追加する。
- rank refresh を workflow 上も独立ジョブとして持てるようにする。

実装イメージ:
- `bulkPublishBatch()` の戻り値を `upsertedArticles`, `syncedSources`, `syncedPrimaryTags`, `syncedAdjacentTags` に分割する。
- `recordJobRunItem()` を chunk 単位でも書き、失敗 chunk の `enriched_article_id` 範囲を残す。
- `scripts/run-hourly-publish.ts` に `--articles-only`, `--sources-only`, `--tags-only`, `--adjacent-only` を追加して部分補修できるようにする。

追加したいフォローバッチ:
- `publish-repair`。部分同期用。
- `publish-preview`。L2 candidate 数と dedupe 後見込み件数だけ出す dry-run。

### 2.4 `hourly-compute-ranks`

現状の弱い点:
- route 実装のみで、CLI から安全に単独再実行する入口がない。
- 全公開記事 × 4 window を毎回全件再計算するため、活動ゼロ時間帯でも固定コストがかかる。
- 係数チューニングを検証する比較モードがない。

追加したい処理:
- `windows` 指定、`articleIds` 指定、`dry-run` 指定。
- 活動ゼロ時は差分スキップする軽量モード。
- 係数セットを複数渡して結果比較する検証モード。

実装イメージ:
- `src/lib/ranking/compute.ts` に `computeScoreWithProfile(profileName)` を導入し、`default`, `freshness_heavy`, `engagement_heavy` を切り替え可能にする。
- `scripts/run-hourly-compute-ranks.ts` を追加し、`--window 24h --article-id ... --profile default` のように呼べるようにする。
- route 側も `?windows=24h,7d&profile=default&dryRun=1` を受け、DB upsert せず JSON 返却できるようにする。

追加したいフォローバッチ:
- `db:run-hourly-compute-ranks`
- `db:compare-ranking-profiles`

### 2.5 `daily-tag-dedup`

現状の弱い点:
- batch 単位で Gemini 失敗すると、その batch 全件が `noMatch` として落ち、失敗と非該当が区別しにくい。
- 現在は `daily-tag-dedup` が正で、候補統合・保留整理を担う。
- alias と keyword の運用が同じジョブに混在しており、レビュー観点が曖昧。

追加したい処理:
- `llm_error`, `merged_alias`, `merged_keyword`, `pending_review`, `no_match` を分離記録する。
- alias 候補と keyword 候補の出力レポート分離。
- `dry-run` と `apply` を分ける。

実装イメージ:
- `detectTagDuplicates()` の結果を候補単位で `job_run_items` に書く。
- `tag_candidate_pool.review_status` とは別に、日次判定結果を一時保存する `tag_dedup_audit` テーブルを追加するか、JSON artifact を毎回保存する。
- route は `?dryRun=1` を受け、DB 更新なしで `mergedCandidateKeys` を返す。

追加したいフォローバッチ:
- `db:run-daily-tag-dedup -- --dry-run`
- `db:generate-tag-dedup-review`

### 2.6 `monthly-public-archive`

現状の弱い点:
- route と job はあるが scheduler が確認できず、実運用に乗っているか不明。
- `limit` と `ageMonths` は route で受けるが、preview と apply が分かれていない。
- archive 後の `public_articles_history` 件数と cascade 削除件数を見比べる手当てがない。

追加したい処理:
- preview 専用 route / CLI。
- 実行後の検証ログ。
- `source_key` 別件数の事前表示。

実装イメージ:
- `runMonthlyPublicArchive()` に `dryRun` を追加し、対象件数と最古 / 最新だけ返すモードを実装する。
- `job_runs.metadata` に `archivedBySourceKey` と `cascadeEstimate` を残す。
- scheduler を追加する場合は `workflow_dispatch` に加えて `schedule:` を設定し、monthly 実行の SSOT を明文化する。

追加したいフォローバッチ:
- `db:preview-monthly-public-archive`
- `db:verify-public-archive`

### 2.7 `daily-db-backup`

現状の弱い点:
- backup 作成はあるが、復元テストがない。
- artifact 7日保持だけでは、月次・障害復旧の実効性が見えにくい。
- backup 成功時の件数 / サイズ / 主要テーブル存在確認が残らない。

追加したい処理:
- restore drill。
- backup manifest 出力。
- 長期保管先の整理。

実装イメージ:
- `backup-neon-all.mjs` の出力先に `manifest.json` を追加し、dump サイズ、対象 DB、主要テーブル一覧を残す。
- 週次で `backup-restore-check` workflow を追加し、検証 DB へ restore して `SELECT COUNT(*)` を主要テーブルで照合する。
- 可能なら artifact だけでなく object storage へ週次 / 月次コピーを残す。

追加したいフォローバッチ:
- `backup-restore-check`
- `backup-manifest-verify`

## 3. 不足している定時バッチの仕様案

### 3.1 `weekly-archive`

必要性:
- spec には存在するが、実装と起動経路が見当たらない。
- `articles_raw` の保持ポリシーを docs どおり回すなら必要。

実装イメージ:
- `src/lib/jobs/weekly-archive.ts` を追加し、`is_processed=true AND created_at < now()-30 days` を `articles_raw_history` へ移して delete する。
- 1 回の上限件数を持たせ、`LIMIT 5000` などの分割移動にする。
- `job_runs` へ `archived`, `oldestArchivedAt`, `newestArchivedAt` を残す。

### 3.2 `cron-health-check`

必要性:
- 現状は「止まっても `/admin/jobs` を見ないと気づきにくい」。
- `workflow_dispatch` ベース運用ならなおさら、失火監視が必要。

実装イメージ:
- 監視対象は `hourly-fetch`, `enrich-worker`, `hourly-publish`, `hourly-compute-ranks`, `daily-tag-dedup`, `monthly-public-archive`, `daily-db-backup`。
- 期待時刻からの遅延、`running` の滞留、`failed` 連続回数を判定する。
- 通知先は最低でも GitHub issue / email / Slack のいずれか 1 系統を用意する。

### 3.3 `send-digest` scheduler

必要性:
- cron route はあるが、定時実行の接続が repo 上で見えない。
- Push digest を機能として持つなら、ジョブとして明示した方がよい。

実装イメージ:
- 毎日固定時刻に `/api/cron/send-digest` を叩く workflow を追加する。
- `job_runs` が未接続なので、route 側に `startJobRun/finishJobRun` を追加し、送信数と失敗数を残す。

## 4. 不足しているフォローバッチの仕様案

### 4.1 `run-hourly-compute-ranks.ts`

- 現在は route しかなく、DB / cron を介さず検証する導線がない。
- 実装は route の中身を `src/lib/jobs/hourly-compute-ranks.ts` へ寄せ、その上で CLI から呼べるようにする。

### 4.2 `run-manual-pending-recovery.ts`

- `manual_pending` の回復手順が `prepare`, `CLI`, `import`, `retag` に分散している。
- 実装は `artifacts/manual-pending/` を入力にして、import 後の後処理まで 1 コマンドで束ねる。

### 4.3 `publish-repair.ts`

- `public_article_sources` だけ、`public_article_adjacent_tags` だけ、といった部分修復導線がない。
- 実装は `publishOne()` 系を再利用し、同期対象をフラグで絞れるようにする。

### 4.4 `archive-preview.ts`

- archive 系は誤実行コストが高いので、適用前 preview が欲しい。
- 実装は monthly / weekly の両方に共通で、対象件数、source 別件数、最古日時だけ返す。

## 5. 先に着手しやすい改善順

1. `monthly-public-archive` と `send-digest` の scheduler 有無を確定する
2. `compute-ranks` を route 直書きから `lib/jobs` + CLI へ切り出す
3. `import-ai-enrich-outputs.ts` を通常 enrich と同じ副作用へ揃える
4. `cron-health-check` を追加する
5. `weekly-archive` を実装するか、spec から削るかを確定する
