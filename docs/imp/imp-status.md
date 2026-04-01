# AI Trend Hub 実装ステータス

最終更新: 2026-03-28

運用ルール:
- 履歴は最新 50 件相当までを目安に残し、古い詳細は別ファイルへ逃がす
- 先頭には必ず「現在の状態」と「次の確認事項」を置く
- 実装履歴の詳細な時系列は `agents-task-status.md` と `imp-hangover.md` に分散しすぎない

## 1. 現在の状態

- Layer 1 → Layer 2 → Layer 4 の自動パイプラインは稼働済み
- `content_language`、日本語ソース 14 件、`thumbnail_url`、admin Phase 3、OGP、sitemap、robots は実装済み
- `daily-tag-dedup` まで含めてタグ系の基本運用は実装済み
- 隣接分野タグ（L2/L4）と `thumbnail_bg_theme` の実装を追加済み
- `hourly-compute-ranks` は最適化済みだが、係数調整は未着手
- Topic Group はスキーマ受け口のみで、本実装は未着手
- 直近方針として、1周目ではカテゴリ設計を先に固定せず、属性として全件再構築してから 2周目着手前に設計を確定する方針へ切り替えた
- 本文が取得できた記事では、enrich の同一 AI バッチ応答で `matchedTagKeys` に加えて `canonicalTagHints` を返し、高信頼な alias / keyword 寄せを `tag_aliases` / `tag_keywords` へ自動反映する実装を追加した
- live run では job_run_id=719 で `summaryBatchSize=20`・`maxSummaryBatches=1`・20件 full_content 処理を OpenAI fallback で完了し、`manualPendingCount=0` を確認した
- prompt 調整後の live run（job_run_id=720）で `canonicalKeywordCount` が合計 8 件に増え、本文ベース `canonicalTagHints` が発火することを確認した
- `arxiv-ai` のタイトル群を見る限り基礎研究寄りが多く、通常記事で外した一般研究語を `paper` 専用タグ群として扱う必要性が高い

## 2. 直近で重要な運用状態

### 2.1 公開・収集まわり

- `alphaXiv` は収集 source にしない
- `arXiv` を収集 source とし、公開画面でだけ `alphaXiv` へ置換する
- `paper` は同一ドメイン 1 件まで、それ以外は同一ドメイン 2 件までに抑制する
- `enrich-worker` は 6 か月超の raw を claim 前に skip する
- `arxiv-ai` は例外運用とし、5 か月超 raw は enrich 対象外、L4 は 2 か月保持上限とする実装を追加した
- 定時 enrich は `limit=20`, `summaryBatchSize=20`, `maxSummaryBatches=1` を毎時 8 回（`:05`〜`:40` の 5 分刻み）で回す構成に更新した

### 2.2 `arxiv-ai` backlog

- `alphaxiv-ai` は停止済み
- `arxiv-ai` は再有効化済み
- 直近確認時点で `articles_raw total=1870`, `unprocessed=1840`
- `source_published_at < now() - 5 months` は 0 件、`public_articles` の 2 か月超も 0 件
- `job_run_id=563` の `hourly-fetch` が進行していた形跡あり
- `enrich` は未実行。件数・時間帯・Gemini API 負荷を見てから判断する

### 2.3 タグ再構築 1周目の固定方針

- 入力は `title + summary100 + summary200`
- 主タグは最大5件、平均4件超を目標にする
- 隣接分野タグは AI 判定前提とし、公開導線として数百件規模の付与を目指す
- 主タグの完全除外リスト:
  - `llm`
  - `generative-ai`
  - `rag`
  - `agent`
  - `huggingface`
  - `hugging face`
  - `paper`
  - `policy`
  - `safety`
- `llm` / `agent` / `voice` はカテゴリからも外す
- `paper` / `official` / `news` / `search-rag` / `oss` / `enterprise-ai` は 1周目では属性として保持し、2周目着手前に設計を確定する
- 今回用 artifact は `af-20260326/` 系の専用ディレクトリへ切り出す

## 3. 今の残タスク

### 優先

1. 今回用 artifact / prompt / outputs を `af-20260326/` 系へ切り直す
2. 主タグの完全除外リストを 1周目フローへ反映する
3. 50〜200件チャンクで 1周目の全件再判定を回す
4. 新規立項タグ候補を集計し、ユーザー提示用の候補一覧を作る
5. job_run_id=719/720 の結果を比較し、本文を見ても主タグが増えない記事群を分類して原因を整理する
6. `paper` 専用タグ群の初期候補を作り、`source_type='paper'` 限定 allowlist の試験投入方針を決める

### 後続

1. `hourly-compute-ranks` 係数を実データで点検・調整する
2. Topic Group 本実装
3. 言語フィルタ UI の要否判断
4. tag alias 管理 UI の要否判断
5. `push_subscriptions.genres` rename の判断
6. 2周目着手前にカテゴリ / 属性設計を確定する

## 4. 直近の重要変更

1. enrich prompt / parser / persist を拡張し、`full_content` 記事では同一 AI 応答から `canonicalTagHints` を受けて `tag_aliases` / `tag_keywords` へ高信頼な自動反映を行うようにした
2. `daily-tag-dedup` を拡張し、既存タグへの寄せを `alias` と `keyword` に分けて反映するようにした
3. `persist-enriched.ts` の `candidateTagCount` ログを AI の `properNounTags` 件数基準へ更新した
4. `enrichment-raw.ts` の interval SQL を Neon 互換に修正し、live run を再開可能にした
5. OpenAI fallback に `max_output_tokens` 超過時の再分割（20→10→5）を追加し、job_run_id=719 で `manualPendingCount=0` を確認した
6. job_run_id=719 では 20 件中 12 件で主タグが付き、合計 16 主タグ、候補語は合計 45 件増えた
7. job_run_id=719 では `canonicalAliasCount` / `canonicalKeywordCount` は 0 のままで、prompt 追加調整なしでは alias / keyword 寄せはまだ出ていない
8. prompt の矛盾を解消し `matchedTagKeys` 上限を 5 件へ広げた結果、job_run_id=720 では `canonicalKeywordCount=8`、`matched_total=17` を確認した
9. ただし job_run_id=720 は別コホートで、20 件中 4 件しか主タグが付いていない。量的改善の評価には、無タグ記事の内容分類とタグマスタ被覆の分析が必要
10. `alphaXiv` 非採用、`arXiv` 収集 + 公開時置換へ方針固定
11. `enrich-worker` に 6 か月超 raw の skip を追加
12. `arxiv-ai` は 5 か月超 raw を enrich 対象外、L4 は 2 か月保持にする方針で確定
13. `arxiv-ai` の source 別保持月数を `src/lib/source-retention.ts` に集約し、enrich / archive 両方から参照する実装を追加
14. `enrich-worker` の基本設定を `20件 x 8回/時` に拡張し、scheduler / route / docs を同期更新
15. `/admin/jobs` 向けの `job_runs` 件数定義をレコード単位へ寄せ、all success 時に `処理 n / 成功 n` になりやすいよう整理した
16. 公開一覧系にドメイン偏重抑制を追加
17. `thumbnail_url` backfill を追加し既存データへ再同期
18. 旧 `/api/thumb` URL の互換維持を追加
19. サムネイルを icon-only 合成へ変更
20. `icon_pending` 可視化を `/admin/tags` に追加
21. `daily-tag-dedup` を追加し、L2/L4 への遡及タグ付けを実装
22. `hourly-compute-ranks` を `job_runs` に追加
23. `public_article_sources` bigint バグを修正し全件バックフィル
24. admin Phase 3 を実装
25. `content_language` を公開 API へ常時伝搬
26. 日本語ソース 14 件を seed 済み
27. OGP / sitemap / robots を追加
28. `monthly-public-archive` を追加
29. 隣接分野タグ用 schema（migration 038）と `thumbnail_bg_theme` 伝搬を実装
30. `db:retag-layer2-layer4` スクリプトを追加し、L2/L4 の全件タグ洗い替えを自動化
31. `artifacts/gemini-tag-rebuild/` に監査・デザイン用プロンプトを追加
32. 1周目ではカテゴリを固定せず属性として全件再構築し、2周目着手前に設計確定する方針へ更新

## 5. 参照順

1. `docs/imp/imp-hangover.md`
2. `docs/imp/implementation-wait.md`
3. `docs/imp/implementation-plan.md`
4. `docs/imp/data-flow.md`
5. `agents-task-status.md`
