# AI Trend Hub 引継ぎメモ

最終更新: 2026-03-12

## 1. いまの正

1. データ設計の正は `docs/memo/20260312-data-design.md`
2. 仕様の正は `docs/spec/04-data-model-and-sql.md`, `docs/spec/05-ingestion-and-ai-pipeline.md`, `docs/spec/10-ingestion-layer-design.md`
3. SQL の正は `migrations/001_extensions.sql` から `migrations/009_rls.sql`

## 2. 今回更新した主要ファイル

1. `docs/memo/20260312-data-design.md`
2. `docs/spec/04-data-model-and-sql.md`
3. `docs/spec/05-ingestion-and-ai-pipeline.md`
4. `docs/spec/10-ingestion-layer-design.md`
5. `docs/imp/implementation-plan.md`
6. `docs/imp/implementation-wait.md`
7. `docs/imp/imp-status.md`
8. `docs/mock3/README.md`
9. `docs/mock3/site-flow.md`
10. `docs/mock3/index.html`
11. `docs/mock3/styles.css`
12. `docs/mock3/app.js`
13. `migrations/001_extensions.sql`
14. `migrations/002_source_targets.sql`
15. `migrations/003_articles_raw.sql`
16. `migrations/004_articles_enriched.sql`
17. `migrations/005_publication.sql`
18. `migrations/006_layer3_ops.sql`
19. `migrations/007_notifications.sql`
20. `migrations/008_batch_support.sql`
21. `migrations/009_rls.sql`

## 3. 今回の大きな合意

1. `layer3` は手動承認層ではなく、自動運用データ層
2. サイトは `layer4` のみを見る
3. タグマスタ追加だけ、人の確認余地を残す
4. 確定重複は `normalized_url` / 同一引用元のみ
5. 類似重複は後段
6. 運営操作は即時反映キューで扱う
7. 記事単位失敗でスキップし、全体ジョブは止めない

## 4. 次に再開する時の順番

0. `docs/guide/codex/AGENTS.md`およびファイル内で案内されたファイル
0. `docs/guide/README.md`およびファイル内で案内されたファイル
1. `docs/memo/20260312-data-design.md`
2. `migrations/001_extensions.sql` から `migrations/009_rls.sql`
3. `docs/mock3/index.html`
4. `docs/imp/imp-status.md`
5. `docs/imp/implementation-wait.md`

## 5. 直近の未解決

1. タグ候補昇格閾値
2. Google Trends 一致判定ルール
3. 類似重複の AI / pgvector 方針
4. `public_rankings` の正式計算式
5. 即時反映キューの正式 `queue_type`
