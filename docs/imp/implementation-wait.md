# AI Trend Hub 実装判断待ち

最終更新: 2026-03-14

## 1. 目的

ここには、実装を止めずに進めるために後からまとめて判断したい論点だけを残します。  
ユーザーが席を外している間に増えた判断待ちもここに集約します。

## 2. 現在の判断待ち

### 2.1 `source_targets` の初期 seed 一覧

未確定:

1. 初回投入する取得元の正式一覧
2. 各取得元の `fetch_kind` / `source_category` / `base_url`
3. 本番初期投入と開発用 seed の切り分け方

影響:

1. `source_targets` seed
2. `hourly-fetch` の初期動作確認
3. collector registry の対象範囲

現状:

1. 情報不足のため保留
2. 補足情報が入り次第、`implementation-plan.md` の seed 手順へ反映する

### 2.2 類似重複の正式ロジック

未確定:

1. `pgvector` の距離閾値
2. 類似重複を `layer2 -> layer4` のどの段階で使うか
3. representative source selector にどう効かせるか

影響:

1. `layer2 -> layer4` の統合
2. representative source selector
3. 後続の類似記事束ねロジック

現状:

1. P0 は類似重複を本格実装しない
2. 後続フェーズでは AI ではなく `pgvector` 寄りで検討する

### 2.4 `public_rankings` の計算式

未確定:

1. `open_count` の重み
2. 時間減衰の厳密な実装式
3. ソース別優先度を掛けるか
4. Digest 選定へ同式を流用するか別式にするか

影響:

1. 公開一覧順
2. Digest 選定

現状:

1. 暫定重みは別紙の実装計画へ反映済みとする
2. ソース別優先度はリリース時未実装寄り
3. 正式な係数調整は運用で再評価する

### 2.5 運営即時反映の対象範囲

未確定:

1. `hide_article` 以外をいつ実装対象へ戻すか
2. `retag` / `republish` / `rebuild_rank` / `admin_override` の優先順位
3. 管理 API でどこまで同期実行を許すか

影響:

1. `priority_processing_queue.queue_type`
2. 管理 API

## 3. 今回の作業で増えた判断待ち

1. `activity_logs.action_type` の正式一覧
2. `activity_logs.referrer_type` の正式一覧
3. タグ人手レビュー UI の詳細要件
4. `hourly-fetch` の source 単位失敗ログの正式な保存先

補足:

1. 現在の `articles_raw.last_error` は「既存 raw 行がある記事単位失敗」には残せる
2. ただし collector 自体の失敗や「新規 raw 挿入前」の失敗は紐付く `articles_raw` 行が存在しない
3. P0 実装では API 応答に失敗内容を返し、既存 raw がある場合だけ `last_error` を更新する
4. source 単位の失敗を永続化するなら、`source_targets` 側カラム追加か専用ジョブログの追加が必要

補足:

1. タグ人手レビュー UI 自体は必要と確定
2. 自動モードと判断待ちモードを持つ前提
3. タグ候補状況は管理画面で毎時ウォッチできる設計が望ましい

## 4. 今回確定した実装前提

1. タグ候補昇格閾値は、暫定で `seen_count >= 5`
2. Google Trends 一致判定は、日本語基準の類似一致
3. 類似重複は P0 では本格実装せず、後続は `pgvector` 寄りで検討
4. `public_rankings` は 1 週間でスコアが `1/5` になる時間減衰を前提にする
5. `share_count` と `save_count` は同重み
6. `source_open_count` は `share_count` / `save_count` の 2 倍重み
7. `impression_count` は `share_count` / `save_count` の 1/2 重み
8. ソース別優先度は初期未実装
9. 運営即時反映は P0 では `hide_article` を優先し、他 queue は後続
10. `layer4` は P0 はテーブル中心、一部 view 許容
11. `source_priority_rules` 初期値はソース間優先差なし
12. タグ人手レビュー UI は実装対象
13. タグ追加自動モードと判断待ちモードを併設する
14. タグ候補状況は管理画面で毎時ウォッチ可能にする

## 5. 参考にするドキュメント

1. `docs/memo/20260312-data-design.md`
2. `docs/spec/04-data-model-and-sql.md`
3. `docs/spec/05-ingestion-and-ai-pipeline.md`
4. `docs/spec/10-ingestion-layer-design.md`
