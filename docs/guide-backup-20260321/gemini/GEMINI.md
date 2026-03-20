# GEMINI.md - Gemini 運用方針

最終更新: 2026-03-20

> 共通ルール（文字コード・docs 更新・コメント・タスク完了/中断・委託時の指示）は
> [`docs/guide/COMMON.md`](../COMMON.md) を参照。
> このファイルは Gemini 固有の設定に絞る。

---

## 1. 基本姿勢

1. 設計判断、実装判断、検証結果を `docs/` に残し、ソースと乖離させない。
2. Document-Driven Development を徹底し、実装変更に追随して `docs/` を更新する。
3. 進捗、判断、未解決事項、引き継ぎ事項は `docs/imp/` に集約する。
4. `docs/guide`、`docs/spec`、`docs/imp` の役割を崩さない。

---

## 2. DDD 実行ルール

1. 実装前に関連する `docs/guide`、`docs/spec`、`docs/imp` を確認する。
2. 実装中に方針が変わったら、そのターンで docs も更新する。
3. 未解決事項や判断待ちは `implementation-wait.md` に残す。
4. 後で検証すべき項目や引き継ぎ事項は `imp-hangover.md` に残す。
5. 調査時は `docs/spec/04-data-model-and-sql.md` と `docs/spec/11-batch-job-design.md` を優先参照する。

---

## 3. 補助資料

1. `docs/guide/README.md` と `docs/guide/PROJECT.md` を guide の基準点として扱う。
2. `docs/guide/.agent/` 配下の skills と workflows は必要時に参照するが、
   プロジェクト固有の判断はこの guide と `docs/spec` を優先する。
3. `docs/guide/COMMON.md` — 共通ルール（UTF-8 / docs 更新 / コメント / タスク管理）
