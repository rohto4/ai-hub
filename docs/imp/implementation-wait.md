# AI Trend Hub 実装判断待ち

最終更新: 2026-03-22

ここには実装を止めずに進めるために後から判断したい論点だけを残す。
解決済みの項目はこのファイルに残さない。

---

## 1. 判断待ち一覧

### 1.1 `hourly-compute-ranks` 係数調整のタイミング

現在の実装（`src/lib/ranking/compute.ts`）:
- activity ウェイト: impression=0.5, open=1.0, share=1.0, save=1.0, sourceOpen=2.0
- 時間減衰: 1週間でスコアが 1/5

アクティビティデータが現時点ではほぼゼロ（`activity_metrics_hourly` が数十件）のため、係数の評価ができない。

**判断待ち:** 実データが蓄積されたら係数を点検する。以下の観点で確認:
- ランキング上位が「新鮮な記事」か「エンゲージメント高い記事」かを確認
- 時間減衰が急すぎる/緩すぎるかを確認
- sourceOpen (元記事クリック) を最大ウェイトにしている妥当性

---

### 1.2 タグエイリアス管理 UI の要否

現状: `tag_aliases` テーブルは存在し、`matchTags` でエイリアス照合も動作している。
しかし管理画面から alias を追加する UI がなく、SQL 直接操作が必要。

**判断待ち:**
- 運用頻度が高いなら `/admin/tags/aliases` を作る
- 低いなら SQL 操作のままでよい
- `daily-tag-dedup` でキーワード統合が自動化されたため、alias 追加の機会は少ないかもしれない

---

### 1.3 `push_subscriptions.genres` カラム名変更

`push_subscriptions` テーブルの `genres` カラムが旧名称のまま残っている。
`source_categories` に rename するのが正しいが、DB 変更は Human-in-the-Loop 対象。

**判断待ち:** rename する場合は migration 037 で対応。アプリ側も `push_subscriptions.genres` を参照しているコードを修正する必要がある。影響範囲を確認してから実施。

---

### 1.4 Topic Group の最終 URL 設計

- 専用 URL（`/topics/:id`）を持つか、Home 内スクロールのままにするか

■ **`/topics/:id` の役割イメージ:** 「同一テーマを複数の視点から読むページ」。例えば「GPT-5 リリース」というトピックに対して、OpenAI 公式ブログ・VentureBeat・Zenn 等の複数記事を1ページに並べる。

■ **今すぐ作る必要があるか:** なし。pgvector 類似度ベースが前提なので、embedding 生成・HNSW インデックス・グループ化バッチが揃ってから設計を確定する。

**pgvector 実装に必要な準備（順番）:**
1. embedding 生成バッチ（title + summary_200 → `articles_enriched.summary_embedding`）
2. 既存 2861件の backfill（API コスト約 $0.02 程度）
3. HNSW インデックス追加（migration）
4. グループ化バッチ（類似度 0.92 以上の記事に同じ `topic_group_id` を付与）
5. UI 設計・`/topics/:id` 実装

■ **現在の状態:** `summary_embedding` 列（migration 033）・`topic_group_id` 列・`topic_groups` テーブル（migration 035）は存在するが、値はすべて NULL。

---

### 1.5 `critique` UI の有効化タイミング（保留）

`public_articles.critique` カラムは実装済みだが UI から非表示。
`enrich-worker` で critique 生成を有効化してから UI に追加する。

未確定: いつ critique 生成を有効化するか（API コスト・品質の兼ね合い）

---

### 1.6 `ADMIN_PATH_PREFIX` の動的設定（低優先）

現状: 管理画面は `/admin/*` 固定パス。`ADMIN_SECRET` cookie による認証で保護済み。
計画では `ADMIN_PATH_PREFIX` を env var で動的に変更する想定だったが、現状でも十分に保護されている。

**判断待ち:** 固定 `/admin` のままでよいか、env var 化するかを確定する。セキュリティ要件次第。

---

### 1.7 `arxiv-ai` の流入監視と再判断条件

現状:
- `arxiv-ai` は raw へは通常どおり取り込み、表示側での露出制御を別途検討する
- `enrich-worker` は `20件 x 8回/時` へ拡張済みで、まずは throughput 増加で backlog を吸収できるかを見る
- `enrich-worker` route の `maxDuration` は 600 秒へ延長し、Gemini まとめ処理 20 件の安定性を見る
- backlog 手動吸収中は GitHub Actions scheduled を一時停止し、`workflow_dispatch` のみで運用する
- `arxiv-ai` は L4 で 2 か月保持上限

**継続監視する項目:**
- `articles_raw` の `arxiv-ai` 未処理件数
- 直近 24 時間の `arxiv-ai` fetch 件数
- 直近 24 時間の `enrich-worker` 処理件数 / 成功件数
- `arxiv-ai` が Home / ranking / search にどれだけ露出しているか

**再判断条件:**
- 2 週間〜1 か月観測しても `arxiv-ai` の流入が継続的に多く、backlog が縮小しない
- `enrich-worker` の増速後でも Gemini API コストや待ち行列が不安定
- 公開面で `arxiv-ai` の露出が強すぎて他 source を圧迫する

**その場合の候補:**
- 表示側で `arxiv-ai` の露出上限をかける
- `arxiv-ai` の raw / enrich 対象期間を 2 か月へ揃える
- `arxiv-ai` の fetch 流量または優先度を下げる

---

## 2. 確定済み判断（参照用）

| 項目 | 決定内容 |
|---|---|
| source_targets の SSOT | `scripts/seed.mjs` が唯一のマスター |
| pgvector | migration 033 で導入済み。閾値 0.92 |
| commercial_use_policy | migration 034 で実装済み。prohibited は publish 除外 |
| hourly-publish | bulk upsert 化完了（unnest ベース）200件チャンク |
| タグ候補表示閾値 | `seen_count >= 4` |
| タグ候補抽出方式 | AI（enrich プロンプトの `properNounTags`）で固有名詞を抽出 |
| タグ重複検出 | `daily-tag-dedup` バッチで Gemini が候補↔既存タグを照合し自動統合 |
| タグ昇格時の処理 | tag_keywords 登録 + L2/L4 への ILIKE 遡及タグ付け |
| tag_key 命名規則 | lowercase, hyphen-separated（URL-safe）|
| public_rankings 時間減衰 | 1週間でスコアが 1/5 になる |
| source_type=paper のタグ | `paper` タグのみ付与 |
| publication_basis=source_snippet | Home に含める（明白な不整合のみ enrich-worker で止める） |
| action_type マッピング | view→impression, expand_200/topic_group_open/digest_click→open, article_open→source_open, share_copy→share, save→save。share_open / return_focus は集計外。unsave は無視 |
| hide_article 実装方式 | 管理 API が直接 DB UPDATE（queue 経由なし）。即時反映・同一トランザクション内で admin_operation_logs に記録 |
| priority_processing_queue | hide_article には使わない。retag / republish 等の将来実装用に予約 |
| 無効化4ソース | 全て停止維持 or 不採用（anthropic-news / google-ai-blog / huggingface-papers / paperswithcode）|
| OGP 着地先 | `/articles/:publicKey` そのまま |
| OGP カード種別 | `summary_large_image`（`/api/og` で実装済み） |
| share tracking | `meta` フィールドに `{ type, includeTitle, includeSummary, includeHashtag }` を追加（未実装、優先度低） |
| 管理画面パス | `/admin/*` 固定 + `ADMIN_SECRET` cookie 認証 |
| thumbnail_url 方式 | 内部テンプレート（`/api/thumb`）+ `public/thumbs/icons` の主要タグアイコン。未登録タグはラベル生成 fallback |
| tag 昇格時の icon_pending | `/admin/tags` で normalized key と ready/pending を表示。昇格 API / admin_operation_logs に `hasThumbnailAsset` を残す |
| thumbnail パーツ文字 | 不採用。tag 文字は UI 本体ですでに見えているため、thumbnail は icon-only / image-only を維持する |
| thumbnail fallback 基準 | 登録済み icon が 0 件なら `thumbnail_url` を作らず、既存の `thumbnail_emoji` fallback を優先する |
| 旧 thumbnail_url 互換 | 既存 DB に残る旧 `/api/thumb` URL は無効化せず、decoder 側で glyph fallback 描画して 400 を避ける |
| Topic Group スキーマ | migration 035 で `topic_group_id`, `topic_groups` テーブル追加済み。値は NULL のまま |

## 1.8 隣接分野タグ + 背景テーマ（運用待ち）

背景:
- 既存 AI タグ（3〜5件）に加えて、隣接分野タグ（1〜2件）を追加する方針
- 隣接分野タグは公開面の文脈補助と `thumbnail_bg_theme` 決定に使う

運用開始前の確認:
- 隣接分野タグマスタを既存タグ系と分離できていること
- title + summary_200 から 1〜2件に安定付与できること
- 背景テーマ合成（emoji + background）の優先順位が固定されていること

運用中の監視項目:
- 隣接分野タグ付与率（0件 / 1件 / 2件）
- 汎用タグ偏重記事の公開順位（ノイズ抑制が効いているか）
- 背景テーマ未設定率（fallback依存率）

再判断条件:
- 2週間運用して隣接分野タグ0件が高止まりする
- 背景テーマが実質同色に偏る
- tag増加で公開順位の妥当性が悪化する
