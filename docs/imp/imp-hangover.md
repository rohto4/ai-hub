# AI Trend Hub 実装再開メモ

最終更新: 2026-03-14

## 1. このメモの目的

このファイルは、次のセッションで **Layer1〜Layer2 実装をすぐ再開するための入口** です。  
再開時は、まずこのファイルだけ開けばよい状態を目指します。

## 2. 現在の結論

1. Layer1〜Layer2 は実装に進める状態
2. Google Alerts の初期候補 9 本は作成済み
3. Google Alerts の RSS URL 9 本は疎通確認済み
4. `source_targets` seed に落とせる対応表も作成済み
5. P0 の暫定運用ルールは `implementation-plan.md` へ反映済み

## 3. 最初に読むべきドキュメント

### 3.1 再開時の最小セット

1. `docs/imp/imp-hangover.md`
   - このファイル
2. `docs/imp/implementation-plan.md`
   - 何を実装するかの正
3. `docs/spec/11-batch-job-design.md`
   - どのジョブをどう切るかの正
4. `docs/memo/20260313_source_target_candidates.md`
   - `source_targets` 初期 seed 候補と Google Alerts URL 対応表
5. `docs/spec/10-ingestion-layer-design.md`
   - Layer1 / Layer2 の責務
6. `docs/spec/05-ingestion-and-ai-pipeline.md`
   - 取得・整形の流れ
7. `docs/spec/04-data-model-and-sql.md`
   - テーブル定義の意図
8. `migrations/001_extensions.sql` から `migrations/009_rls.sql`
   - DDL の正

### 3.2 必要になった時に読むもの

1. `docs/imp/implementation-wait.md`
   - 未確定事項の確認
2. `docs/spec/08-security-quality-operations.md`
   - RLS、検証、監視
3. `docs/memo/20260312-data-design.md`
   - レイヤー設計の意図
4. `docs/memo/20260312_dataflow.md`
   - フロー図

## 4. 今回時点の確定事項

1. タグ候補昇格閾値は暫定で `seen_count >= 5`
2. Google Trends 一致判定は日本語基準の類似一致
3. 類似重複は P0 では本格実装しない
4. 後続で類似重複をやる場合は `pgvector` 寄り
5. `public_rankings` は 1 週間でスコアが `1/5` になる時間減衰を暫定採用
6. `share_count` と `save_count` は同重み
7. `source_open_count` はその 2 倍重み
8. `impression_count` はその 1/2 重み
9. `source_priority_rules` は初期差なし
10. 即時反映は P0 では `hide_article` を優先
11. タグ人手レビュー UI は必要

## 5. 現在の `source_targets` 方針

### 5.1 Google Alerts 初期候補

1. Voice AI / Voice Agent
2. AI Agents / Coding Agents
3. AI Regulation / Policy
4. AI Safety / Alignment
5. Anthropic / Claude / Cowork
6. Antigravity
7. Gemini / Google AI Studio
8. OpenAI / ChatGPT / Codex
9. RAG / Retrieval-Augmented Generation

### 5.2 状態

1. Alert 自体は作成済み
2. RSS URL は docs に記載済み
3. 9 本すべて `HTTP 200` / `text/xml` を確認済み
4. `display_name` / `source_key` / `fetch_kind` / `source_category` / `base_url` の対応表も作成済み

## 6. 次セッションでやる実装順

1. `source_targets` seed をコード化する
2. `source_priority_rules` の初期 seed をコード化する
3. `hourly-fetch` の entrypoint を作る
4. collector registry を作る
5. URL 正規化 utility を作る
6. `articles_raw` insert / update detection helper を作る
7. `daily-enrich` の entrypoint を作る
8. raw reader / extractor / summarizer / tag matcher / enriched writer をつなぐ

## 7. 直近の実装対象

### 7.1 まずやるもの

1. `source_targets` seed
2. `hourly-fetch`
3. `daily-enrich`

### 7.2 まだ後でよいもの

1. `hourly-publish`
2. `priority-queue-worker`
3. `daily-tag-promote`
4. `weekly-archive`

## 8. 次セッションで最初にする命令

次のセッションでは、最初にこれをそのまま伝えればよいです。

`docs/imp/imp-hangover.md を起点に Layer1〜Layer2 実装を再開してください。まず source_targets seed と hourly-fetch の実装から始めてください。`

## 9. 補足

1. `implementation-plan.md` は実装計画の正
2. `11-batch-job-design.md` はバッチ責務の正
3. `20260313_source_target_candidates.md` は初期 seed 候補の正
4. 次セッションでは UI ではなくデータ取得実装に集中する
