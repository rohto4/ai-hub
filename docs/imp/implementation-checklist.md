# AI Trend Hub 着手順チェックリスト

最終更新: 2026-03-26

## 1. このファイルの目的

未完了の実装・確認項目だけを短く管理する。完了済みの過去フェーズはここに残し続けない。

## 2. 前提と制約

- `docs/spec/04-data-model-and-sql.md` の破壊的変更はしない
- DB migration の Neon 本番適用前にはユーザー確認を取る
- 新規依存パッケージは追加しない
- `scripts/backup-neon-all.mjs`、`vercel.json`、GitHub Actions は変更しない
- 公開面は Layer 4 のみを読む

## 3. いま未完了の項目

### 優先

- [ ] `arxiv-ai` backlog の現状を確認する
- [x] `arxiv-ai` の 5 か月超 raw を enrich claim 前に除外する
- [x] `arxiv-ai` を L4 で 2 か月保持にするローテーション条件を実装する
- [ ] `job_run_id=563` の `hourly-fetch` が停滞か完了かを確認する
- [ ] enrich を回す場合の件数・時間帯・Gemini API 影響を整理する
- [ ] migration 038 を適用する（adjacent tags / thumbnail_bg_theme）
- [ ] `npm run db:retag-layer2-layer4` を本番運用時間外で実行する
- [ ] retag 後の L2/L4 件数整合を確認する（主タグ/隣接タグ/テーマ）

### 後続

- [ ] `hourly-compute-ranks` 係数を実データで点検・調整する
- [ ] `hourly-compute-ranks` 上位結果を抜き取り監査する
- [ ] Topic Group 本実装の着手条件を整理する
- [ ] `ADMIN_PATH_PREFIX` を env var 化するか確定する
- [ ] 後からアイコン追加したタグの `thumbnail_url` 再計算方針を確定する
- [ ] tag alias 管理 UI の要否を確定する
- [ ] `push_subscriptions.genres` rename の影響範囲を確認する
- [ ] 隣接分野タグの30〜50件監査を実施する
- [ ] Gemini監査出力（`artifacts/gemini-tag-rebuild/outputs`）をレビューする

## 4. 再開時確認

- [ ] `docs/imp/imp-hangover.md` を確認した
- [ ] `docs/imp/implementation-wait.md` を確認した
- [ ] `docs/imp/data-flow.md` を確認した
- [ ] `agents-task-status.md` の current queue を確認した
