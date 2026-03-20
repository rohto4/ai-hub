# AGENTS.md - Codex / OpenAI Codex 運用方針

最終更新: 2026-03-20

> 共通ルール（文字コード・docs 更新・コメント・タスク完了/中断・委託時の指示）は
> [`docs/guide/COMMON.md`](../COMMON.md) を参照。
> このファイルは Codex 固有の設定に絞る。

---

## 1. 基本姿勢

1. 高い自律性で作業してよいが、判断根拠が `docs/` や実装に残る状態を優先する。
2. Document-Driven Development を徹底し、実装変更に追随して `docs/` を更新する。
3. 進捗、判断、未解決事項、引き継ぎ事項は `docs/imp/` に集約する。
4. `docs/guide`、`docs/spec`、`docs/imp` を役割ごとに使い分け、同じ話を複数箇所に散らさない。

---

## 2. Human-In-The-Loop（Codex 固有）

以下は独断で確定せず、必ずユーザー確認を前提に扱う：

1. 新規依存ライブラリの追加
2. `docs/spec/04-data-model-and-sql.md` の破壊的変更
3. `docs/guide/codex/AGENTS.md` 自体の根本ルール変更

---

## 3. DDD 実行ルール

1. 実装前に、少なくとも関連する `docs/guide` と `docs/imp` を確認する。
2. 実装中に方針が変わったら、コードだけでなく docs も同じターンで更新する。
3. 未解決事項や判断待ちは `implementation-wait.md` に残す。
4. 後で検証すべき項目や引き継ぎ事項は `imp-hangover.md` に残す。
5. 直近に実施した作業は、リポジトリ直下の `agents-task-status.md` に新しい行を上から積むキュー形式で残す。
6. `agents-task-status.md` はおおむね 40 行前後を保ち、古い行は下から間引く。

---

## 4. タスク完了時の追加ルール（Codex 固有）

共通ルール（`COMMON.md` §5）に加え：

- タスク完了時は `agents-task-status.md` にも結果を 1 行以上追記してから離れる。

---

## 5. 優先順位

1. まず正しい状態整理を docs に残す。
2. 次に実装を揃える。
3. 最後に運用・テスト・引き継ぎメモを残す。

---

## 6. 補助資料

1. `docs/guide/README.md` と `docs/guide/PROJECT.md` を guide の基準点として扱う。
2. `docs/guide/.agent/` 配下の skills / workflows は必要時に参照する。
3. `docs/guide/COMMON.md` — 共通ルール（UTF-8 / docs 更新 / コメント / タスク管理）

---

## 7. サマリ出力ルール

1. ユーザーが「サマリ」を求めたときは、`docs/guide/.agent/workflows/refactor-summary.md` を優先参照する。
2. サマリは自由文より表を優先し、行数の before / after、区分別合計、総合計を含める。
3. 文章の補足は短くし、全体で 20〜30 行程度を目安にまとめる。
