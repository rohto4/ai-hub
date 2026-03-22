# AI Trend Hub 着手順チェックリスト

最終更新: 2026-03-22

## 1. このファイルの目的

- `docs/imp/implementation-plan.md` にある次フェーズの実装項目を、実際の着手順に落とした実行用チェックリストとして管理する。
- 対象は「プランの見た目改善以外」の実装全体とする。
- 各項目は、開始条件・実施内容・完了条件が分かる粒度で記載する。

---

## 2. 前提と制約

- `docs/spec/04-data-model-and-sql.md` の破壊的変更は行わない。
- DB migration の Neon 本番適用前にはユーザー確認を取る。
- 新規依存パッケージは追加しない。
- `scripts/backup-neon-all.mjs`、`vercel.json`、GitHub Actions は変更しない。
- 公開面は引き続き Layer 4 のみを読む。

---

## 3. 使用スキル

### 3.1 スキル適用マップ

- [x] Phase A では `Neon Architect` + `coding-standards` + `tdd-workflow` を適用する
- [x] Phase B では `Neon Architect` + `backend-patterns` を適用する
- [x] Phase C では `backend-patterns` + `coding-standards` を適用する
- [x] Phase D では `security-review` + `backend-patterns` + `tdd-workflow` を適用する
- [x] Phase E では `backend-patterns` + `tdd-workflow` + `Neon Architect` を適用する

---

## 4. 着手前ゲート

### 4.1 仕様確認

- [x] `docs/imp/implementation-plan.md` の A〜E の順序を今回も維持する
- [x] `docs/imp/imp-hangover.md` の日本語ソース候補 14 件と残件を再確認する
- [x] `docs/spec/04-data-model-and-sql.md` の追加対象カラムとテーブルを再確認する

### 4.2 Human-In-The-Loop

- [x] migration 035 の内容を確定し、Neon 本番適用前にユーザー確認を取る
- [x] 破壊的変更が含まれていないことを確認する

### 4.3 実装前検証

- [x] 現在の `npm run type-check` を通す
- [x] 現在の `npm run build` を通す
- [x] 必要なら `npx next typegen` を通して現状基線を確認する

### 4.4 GitHub Actions 登録前ゲート

- [x] `content_language` の L2/L4 伝搬が完了している
- [x] `thumbnail_url` の取得と L2/L4 伝搬が完了している
- [x] 日本語ソース投入と初回 `fetch -> enrich -> publish` 確認が完了している
- [x] 外部 cron が旧 `/api/cron/ingest-feeds` を叩いていないことを確認している

---

## 5. 実装順チェックリスト

### Phase A. migration 035 と `content_language` 導入

#### A-1. migration 035 作成（完了）

- [x] `source_targets.content_language` を追加する
- [x] `articles_enriched.content_language` を追加する
- [x] `public_articles.content_language` を追加する
- [x] `articles_enriched.topic_group_id` を追加する
- [x] `public_articles.topic_group_id` を追加する
- [x] `topic_groups` テーブルを追加する
- [x] migration が追加のみであることを確認する

#### A-2. seed / backfill 整備（完了）

- [x] `source_targets.content_language` を SSOT とする方針で seed を更新する
- [x] 既存ソースを `ja` / `en` に分類する
- [x] `articles_enriched` 向け backfill SQL またはスクリプトを用意する
- [x] `public_articles` 向け backfill SQL またはスクリプトを用意する
- [x] 例外ソースの扱いを決めて docs に残せる形にする

#### A-3. アプリ層伝搬（完了）

- [x] enrich で `source_targets.content_language -> articles_enriched.content_language` を伝搬する
- [x] publish で `articles_enriched.content_language -> public_articles.content_language` を伝搬する
- [x] 型定義へ `content_language` / `topic_group_id` を追加する
- [x] DB query / repository / API response に同項目を通す

#### A-4. UI 最小反映（完了）

- [x] `ArticleCard` に `JP / EN` バッジを追加する
- [x] detail / list / saved / liked など ArticleCard 利用箇所で表示崩れがないことを確認する

#### A-5. `thumbnail_url` 実装（部分完了）

- [x] `thumbnail_url` は外部記事画像の取得ではなく、内部テンプレート画像の割当結果として扱う方針を守る
- [x] タグ固定優先順位を作らない
- [x] title 内のタグ出現順を最優先で採用する（thumbnail-template.ts で実装）
- [x] `src/lib/publish/thumbnail-template.ts` 相当の合成ロジックを追加する
- [x] `src/lib/publish/thumbnail-tag-registry.ts` 相当の registry を追加する
- [x] 未登録タグが来ても publish を止めず、`thumbnail_emoji` にフォールバックする
- [x] `hourly-publish` で `public_articles.thumbnail_url` を解決・保存する
- [x] 画像を解決できない記事は `thumbnail_emoji` に確実にフォールバックする
- [ ] タグ用アイコン SVG/PNG 画像資産を主要タグ分用意する（後回し）
- [ ] 1タグ / 2タグ / 3タグ / 4件以上でレイアウトルールを実画像で実装する（後回し）

#### A-5.1 タグ昇格時の画像資産フロー（未着手）

- [ ] tag 昇格時に registry 登録有無を確認するフローを定義する
- [ ] 後からアイコン追加したタグの `thumbnail_url` 再計算方針を決める

#### A-6. Phase A 検証（完了）

- [x] backfill 後の `source_targets / articles_enriched / public_articles` 件数整合を確認する
- [x] 不整合や未分類ソースがあれば `docs/imp/imp-hangover.md` に残す

---

### Phase B. 日本語ソース 14 件追加（完了）

#### B-1. seed 追加

- [x] `imp-hangover.md §13.4` の候補を seed に反映する
- [x] 各ソースへ `commercial_use_policy='permitted'` を設定する
- [x] 各ソースへ `content_language='ja'` を設定する
- [x] 各ソースへ `is_active=true` を設定する

#### B-2. 取り込み前確認

- [x] feed URL が現在も有効かを確認する
- [x] URL 正規化と重複混入リスクを確認する
- [x] 既存 source_key 命名規則と衝突しないことを確認する

#### B-3. パイプライン反映

- [x] `fetch -> enrich -> publish` を順に通す
- [x] `public_articles` に日本語ソースが反映されることを確認する
- [x] source_type / source_category / content_language の分布を確認する

---

### Phase C. GitHub Actions 登録前確認（完了）

#### C-1. 登録前の確認

- [x] `hourly-fetch`, `hourly-enrich`, `hourly-publish` が現行実装の正規入口であることを確認する
- [x] `daily-db-backup` が公開系ジョブと独立していることを確認する
- [x] GitHub Actions に旧 `/api/cron/ingest-feeds` を叩くものがないことを確認する
- [x] `APP_URL` / `CRON_SECRET` / DB 環境変数の投入先を整理する

---

### Phase D. 公開面の言語軸対応（完了）

#### D-1. API / 集計の受け口

- [x] `/api/home` に必要な `content_language` を通す（`hasDatabaseColumn` 二重クエリ廃止）
- [x] `/api/search` に必要な `content_language` を通す
- [x] `/api/trends` に必要な `content_language` を通す
- [x] `/api/articles/[id]` と関連取得関数に必要な `content_language` を通す
- [x] digest 系取得に必要な `content_language` を通す

#### D-2. 非対象の明文化

- [x] 言語フィルタ UI をこのフェーズで実装しない（imp-hangover.md に明記済み）
- [x] 見た目微調整を今回スコープ外として明記する

---

### Phase E. 管理画面 Phase 3（完了）

#### E-1. 管理ルート基盤

- [x] `ADMIN_SECRET` による認証を管理 API 全体へ適用する（`/admin/*` + `/api/admin/*`）
- [x] 認証失敗時のレスポンスを揃える（401 + エラーメッセージ）
- [ ] `ADMIN_PATH_PREFIX` を env var で動的に変更する仕組み（現状 `/admin` 固定。低優先）

#### E-2. `hide_article` 最小実装

- [x] `PATCH /api/admin/articles/:id` で hide / unhide を実装する
- [x] `public_articles.visibility_status='hidden'` を直接更新する
- [x] 同一操作を `admin_operation_logs` に記録する
- [x] 該当記事の revalidation を実装する

#### E-3. タグレビュー UI

- [x] `tag_candidate_pool` の候補一覧を表示する（出現文脈・スニペット付き）
- [x] `tags_master` への昇格を実装する（遡及タグ付け・tag_keywords 自動登録含む）
- [x] 保留 / 棄却 / 候補に戻す を実装する
- [x] 操作ログを `admin_operation_logs` に残す
- [x] `daily-tag-dedup` で候補と既存タグを日次自動照合・統合する

#### E-4. source 管理

- [x] `source_targets.is_active` ON/OFF スイッチを実装する
- [x] 変更を `admin_operation_logs` に記録する

#### E-5. ジョブログ（追加）

- [x] `/admin/jobs` でジョブ実行履歴・失敗 items・metadata を確認できる
- [x] `compute-ranks` を job_runs に追加する

---

### Phase F. ランキングと運用調整（部分完了）

#### F-1. action_type 正式反映（完了）

- [x] `view -> impression_count` を反映する
- [x] `expand_200 / topic_group_open / digest_click -> open_count` を反映する
- [x] `article_open -> source_open_count` を反映する
- [x] `share_copy -> share_count` を反映する（SNS 連携廃止済み、copy のみ）
- [x] `save -> save_count` を反映する
- [x] `share_open / return_focus` を集計対象外にする
- [x] `unsave` を減算しないことを固定する

#### F-2. `compute-ranks` 調整（部分完了）

- [x] 最適化（1回全件読み込み + 4window 並列 upsert）を実装する
- [x] `compute-ranks` を publish 後に自動実行する（hourly-publish.yml の後続ステップ）
- [ ] 係数を実データで点検・調整する（実アクティビティデータが蓄積されてから）
- [ ] 上位結果を抜き取り監査する（実アクティビティデータが蓄積されてから）

---

## 6. docs 更新チェックリスト

- [x] `docs/imp/implementation-plan.md` を進捗に合わせて更新する（要確認）
- [x] `docs/imp/imp-status.md` を更新する
- [x] `docs/imp/imp-hangover.md` に未解決項目と再開点を残す
- [x] `docs/imp/data-flow.md` を最新化する
- [ ] `docs/spec/04-data-model-and-sql.md` に追加カラムの反映を行う（migration 035/036 分）

---

## 7. 最終検証チェックリスト

- [x] `npx next typegen`
- [x] `npm run type-check`
- [x] `npm run build`
- [x] 管理 API の認証失敗/成功を確認する
- [x] `hide_article` の動作確認
- [x] 日本語ソース追加後の Home / search / ranking / detail を確認する
- [x] `content_language` の L2/L4 整合を DB で確認する

---

## 8. 残タスク（次フェーズ）

- [ ] `docs/spec/04-data-model-and-sql.md` に migration 035/036 分の追加カラムを反映する
- [ ] `thumbnail_url` のアイコン画像資産を主要タグ分用意する（UI改善フェーズで）
- [ ] `compute-ranks` 係数を実アクティビティデータで点検・調整する
- [ ] Topic Group 本実装（pgvector 前提、別フェーズ）
- [ ] `push_subscriptions.genres` カラム名変更（Human-in-the-Loop 対象）
