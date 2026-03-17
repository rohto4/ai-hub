# AI Trend Hub 実装判断待ち

最終更新: 2026-03-17

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
5. `ai-news-roundup` の 404 を feed 廃止として扱うか、source 差し替えで維持するか
6. `content_access_policy=fulltext_allowed` に昇格してよい source の判定基準をどこまで厳格に運用するか
   - 現在は `db:check-source-policies` / `db:set-source-policy` を用意済みで、昇格作業そのものは明示オペレーションで回せる

補足:

1. 現在の `articles_raw.last_error` は「既存 raw 行がある記事単位失敗」には残せる
2. ただし collector 自体の失敗や「新規 raw 挿入前」の失敗は紐付く `articles_raw` 行が存在しない
3. P0 実装では API 応答に失敗内容を返し、既存 raw がある場合だけ `last_error` を更新する
4. source 単位の失敗を永続化するなら、`source_targets` 側カラム追加か専用ジョブログの追加が必要
5. `ai-news-roundup` は local `hourly-layer12` 実行時に `Status code 404` を返したため、いったん `is_active=false` に切り替え済み
6. P0 は `Google Alerts -> feed_only`, `公式 source -> fulltext_allowed` を基本線にした

補足:

1. タグ人手レビュー UI 自体は必要と確定
2. 自動モードと判断待ちモードを持つ前提
3. タグ候補状況は管理画面で毎時ウォッチできる設計が望ましい

## 4. 今回確定した実装前提

1. タグ候補昇格閾値は、暫定で `seen_count >= 8`
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

## 6. 2026-03-16 現在の判断待ち

1. `manual_pending` の運用方針
   - `ai_processing_state=manual_pending` の行を、どの程度の時間 unresolved のまま許容するか
   - 現在の既定動作は `hold` のまま保持
2. サービス開始時の公開範囲
   - 開始時点で `publication_basis=full_summary` のみを公開対象にするか
   - `source_snippet` まで含めるか
   - 実装上は両方対応済みだが、運用判断を明文化したい
3. `manual-pending` artifact の保持方針
   - `artifacts/manual-pending/` のファイルをどの期間保持するか
   - import 完了後に自動削除するか
4. サイクルテスト完了の受け入れ条件
   - どの条件を満たしたら `cycle test` から `service-start hardening` へ進むか
   - 推奨 gate:
     - 正常系の fetch/enrich が通る
     - `manual_pending` export が通る
     - manual import 復旧が通る
     - stale `running` job が残らない
5. `anthropic-news` の扱い
   - 2026-03-16 〜 2026-03-17 の複数回の fetch で `Status code 404` を継続確認
   - feed URL 修復を優先するか、いったん source 停止に寄せるかの運用判断が必要

## 7. 2026-03-17 現在の判断待ち（新規追加）

### 7.1 無効化ソースの代替・修復方針

以下のソースが現在 `is_active=false`。それぞれの対応方針を判断する。

| ソース | 状況 | 選択肢 |
|---|---|---|
| `anthropic-news` | 404 継続 | A) feed URL を調査して修復 / B) 停止のまま維持 |
| `google-ai-blog` | parse error | A) RSS パーサ修正 / B) 別 feed URL を探す |
| `huggingface-papers` | 公式 RSS なし | A) tldr.takara.ai 等のサードパーティ RSS を使う / B) 不採用 |
| `mistral-ai-news` | 公式 RSS なし | A) メール購読経由の非公式 feed / B) 不採用 |
| `ledge-ai` | feed URL 不明 | A) 運営に問い合わせ / B) 不採用 |
| `paperswithcode` | RSS XML 不正 | A) rss-parser の lax モード対応 / B) 不採用 |

### 7.2 新規 raw 記事の enrich 消化戦略

新規ソース取得で ~1,900 件の未処理 raw が追加された。

未確定:
- bulk enrich を一気にかけるか（AI API コスト発生）
- 毎時バッチの自然消化に任せるか
- 手動 AI フロー（export → CLI 要約 → import）を混ぜるか

現状: Gemini primary=403(leaked)、Gemini secondary=429、OpenAI のみ有効

### 7.3 Web ホームページ実装の優先度

`src/app/page.tsx` は現在モックデータ表示中。
Layer 4 が稼働したので、いつ実データ切り替えを実施するかを決める。

未確定:
- `/api/home` エンドポイントの実装（カテゴリ別 4件・重み付きランダム）
- `page.tsx` のモックデータ削除・API 呼び出し切り替え
- source_type ベースのカード/リスト表示分岐

### 7.4 `critique`（批評）生成の追加タイミング

`articles_enriched.critique` は拡張カラムとして追加済み（全 NULL）。
full_content 記事のみに付与する予定だが、いつ実装に入るかが未確定。

### 7.5 タグ昇格閾値・条件の見直し

`tag_candidate_pool` の昇格閾値は暫定 `seen_count >= 8`。
新規 tag_keywords 方式に移行したため、候補プールの役割が変化している。

未確定:
- `tag_candidate_pool` を引き続き使うか
- 新しい昇格フローを設計するか（tag_keywords への追加 PR として）

### 7.6 `run-daily-enrich.ts` CLI スクリプト

新規 raw 記事の手動消化用に CLI スクリプトが必要。

未確定:
- `scripts/run-daily-enrich.ts` を作成する
- GitHub Actions の自動バッチに任せる（毎時 hourly-layer12 で消化）

## 8. 2026-03-17 L3/L4 実装で残した未確定事項

### 8.1 `activity_logs.action_type` の正式運用一覧

今回の実装では、次の暫定マッピングで `activity_metrics_hourly` を更新している。

- `view -> impression_count`
- `expand_200 / topic_group_open / digest_click -> open_count`
- `article_open -> source_open_count`
- `share_* -> share_count`
- `save -> save_count`

未確定:
- `share_open` を集計対象に含めるか
- `return_focus` を集計対象に含めるか
- `unsave` を減算イベントにするか無視するか

### 8.2 `priority_processing_queue` の最小実装範囲

L3/L4 仕様では `priority_processing_queue` を `hourly-publish` より先に処理する前提だが、
今回の実装では queue 自体の完全処理は入れていない。

未確定:
- `hide_article` を最初の queue_type として本当に固定するか
- `target_kind` を `public_article` / `enriched_article` / `canonical_url` のどれで持つか
- queue 処理を `hourly-publish` に入れるか、別 worker に切り出すか

### 8.3 Topic Group の最終遷移

`docs/imp/l3-l4-screen-flow.md` では Home 内の暫定セクションに留めた。

未確定:
- 専用 URL を持つか
- `public_article_sources` ベースの関連ソース表示をそのまま使うか
- `source_type=video/official/blog` の 3 カラム固定でよいか

### 8.4 Gemini 429 時の既定運用

実装上は batch 要約 + OpenAI fallback + process 内 circuit breaker を追加済み。

未確定:
- 本番既定を `Gemini(primary) -> OpenAI` にするか
- Gemini secondary を残すか
- `ENRICH_SUMMARY_BATCH_PAUSE_MS` の推奨値を何 ms にするか
- spending cap 解消までは Gemini を明示 disable に寄せるか

## 9. 2026-03-18 追加の判断待ち

### 9.1 Web のトップレベル分類を何で固定するか

現状:

1. L2/L4 は `source_category`=topic, `source_type`=source lane で整理済み
2. Home UI は `official / blog / video / agent` のように軸を混在させている
3. dim2_memo は `news / community / paper / overseas / oss` の表示分類を想定している

未確定:

1. P1 の Home primary tabs を `source_type` ベースで固定するか
2. dim2 の 5 分類を early に導入するか
3. 5 分類を導入する場合、`display_category` を L4 派生概念として追加するか

現在の暫定方針:

1. 破壊的変更を避けるため、まずは `source_type` + `source_category` + tags の 3 軸で進める
2. dim2 5 分類は後段で API/view 派生として検討する

### 9.2 `paper / news / alerts` の公開優先度

現状:

1. publish candidate には `paper=437`, `news=16`, `alerts=174` が存在する
2. `public_articles` 公開済みはまだ `official / alerts / blog` 偏重
3. `hourly-publish` が遅く、L4 への全面反映が未完了

未確定:

1. `paper` を Home primary lane に早期追加するか
2. `news` を official/blog と同列で出すか、別ページ先行にするか
3. `alerts` を Home メイン表示に残すか、topic 導線に寄せるか

### 9.3 snippet 系記事をどこまで Home に出すか

現状:

1. `articles_enriched.title` / `public_articles.display_title` の非日本語行は `0`
2. ただし抜き取り監査で、`source_snippet` 記事の一部に title-summary 内容ずれを確認した
3. `publication_basis='source_snippet'` は `294` 件ある

未確定:

1. Home メインレーンに `source_snippet` 記事を含めるか
2. `alerts` を topic 導線専用に寄せるか

補足:

1. ユーザー方針として、Home 側での定量的な絞り込みは強くかけない
2. 代わりに、明白な title-summary 内容ずれだけ `daily-enrich` 側で止める方向にした

### 9.4 `hourly-publish` の高速化方式

現状:

1. 2026-03-18 の再実行は長時間化して停止した
2. 停止前に `public_articles` は `745 -> 911` まで増加した
3. 現行実装は記事ごとに `public_articles` / `public_article_sources` / `public_article_tags` を順次 upsert している

未確定:

1. bulk SQL 化するか
2. tag 転写だけ別ジョブに分けるか
3. `public_article_tags` を delete/insert ではなく差分更新にするか

### 9.5 `/api/home` の返却粒度

現状:

1. Home UI と `mock4` は source lane / topic chips / digest / topic group を表示できる
2. ただし `/api/home` 自体はまだ単一の ranked article 配列 + stats/activity の返却に留まる
3. lane 別の配列分割は現在 UI 側で行っている

未確定:

1. `/api/home` で `latest` や `source_type` 別 lane を返すか
2. `topic chips` 用の集計を API 側で返すか
3. Home を最終的に SSR 主体へ寄せるか、現行 client fetch を残すか
