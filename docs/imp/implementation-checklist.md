# AI Trend Hub 着手順チェックリスト

最終更新: 2026-03-21

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

今回の実装では、以下のスキルを明示的に使う。

1. `tdd-workflow`
   - 新規機能と API 追加時は、可能な範囲でテスト先行で進める
   - 対象: `content_language` 伝搬、管理 API、ランキング調整
2. `security-review`
   - 管理 API、`ADMIN_SECRET`、入力バリデーション、認可境界の確認に使う
   - 対象: Phase D 全体
3. `coding-standards`
   - TypeScript / Next.js 実装の命名、責務分割、不可変更新、例外処理の統一に使う
   - 対象: 全 Phase
4. `backend-patterns`
   - API route、DB アクセス、責務分離、運用系エンドポイントの設計に使う
   - 対象: Phase A, C, D, E
5. `Neon Architect`
   - Neon 前提の migration、backfill、制約、pooled / direct の使い分け確認に使う
   - 対象: Phase A, B, E

### 3.1 スキル適用マップ

- [ ] Phase A では `Neon Architect` + `coding-standards` + `tdd-workflow` を適用する
- [ ] Phase B では `Neon Architect` + `backend-patterns` を適用する
- [ ] Phase C では `backend-patterns` + `coding-standards` を適用する
- [ ] Phase D では `security-review` + `backend-patterns` + `tdd-workflow` を適用する
- [ ] Phase E では `backend-patterns` + `tdd-workflow` + `Neon Architect` を適用する

---

## 4. 着手前ゲート

### 4.1 仕様確認

- [ ] `docs/imp/implementation-plan.md` の A〜E の順序を今回も維持する
- [ ] `docs/imp/imp-hangover.md` の日本語ソース候補 14 件と残件を再確認する
- [ ] `docs/spec/04-data-model-and-sql.md` の追加対象カラムとテーブルを再確認する

### 4.2 Human-In-The-Loop

- [ ] migration 035 の内容を確定し、Neon 本番適用前にユーザー確認を取る
- [ ] 破壊的変更が含まれていないことを確認する

### 4.3 実装前検証

- [ ] 現在の `npm run type-check` を通す
- [ ] 現在の `npm run build` を通す
- [ ] 必要なら `npx next typegen` を通して現状基線を確認する

---

## 5. 実装順チェックリスト

### Phase A. migration 035 と `content_language` 導入

#### A-1. migration 035 作成

- [ ] `source_targets.content_language` を追加する
- [ ] `articles_enriched.content_language` を追加する
- [ ] `public_articles.content_language` を追加する
- [ ] `articles_enriched.topic_group_id` を追加する
- [ ] `public_articles.topic_group_id` を追加する
- [ ] `topic_groups` テーブルを追加する
- [ ] migration が追加のみであることを確認する

完了条件:
- migration ファイルが作成済み
- 追加対象が `implementation-plan.md` と一致している

#### A-2. seed / backfill 整備

- [ ] `source_targets.content_language` を SSOT とする方針で seed を更新する
- [ ] 既存ソースを `ja` / `en` に分類する
- [ ] `articles_enriched` 向け backfill SQL またはスクリプトを用意する
- [ ] `public_articles` 向け backfill SQL またはスクリプトを用意する
- [ ] 例外ソースの扱いを決めて docs に残せる形にする

完了条件:
- seed 更新案が固まっている
- backfill 手順が再実行可能な形で残っている

#### A-3. アプリ層伝搬

- [ ] enrich で `source_targets.content_language -> articles_enriched.content_language` を伝搬する
- [ ] publish で `articles_enriched.content_language -> public_articles.content_language` を伝搬する
- [ ] 型定義へ `content_language` / `topic_group_id` を追加する
- [ ] DB query / repository / API response に同項目を通す

完了条件:
- L2 と L4 の言語カラムがコード上で途切れず流れる
- 型エラーがない

#### A-4. UI 最小反映

- [ ] `ArticleCard` に `JP / EN` バッジを追加する
- [ ] detail / list / saved / liked など ArticleCard 利用箇所で表示崩れがないことを確認する

完了条件:
- バッジが表示される
- 見た目改善ではなくデータ識別として成立している

#### A-5. Phase A 検証

- [ ] migration 適用前後の差分確認手順をまとめる
- [ ] backfill 後の `source_targets / articles_enriched / public_articles` 件数整合を確認する
- [ ] 不整合や未分類ソースがあれば `docs/imp/imp-hangover.md` に残す

完了条件:
- 言語軸が L2/L4 で整合している
- 未解決項目が docs に残っている

### Phase B. 日本語ソース 14 件追加

#### B-1. seed 追加

- [ ] `imp-hangover.md §13.4` の候補を seed に反映する
- [ ] 各ソースへ `commercial_use_policy='permitted'` を設定する
- [ ] 各ソースへ `content_language='ja'` を設定する
- [ ] 各ソースへ `is_active=true` を設定する

完了条件:
- 対象 14 件が seed 上で定義済み

#### B-2. 取り込み前確認

- [ ] feed URL が現在も有効かを確認する
- [ ] URL 正規化と重複混入リスクを確認する
- [ ] 既存 source_key 命名規則と衝突しないことを確認する

完了条件:
- 明らかな投入事故がない状態で取り込みに進める

#### B-3. パイプライン反映

- [ ] `fetch -> enrich -> publish` を順に通す
- [ ] `public_articles` に日本語ソースが反映されることを確認する
- [ ] source_type / source_category / content_language の分布を確認する

完了条件:
- 日本語ソースの L1/L2/L4 流れが確認できている

### Phase C. 公開面の言語軸対応

#### C-1. API / 集計の受け口

- [ ] `/api/home` に必要な `content_language` を通す
- [ ] `/api/search` に必要な `content_language` を通す
- [ ] `/api/trends` に必要な `content_language` を通す
- [ ] `/api/articles/[id]` と関連取得関数に必要な `content_language` を通す
- [ ] digest 系取得に必要な `content_language` を通す

完了条件:
- 公開 API が言語軸を欠落させない

#### C-2. 非対象の明文化

- [ ] 言語フィルタ UI をこのフェーズで実装しない場合は docs に明記する
- [ ] 見た目微調整を今回スコープ外として明記する

完了条件:
- 実装対象と非対象が docs 上で曖昧でない

### Phase D. 管理画面 Phase 3

#### D-1. 管理ルート基盤

- [ ] `ADMIN_PATH_PREFIX` を前提とした管理ルートを実装する
- [ ] `ADMIN_SECRET` による認証を管理 API 全体へ適用する
- [ ] 認証失敗時のレスポンスを揃える

完了条件:
- 管理系エンドポイントが公開面から分離されている

#### D-2. `hide_article` 最小実装

- [ ] `POST /api/admin/articles/:id/hide` を実装する
- [ ] `public_articles.visibility_status='hidden'` を直接更新する
- [ ] 同一操作を `admin_operation_logs` に記録する
- [ ] 該当記事の revalidation を実装する

完了条件:
- queue なしで hide が即時反映される

#### D-3. タグレビュー UI

- [ ] `tag_candidate_pool` の候補一覧を表示する
- [ ] `tags_master` への昇格を実装する
- [ ] `tag_keywords` 追加導線を実装する
- [ ] 操作ログを `admin_operation_logs` に残す

完了条件:
- 最低限のタグ運用が UI から可能

#### D-4. source 管理

- [ ] `source_targets.is_active` ON/OFF スイッチを実装する
- [ ] 変更を `admin_operation_logs` に記録する

完了条件:
- source の停止/再開が管理画面から可能

### Phase E. ランキングと運用調整

#### E-1. action_type 正式反映

- [ ] `view -> impression_count` を反映する
- [ ] `expand_200 / topic_group_open / digest_click -> open_count` を反映する
- [ ] `article_open -> source_open_count` を反映する
- [ ] `share_* -> share_count` を反映する
- [ ] `save -> save_count` を反映する
- [ ] `share_open / return_focus` を集計対象外にする
- [ ] `unsave` を減算しないことを固定する

完了条件:
- `implementation-plan.md` 記載の正式マッピングとコードが一致する

#### E-2. `compute-ranks` 調整

- [ ] 係数を点検し必要なら調整する
- [ ] `compute-ranks` を再実行する
- [ ] 上位結果を抜き取り監査する

完了条件:
- ランキング再計算後の結果に明らかな破綻がない

---

## 6. docs 更新チェックリスト

- [ ] `docs/imp/implementation-plan.md` を進捗に合わせて更新する
- [ ] `docs/imp/imp-status.md` を更新する
- [ ] `docs/imp/imp-hangover.md` に未解決項目と再開点を残す
- [ ] 必要なら `docs/spec/04-data-model-and-sql.md` に追加カラムの反映を行う

---

## 7. 最終検証チェックリスト

- [ ] `npx next typegen`
- [ ] `npm run type-check`
- [ ] `npm run build`
- [ ] 管理 API の認証失敗/成功を確認する
- [ ] `hide_article` の反映と再検証を確認する
- [ ] 日本語ソース追加後の Home / search / ranking / detail を確認する
- [ ] `content_language` の L2/L4 整合を確認する

---

## 8. 実行順の要約

1. migration 035 設計と承認待ち
2. `content_language` 導入、seed 更新、backfill、伝搬実装
3. `ArticleCard` の言語バッジ追加
4. 日本語ソース 14 件追加とパイプライン反映
5. 公開 API の言語軸対応
6. 管理画面基盤、`hide_article`、タグレビュー、source ON/OFF
7. ranking マッピング正式反映と再計算
8. docs 更新と最終検証
