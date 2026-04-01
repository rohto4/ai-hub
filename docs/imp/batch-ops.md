# バッチ運用リファレンス

最終更新: 2026-04-02

> 定時バッチ・フォローバッチの現状、運用手順、改善論点をまとめた恒久運用資料。
> 実装タスクは `implementation-plan.md`、判断待ちは `implementation-wait.md` に分離する。

---

## 1. 定時バッチ現状

| バッチ | workflow ファイル | schedule 状態 | cron route | 備考 |
|---|---|---|---|---|
| `hourly-fetch` | `hourly-layer12.yml` | schedule 有効 | `/api/cron/hourly-fetch` | workflow 名と route 名はずれている |
| `hourly-enrich` | `hourly-enrich.yml` | schedule 有効 | `/api/cron/enrich-worker` | 毎時 8 回実行 |
| `hourly-publish` | `hourly-publish.yml` | schedule 有効 | `/api/cron/hourly-publish` + `/api/cron/hourly-compute-ranks` | publish と ranks が 1 workflow に直列 |
| `hourly-compute-ranks` | `hourly-publish.yml` の後段 | schedule 有効 | `/api/cron/hourly-compute-ranks` | CLI 実行も可能 |
| `daily-tag-dedup` | `daily-tag-dedup.yml` | schedule 有効 | `/api/cron/daily-tag-dedup` | 候補統合・保留整理を担当 |
| `monthly-public-archive` | `monthly-public-archive.yml` | schedule 有効 | `/api/cron/monthly-public-archive` | route / job / workflow あり |
| `daily-db-backup` | `daily-db-backup.yml` | schedule 有効 | スクリプト直接実行 | artifacts 7日保持のみ |
| `send-digest` | **workflow なし** | **未接続** | `/api/cron/send-digest` | route 実装はあり |
| `weekly-archive` | **未実装** | **未接続** | **なし** | spec にのみ存在 |

**2026-04-02 時点の定時起動経路: GitHub Actions schedule を正として復旧済み**

---

## 2. schedule 設定値（復旧済み後の正）

| バッチ | cron 式 | 備考 |
|---|---|---|
| `hourly-fetch` | `0 * * * *` | 毎時 :00 |
| `hourly-enrich` (×8) | `5,10,15,20,25,30,35,40 * * * *` | 毎時 :05〜:40、8 回 |
| `hourly-publish` + ranks | `50 * * * *` | 毎時 :50 |
| `daily-tag-dedup` | `30 2 * * *` | 毎日 02:30 UTC |
| `daily-db-backup` | `15 18 * * *` | 毎日 18:15 UTC |
| `monthly-public-archive` | `0 3 1 * *` | 毎月 1 日 03:00 UTC |

---

## 3. 全スクリプト一覧（package.json）

### 3.0 開発・ビルド系

| コマンド | 用途 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run dev:turbo` | Turbopack モードで起動 |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript 型チェック |
| `codex:find-session` | Codex セッション検索ユーティリティ |

### 3.1 DB 基盤系

| コマンド | 用途 |
|---|---|
| `db:migrate` | migration 適用 |
| `db:seed` | source_targets / master データ投入 |
| `db:seed-keywords` | tag キーワード投入 |

### 3.2 確認・診断系

| コマンド | 用途 |
|---|---|
| `db:check-layer12` | L1/L2 状態確認（backlog・直近 job_runs）|
| `db:check-domain-policies` | ドメインポリシー確認 |
| `db:check-source-policies` | ソースポリシー確認 |
| `db:check-snippet-domains` | snippet 取得ドメイン確認 |

### 3.3 フォローバッチ一覧（CLIリファレンス）

### 3.4 fetch / enrich 系

| コマンド | 用途 | 基本呼び出し例 |
|---|---|---|
| `db:run-hourly-fetch` | hourly-fetch の手動実行 | `npm run db:run-hourly-fetch -- --limit 20 [--source-key <key>]` |
| `db:run-enrich-worker` | enrich-worker の手動実行 | `npm run db:run-enrich-worker -- --limit 20 --summary-batch-size 20 --max-summary-batches 1` |
| `db:prepare-gemini-cli-enrich` | 追いつき enrich の入力生成 | `npm run db:prepare-gemini-cli-enrich` |
| `db:import-ai-enrich-outputs` | Gemini CLI 結果の DB 反映 | import 後は必ず `db:retag-layer2-layer4` を続ける |
| `db:requeue-raw` | raw を再処理待ちへ戻す | 対象を絞ってから実行 |
| `db:skip-raw-backlog` | backlog の意図的スキップ | 古すぎる raw や不要 source 向け |
| `db:repair-stale-job-runs` | stuck job_runs の修復 | `/admin/jobs` で対象を特定してから実行 |

### 3.5 publish / ranks 系

| コマンド | 用途 | 基本呼び出し例 |
|---|---|---|
| `db:run-hourly-publish` | publish の手動実行 | `npm run db:run-hourly-publish` |
| `db:run-hourly-compute-ranks` | ranks の手動実行 | `npm run db:run-hourly-compute-ranks` |
| `db:backfill-article-tags` | 既存記事へのタグ再反映 | タグ仕様変更後の補修向け |
| `db:backfill-public-article-sources` | public_article_sources の再同期 | 整合不整合補修用 |
| `db:backfill-thumbnail-urls` | thumbnail_url の一括再生成 | サムネイル仕様変更後 |

### 3.6 tag 系

| コマンド | 用途 | 備考 |
|---|---|---|
| `db:retag-layer2-layer4` | L2/L4 全件 retag | タグルール変更後に使う |
| `db:apply-phase1-tag-decisions` | 確定タグ方針の DB 反映 | 直後に retag を続ける |
| `db:prepare-ai-retag-artifacts` | AI retag 用入力生成 | `artifacts/ai-retag-all/` を起点 |
| `db:run-ai-retag-gemini` | AI retag の part 実行 | 完走後に summarize → generate-sql |
| `db:summarize-ai-retag-outputs` | AI retag 出力の集計 | 全 part 完走後に実行 |
| `db:generate-ai-retag-sql` | AI retag 反映 SQL の生成 | 差分確認してから適用 |

### 3.7 source / domain 管理系

| コマンド | 用途 |
|---|---|
| `db:set-source-state` | source の active / inactive 切り替え |
| `db:set-source-policy` | source の content policy 設定 |
| `db:set-domain-policy` | ドメインの policy 設定 |
| `db:promote-domain-policy` | domain policy の昇格 |
| `db:sync-observed-domains` | 観測ドメインの同期 |

### 3.8 repair / 補修系

| コマンド | 用途 |
|---|---|
| `db:repair-google-alerts-urls` | Google Alerts URL の修復 |
| `db:repair-raw-titles-from-url` | URL から raw タイトルを補修 |
| `db:repair-stale-job-runs` | stuck な job_runs を修復 |
| `db:requeue-raw` | raw を再処理待ちへ戻す |
| `db:skip-raw-backlog` | backlog の意図的スキップ |

### 3.9 generate / export 系（主にタグ整理・一括処理用）

| コマンド | 用途 |
|---|---|
| `db:export-ai-enrich-inputs` | enrich 用 AI 入力を export |
| `db:export-thumbnail-prompts` | サムネイルプロンプトを export |
| `db:generate-tag-icons` | タグアイコンを生成 |
| `db:generate-tag-alias-review` | タグ alias レビュー用 JSON を生成 |
| `db:generate-tag-alias-review-page` | タグ alias レビューページを生成 |
| `db:promote-tag-candidates` | タグ候補を昇格 |
| `db:prune-tag-candidates` | タグ候補を剪定 |
| `db:generate-phase1-summary-sheet` | Phase 1 集計シートを生成 |
| `db:generate-phase1-decision-page` | Phase 1 判断ページを生成 |
| `db:generate-phase1-final-manifest` | Phase 1 最終 manifest を生成 |
| `db:apply-phase1-tag-decisions` | Phase 1 確定方針を DB に反映 |

### 3.10 backfill 系

| コマンド | 用途 |
|---|---|
| `db:backfill-article-tags` | 既存記事へのタグ再反映 |
| `db:backfill-thumbnail-urls` | thumbnail_url の一括再生成 |

### 3.11 archive / backup 系

| コマンド | 用途 | 備考 |
|---|---|---|
| `db:run-monthly-public-archive` | 月次 archive の手動実行 | 実行後に `/admin/jobs` を確認 |
| `db:check-layer12` | L1/L2 状態確認 | 障害一次切り分けに使う |

---

## 4. 追いつき手順（停止後の復旧ランブック）

### 4.1 小規模停止（数時間〜1 日）

```sh
node scripts/check-layer12.mjs
npm run db:run-hourly-fetch -- --limit 50
npm run db:run-enrich-worker -- --limit 20 --summary-batch-size 20 --max-summary-batches 1  # 数回
npm run db:run-hourly-publish
# ranks: workflow_dispatch または db:run-hourly-compute-ranks
```

### 4.2 中規模停止（数日〜1 週間）← 2026-04-02 時点

**Phase 1. 事前確認**

```sh
node scripts/check-layer12.mjs   # raw_unprocessed, latestJobRuns を確認
node scripts/set-source-state.mjs <source-key> --enable  # inactive化したsourceを復旧
```

**Phase 2. source 追加があるなら実施**

```sh
# scripts/seed.mjs に source を追記 → npm run db:seed
npm run db:run-hourly-fetch -- --limit 1 --source-key <new-key>  # 疎通確認
```

**Phase 3. fetch backlog を吸う**

```sh
npm run db:run-hourly-fetch -- --limit 50  # 2〜5回に分ける
node scripts/check-layer12.mjs  # last_error が増えていないか確認
```

**Phase 4-A. 通常 enrich で吸う（まずこちらを試す）**

```sh
npm run db:run-enrich-worker -- --limit 20 --summary-batch-size 20 --max-summary-batches 1
# job_runs と manualPendingCount を確認しながら数回繰り返す
```

**Phase 4-B. backlog が大きい場合（CLI 追いつき線）**

```sh
npm run db:prepare-gemini-cli-enrich
# artifact/gemini-cli-enrich-backlog-1500/ で CLI 実行
npm run db:import-ai-enrich-outputs
npm run db:retag-layer2-layer4   # ← import 後は必須
```

**Phase 5. 公開面へ反映**

```sh
npm run db:run-hourly-publish
npm run db:run-hourly-compute-ranks
```

**Phase 6. 定時起動経路を再接続**

schedule: が各 workflow に追加済みであることを確認する。

### 4.3 大規模停止（複数週間以上）

1. source 別に「継続取得 / しない」を先に切る
2. 不要 backlog は `db:skip-raw-backlog` で圧縮
3. 重要 source は `db:run-hourly-fetch -- --source-key ...` で個別処理
4. enrich は最初から CLI 追いつき線を主に使う
5. import → retag → publish → ranks の順で処理
6. 復旧後 2〜3 日は scheduler を戻しても監視を継続

### 4.4 日本語 source 追加時のチェックリスト

追加前:
- ToS / 商用利用可否を確認した
- RSS / Atom / API の実 URL を確認した
- `contentAccessPolicy` を判断した
- `contentLanguage: 'ja'` を付ける

追加後:
- `db:run-hourly-fetch -- --source-key <key>` で単体疎通確認
- `db:run-enrich-worker -- --source-key <key>` で 1 回要約確認
- Home / Ranking に出た後、タイトル・要約・thumbnail を spot check

### 4.5 復旧完了の判定条件

1. `node scripts/check-layer12.mjs` で raw_unprocessed が許容範囲
2. 最新 2〜3 回の fetch / enrich / publish / ranks が成功
3. 今回追加した source が last_error なしで 1 回以上処理済み
4. Home / Ranking に新着反映が見える
5. schedule: が各 workflow に設定済み

---

## 5. 既知の不整合・改善論点

### 5.1 定時本線と CLI 追いつき線の副作用差

現状: `import-ai-enrich-outputs.ts` を通過した記事は `tag_candidate_pool`, `adjacent_tags`, `thumbnail_bg_theme` が通常 enrich と一致しない。
対処: `persistEnrichedResult()` 的な共通保存関数へ副作用を寄せ、CLI import もそこを通す。
→ `implementation-plan.md` のバッチ改善タスクへ追記済み。

### 5.2 hourly-compute-ranks の CLI

現状: route と CLI の両方で単独再計算できる。
残課題: `window` / `dry-run` / 比較プロファイルなどの運用引数拡張。

### 5.3 monthly-public-archive の監視整備

現状: workflow 追加までは完了済み。
残課題: 定期実行後の監視項目と runbook を固める。

### 5.4 hourly-fetch の 3 連続失敗即 inactive 問題

現状: source 失敗時の backoff が粗く、一時障害でも inactive 化される。
対処: `source_targets` に `failure_backoff_until` / `last_failure_kind` を追加し、backoff 制御を入れる。
→ `implementation-wait.md` §fetch-backoff に論点として追記済み。

---

## 6. 不足しているバッチ（要実装 or 要判断）

| バッチ | 状態 | 優先度 | 備考 |
|---|---|---|---|
| `cron-health-check` | 未実装 | 高 | 止まっても気づけない状態 |
| `weekly-archive` | 未実装 | 中 | spec にのみ存在。要否判断が先 |
| `send-digest` scheduler | workflow なし | 低 | route 実装はあり |
| `backup-restore-check` | 未実装 | 低 | backup の復元性確認なし |

---

## 7. 注意事項（再実行時）

- CLI import を使った追いつきでは、import 後の `db:retag-layer2-layer4` を省略しない
- 3 連続失敗で inactive 化された source がある可能性があるため、source 追加前に active 状態を確認する
- `hourly-layer12.yml` という名前でも、実体は `/api/cron/hourly-fetch` のみを叩いている
- `arxiv-ai` は backlog が大きいため、enrich 実行前に件数を必ず確認する（`db:check-layer12`）
