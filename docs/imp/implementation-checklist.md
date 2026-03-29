# AI Trend Hub 着手順チェックリスト

最終更新: 2026-03-27

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

- [ ] 今回用 artifact を `af-20260326/` 系ディレクトリへ切り出す
- [ ] 主タグ / 新規立項タグ / カテゴリ / 周辺分野タグの役割分担を整理する
- [ ] カテゴリを公開面サイドバー導線として使う前提を Web に反映する
- [ ] 周辺分野タグを当面通常タグと同様にクリック可能な導線として Web に反映する
- [ ] 図ではなく実装した Web を見て導線を評価する
- [ ] 主タグの完全除外リストを 1周目フローへ反映する
- [ ] `title + summary100 + summary200` を入力に 1周目判定を回す
- [ ] 50〜200件チャンクで 1周目 output を生成する
- [ ] タグ参照用 SQL を使って TBL の現況を直接確認できる状態にする
- [ ] 新規立項タグ候補を件数付きで集計する
- [ ] ユーザー提示用の新規立項タグ候補一覧を作る
- [ ] `arxiv-ai` backlog の現状を確認する
- [x] `arxiv-ai` の 5 か月超 raw を enrich claim 前に除外する
- [x] `arxiv-ai` を L4 で 2 か月保持にするローテーション条件を実装する
- [ ] `job_run_id=563` の `hourly-fetch` が停滞か完了かを確認する
- [ ] enrich を回す場合の件数・時間帯・Gemini API 影響を整理する
- [x] migration 038 を適用する（adjacent tags / thumbnail_bg_theme）
- [ ] 1周目反映前に `db:retag-layer2-layer4` の入力 / 出力設計を見直す
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
- [ ] 2周目着手前にカテゴリ / 属性設計を確定する
- [ ] 周辺分野タグの視覚的マッピングページを設計する
- [ ] タグ関連テーブル再編の要否を整理する（分割 or 共通化 + `tag_type`）

## 4. 再開時確認

- [ ] `docs/imp/imp-hangover.md` を確認した
- [ ] `docs/imp/implementation-wait.md` を確認した
- [ ] `docs/imp/data-flow.md` を確認した
- [ ] `agents-task-status.md` の current queue を確認した
