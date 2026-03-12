# AI Trend Hub 実装ステータス

最終更新: 2026-03-12

## 進捗サマリ

1. `layer1 -> layer4` のデータ設計を文書化した
2. Neon 向け migration を新設計へ刷新した
3. `docs/spec` を取得・整形・公開反映の流れに合わせて更新した
4. `docs/mock3` を追加し、公開データ中心の閲覧モックを作成した
5. `docs/imp` を、再開時にそのまま進めやすい形へ整理した
6. Neon 上で `layer1 / layer2` 用 migration を適用し、seed で `source_targets=3`, `articles_raw=3`, `articles_enriched=3` まで投入確認した

## いま残っている主要タスク

1. Neon 上で migration 適用確認
2. `source_targets` / `source_priority_rules` の本番初期 seed 作成
3. hourly fetch 実装
4. daily enrich 実装
5. hourly publish 実装
6. 日次タグ昇格バッチ実装
7. 週次アーカイブ実装
8. `public_articles` 系を読む本実装 API 接続

## 再開時の推奨確認順

1. `docs/imp/implementation-wait.md`
2. `docs/memo/20260312-data-design.md`
3. `docs/spec/04-data-model-and-sql.md`
4. `docs/spec/05-ingestion-and-ai-pipeline.md`
5. `docs/spec/10-ingestion-layer-design.md`
6. `migrations/001_extensions.sql` から `migrations/009_rls.sql`
7. `docs/mock3/`

## 今回の一連のタスクで使った入力トークン量と出力トークン量

この実行環境では、ターン単位の正確な入力トークン量・出力トークン量は取得できません。  
そのため、数値は未記録です。

## 追加メモ

1. `layer3` は手動承認層ではなく、自動運用データ層として固定
2. タグマスタ追加だけ、人手確認の余地を残す
3. サイトは `layer4` だけを参照する前提で進める
